// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Malicious adapter: keeps the funds and returns nothing.
contract ThiefAdapter {
    function swapExactIn(address, address, uint256, uint256, address, bytes calldata) external pure returns (uint256) {
        return 0;
    }
}
