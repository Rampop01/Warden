// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IDexAdapter} from "./adapters/IDexAdapter.sol";

interface IVaultForExecutor {
    function asset() external view returns (address);
    function totalAssets() external view returns (uint256);
    function paused() external view returns (bool);
    function pullForTrade(uint256 amount) external;
    function settleTrade(uint256 returned) external;
}

/// @title RiskExecutor
/// @notice Capability-bounded executor for cyclic (USDC -> ... -> USDC) arbitrage routed through
///         allowlisted per-DEX adapters (V2-style, V3-style, Ambient, ...). No arbitrary targets,
///         no arbitrary calldata to arbitrary contracts, no withdrawal path. The agent can only call
///         `executeCycle`; risk parameters and allowlists are owner-only. Fails closed.
/// @dev Trust model: an allowlisted adapter is trusted like a router (owner vets it). Even so, the
///      executor measures balances itself and enforces the final minimum proceeds, so a faulty or
///      malicious adapter can only cause a revert, not a loss, within a single atomic transaction.
contract RiskExecutor is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct RiskParams {
        uint256 maxTradeSize;        // base-asset units per trade
        uint16 maxAllocationBps;     // max trade size as % of vault NAV
        uint16 maxLossBps;           // max tolerated loss per trade vs principal (slippage bound)
        uint16 minProfitBps;         // minimum required profit per trade
        uint256 maxDailyLoss;        // circuit breaker, base-asset units per UTC day
        uint8 maxHops;               // swap hop cap
    }

    /// @param adapter  allowlisted IDexAdapter
    /// @param tokenOut allowlisted output token of this hop
    /// @param data     venue-specific data forwarded to the adapter (e.g. V3 fee tier)
    struct Hop {
        address adapter;
        address tokenOut;
        bytes data;
    }

    error NotAgent();
    error VaultPaused();
    error CircuitBreakerTripped();
    error AdapterNotAllowed();
    error TokenNotAllowed();
    error BadPath();
    error TradeTooLarge();
    error AllocationExceeded();
    error Expired();
    error MinOutTooLow();
    error InsufficientProceeds();
    error InvalidParams();
    error Halted();

    event AgentSet(address indexed agent);
    event AdapterAllowed(address indexed adapter, bool allowed);
    event TokenAllowed(address indexed token, bool allowed);
    event RiskParamsSet(RiskParams params);
    event HaltSet(bool halted);
    event CycleExecuted(
        bytes32 indexed strategyId,
        uint256 amountIn,
        uint256 amountOut,
        int256 pnl,
        uint256 dayLoss,
        address[] adapters
    );

    IVaultForExecutor public immutable vault;
    IERC20 public immutable baseAsset;

    address public agent;
    bool public halted;
    RiskParams public risk;

    mapping(address => bool) public allowedAdapters;
    mapping(address => bool) public allowedTokens;

    uint256 public lossDay;
    uint256 public lossToday;

    constructor(address vault_, address owner_) Ownable(owner_) {
        vault = IVaultForExecutor(vault_);
        baseAsset = IERC20(IVaultForExecutor(vault_).asset());
        allowedTokens[address(baseAsset)] = true;
    }

    // ------------------------------------------------------------ owner config

    function setAgent(address agent_) external onlyOwner {
        require(agent_ != owner(), "agent!=owner");
        agent = agent_;
        emit AgentSet(agent_);
    }

    function setAdapter(address adapter, bool allowed) external onlyOwner {
        allowedAdapters[adapter] = allowed;
        emit AdapterAllowed(adapter, allowed);
    }

    function setToken(address token, bool allowed) external onlyOwner {
        allowedTokens[token] = allowed;
        emit TokenAllowed(token, allowed);
    }

    function setRiskParams(RiskParams calldata p) external onlyOwner {
        if (p.maxAllocationBps > 10_000 || p.maxLossBps > 10_000 || p.maxHops < 2 || p.maxHops > 4) {
            revert InvalidParams();
        }
        risk = p;
        emit RiskParamsSet(p);
    }

    /// @notice Owner or agent may halt (fail-safe); only owner may resume.
    function halt() external {
        if (msg.sender != owner() && msg.sender != agent) revert NotAgent();
        halted = true;
        emit HaltSet(true);
    }

    function resume() external onlyOwner {
        halted = false;
        emit HaltSet(false);
    }

    // ---------------------------------------------------------------- execution

    /// @param strategyId   off-chain strategy label, logged for PnL attribution
    /// @param amountIn     base-asset principal to deploy
    /// @param minAmountOut minimum base-asset proceeds (enforced vs principal and risk bounds)
    /// @param hops         ordered swaps; last hop must output the base asset
    /// @param deadline     quote expiry; stale quotes revert
    function executeCycle(bytes32 strategyId, uint256 amountIn, uint256 minAmountOut, Hop[] calldata hops, uint256 deadline)
        external
        nonReentrant
    {
        if (msg.sender != agent || agent == address(0)) revert NotAgent();
        if (halted) revert Halted();
        if (vault.paused()) revert VaultPaused();
        if (block.timestamp > deadline) revert Expired();

        RiskParams memory r = risk;
        if (r.maxTradeSize == 0) revert InvalidParams(); // unconfigured => fail closed

        _checkHops(hops, r.maxHops);

        if (amountIn == 0 || amountIn > r.maxTradeSize) revert TradeTooLarge();
        if (amountIn * 10_000 > vault.totalAssets() * r.maxAllocationBps) revert AllocationExceeded();

        // Proceeds must be at least principal*(1 - maxLoss + minProfit).
        uint256 floorBps = 10_000 - r.maxLossBps + r.minProfitBps;
        if (minAmountOut * 10_000 < amountIn * floorBps) revert MinOutTooLow();

        _rollDay();
        if (lossToday >= r.maxDailyLoss) revert CircuitBreakerTripped();

        vault.pullForTrade(amountIn);

        uint256 out = _runHops(amountIn, minAmountOut, hops);
        if (out < minAmountOut) revert InsufficientProceeds();

        baseAsset.forceApprove(address(vault), out);
        vault.settleTrade(out);
        baseAsset.forceApprove(address(vault), 0);

        int256 pnl = int256(out) - int256(amountIn);
        if (pnl < 0) {
            lossToday += uint256(-pnl);
            if (lossToday > r.maxDailyLoss) revert CircuitBreakerTripped(); // single trade cannot breach cap
        }

        address[] memory used = new address[](hops.length);
        for (uint256 i; i < hops.length; i++) used[i] = hops[i].adapter;
        emit CycleExecuted(strategyId, amountIn, out, pnl, lossToday, used);
    }

    // ----------------------------------------------------------------- internals

    function _runHops(uint256 amountIn, uint256 minAmountOut, Hop[] calldata hops) internal returns (uint256 out) {
        address tokenIn = address(baseAsset);
        uint256 amt = amountIn;
        uint256 n = hops.length;
        for (uint256 i = 0; i < n; i++) {
            // Intermediate hops use min 0; the final hop (and the final check) enforce minAmountOut.
            amt = _hop(tokenIn, amt, i == n - 1 ? minAmountOut : 0, hops[i]);
            tokenIn = hops[i].tokenOut;
        }
        out = amt;
    }

    function _hop(address tokenIn, uint256 amt, uint256 minOut, Hop calldata h) internal returns (uint256 received) {
        IERC20 tOut = IERC20(h.tokenOut);
        uint256 before = tOut.balanceOf(address(this));
        IERC20(tokenIn).safeTransfer(h.adapter, amt);
        IDexAdapter(h.adapter).swapExactIn(tokenIn, h.tokenOut, amt, minOut, address(this), h.data);
        received = tOut.balanceOf(address(this)) - before; // measured; adapter return value untrusted
    }


    function _checkHops(Hop[] calldata hops, uint8 maxHops) internal view {
        uint256 n = hops.length;
        if (n < 2 || n > maxHops) revert BadPath();
        if (hops[n - 1].tokenOut != address(baseAsset)) revert BadPath();
        for (uint256 i = 0; i < n; i++) {
            if (!allowedAdapters[hops[i].adapter]) revert AdapterNotAllowed();
            if (!allowedTokens[hops[i].tokenOut]) revert TokenNotAllowed();
        }
    }

    function _rollDay() internal {
        uint256 d = block.timestamp / 1 days;
        if (d != lossDay) {
            lossDay = d;
            lossToday = 0;
        }
    }
}
