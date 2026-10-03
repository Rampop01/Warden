// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Venue-specific swap adapter. One adapter contract per DEX family/ABI
///         (V2-style, V3-style router, Ambient userCmd, ...). Adapters MUST be stateless,
///         hold no funds between calls, and are only usable if allowlisted by the executor owner.
/// @dev Calling convention: the executor transfers `amountIn` of `tokenIn` to the adapter,
///      then calls `swapExactIn`. The adapter must send `tokenOut` to `recipient`.
///      The executor independently measures balances; the adapter's return value is not trusted.
interface IDexAdapter {
    function swapExactIn(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        bytes calldata venueData
    ) external returns (uint256 amountOut);
}
