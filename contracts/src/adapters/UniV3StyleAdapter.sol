// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IDexAdapter} from "./IDexAdapter.sol";

/// @dev Uniswap SwapRouter02-style ABI (no deadline in struct). The Monad deployment's actual
///      router interface MUST be verified against official Uniswap deployment docs before use;
///      if it differs (e.g. Universal Router / V4 PoolManager), write a dedicated adapter instead.
interface ISwapRouter02 {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

/// @title UniV3StyleAdapter
/// @notice Adapter for V3-style single-hop swaps. `venueData` = abi.encode(uint24 feeTier).
///         Router fixed at construction. NOT verified against any Monad deployment.
contract UniV3StyleAdapter is IDexAdapter {
    using SafeERC20 for IERC20;

    error BadVenueData();

    ISwapRouter02 public immutable router;

    constructor(address router_) {
        router = ISwapRouter02(router_);
    }

    function swapExactIn(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        bytes calldata venueData
    ) external returns (uint256 amountOut) {
        if (venueData.length != 32) revert BadVenueData();
        uint24 fee = abi.decode(venueData, (uint24));
        IERC20(tokenIn).forceApprove(address(router), amountIn);
        amountOut = router.exactInputSingle(
            ISwapRouter02.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: fee,
                recipient: recipient,
                amountIn: amountIn,
                amountOutMinimum: minAmountOut,
                sqrtPriceLimitX96: 0
            })
        );
        IERC20(tokenIn).forceApprove(address(router), 0);
    }
}
