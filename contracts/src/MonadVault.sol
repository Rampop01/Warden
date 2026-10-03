// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title MonadVault
/// @notice Non-custodial ERC-4626 vault. Only the approved executor contract can move
///         capital, and only for the duration of a single transaction (`pullForTrade` then
///         `settleTrade`). Neither the executor nor the agent has any withdrawal path.
/// @dev `inFlight` is non-zero only inside an executor transaction, so `totalAssets()` is
///      stable between transactions. Settlement reverts if capital is not returned in full
///      minus the reported (and executor-bounded) loss.
contract MonadVault is ERC4626, Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error NotExecutor();
    error TradeInFlight();
    error NoTradeInFlight();
    error InsufficientAssets();
    error ExecutorNotSet();
    error ZeroAddress();

    event ExecutorSet(address indexed executor);
    event TradeStarted(uint256 amount);
    event TradeSettled(uint256 principal, uint256 returned, int256 pnl);
    event EmergencyPaused(address indexed by);

    address public executor;
    address public guardian; // may pause only
    uint256 public inFlight;

    constructor(IERC20 asset_, address owner_, address guardian_)
        ERC20("Monad Trading Vault USDC", "mtvUSDC")
        ERC4626(asset_)
        Ownable(owner_)
    {
        if (owner_ == address(0) || guardian_ == address(0)) revert ZeroAddress();
        guardian = guardian_;
    }

    // ---------------------------------------------------------------- admin

    function setExecutor(address executor_) external onlyOwner {
        if (inFlight != 0) revert TradeInFlight();
        executor = executor_;
        emit ExecutorSet(executor_);
    }

    function setGuardian(address guardian_) external onlyOwner {
        if (guardian_ == address(0)) revert ZeroAddress();
        guardian = guardian_;
    }

    function pause() external {
        require(msg.sender == owner() || msg.sender == guardian, "not authorized");
        _pause();
        emit EmergencyPaused(msg.sender);
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ---------------------------------------------------------- executor path

    /// @notice Executor borrows idle capital for one atomic trade.
    function pullForTrade(uint256 amount) external nonReentrant whenNotPaused {
        if (msg.sender != executor || executor == address(0)) revert NotExecutor();
        if (inFlight != 0) revert TradeInFlight();
        if (amount == 0 || amount > IERC20(asset()).balanceOf(address(this))) revert InsufficientAssets();
        inFlight = amount;
        IERC20(asset()).safeTransfer(msg.sender, amount);
        emit TradeStarted(amount);
    }

    /// @notice Executor returns the proceeds. Vault pulls the funds itself, so the
    ///         executor can never redirect them. Realized PnL = returned - principal.
    function settleTrade(uint256 returned) external nonReentrant {
        if (msg.sender != executor) revert NotExecutor();
        uint256 principal = inFlight;
        if (principal == 0) revert NoTradeInFlight();
        inFlight = 0;
        uint256 balBefore = IERC20(asset()).balanceOf(address(this));
        IERC20(asset()).safeTransferFrom(msg.sender, address(this), returned);
        // Defensive against fee-on-transfer assets: measure what actually arrived.
        uint256 received = IERC20(asset()).balanceOf(address(this)) - balBefore;
        emit TradeSettled(principal, received, int256(received) - int256(principal));
    }

    // ------------------------------------------------------------- accounting

    function totalAssets() public view override returns (uint256) {
        return IERC20(asset()).balanceOf(address(this)) + inFlight;
    }

    /// @dev Block all user flows while capital is out or the vault is paused for risk-bearing ops.
    ///      Withdrawals stay available when paused (emergency exit) but not mid-trade.
    function maxDeposit(address a) public view override returns (uint256) {
        return paused() || inFlight != 0 ? 0 : super.maxDeposit(a);
    }

    function maxMint(address a) public view override returns (uint256) {
        return paused() || inFlight != 0 ? 0 : super.maxMint(a);
    }

    function maxWithdraw(address a) public view override returns (uint256) {
        if (inFlight != 0) return 0;
        uint256 byShares = _convertToAssets(balanceOf(a), Math.Rounding.Floor);
        uint256 bal = IERC20(asset()).balanceOf(address(this));
        return byShares < bal ? byShares : bal;
    }

    function maxRedeem(address a) public view override returns (uint256) {
        if (inFlight != 0) return 0;
        uint256 shares = balanceOf(a);
        uint256 cap = _convertToShares(IERC20(asset()).balanceOf(address(this)), Math.Rounding.Floor);
        return shares < cap ? shares : cap;
    }

    /// @dev Virtual offset mitigates first-depositor inflation attacks.
    function _decimalsOffset() internal pure override returns (uint8) {
        return 6;
    }
}
