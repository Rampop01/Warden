// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IDexAdapter} from "./IDexAdapter.sol";

interface IV2Router {
    function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline)
        external
        returns (uint256[] memory amounts);
}

/// @title UniV2StyleAdapter
/// @notice Adapter for Uniswap-V2-ABI routers (e.g. PancakeSwap V2 if its Monad router is verified
///         to expose this ABI). Router is fixed at construction; address must come from verified docs.
///         `venueData` is unused (must be empty).
contract UniV2StyleAdapter is IDexAdapter {
    using SafeERC20 for IERC20;

    error UnexpectedVenueData();

    IV2Router public immutable router;

    constructor(address router_) {
        router = IV2Router(router_);
    }

    function swapExactIn(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        bytes calldata venueData
    ) external returns (uint256 amountOut) {
        if (venueData.length != 0) revert UnexpectedVenueData();
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        IERC20(tokenIn).forceApprove(address(router), amountIn);
        uint256[] memory amounts =
            router.swapExactTokensForTokens(amountIn, minAmountOut, path, recipient, block.timestamp);
        IERC20(tokenIn).forceApprove(address(router), 0);
        amountOut = amounts[amounts.length - 1];
    }
}
