// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockERC20 is ERC20 {
    uint8 private immutable _dec;

    constructor(string memory n, string memory s, uint8 d) ERC20(n, s) {
        _dec = d;
    }

    function decimals() public view override returns (uint8) {
        return _dec;
    }

    function mint(address to, uint256 a) external {
        _mint(to, a);
    }
}

/// @dev Test-only router. Each hop converts at a configured bps rate (10000 = 1:1, decimals ignored
///      since test tokens share decimals). Pays out from its own inventory.
contract MockRouter {
    mapping(address => mapping(address => uint256)) public rateBps;
    bool public shouldRevert;

    function setRate(address a, address b, uint256 bps) external {
        rateBps[a][b] = bps;
    }

    function setRevert(bool v) external {
        shouldRevert = v;
    }

    function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256)
        external
        returns (uint256[] memory amounts)
    {
        require(!shouldRevert, "router revert");
        IERC20(path[0]).transferFrom(msg.sender, address(this), amountIn);
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        uint256 cur = amountIn;
        for (uint256 i = 0; i + 1 < path.length; i++) {
            cur = (cur * rateBps[path[i]][path[i + 1]]) / 10_000;
            amounts[i + 1] = cur;
        }
        require(cur >= amountOutMin, "slippage");
        IERC20(path[path.length - 1]).transfer(to, cur);
    }
}
