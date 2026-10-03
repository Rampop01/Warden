// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MonadVault} from "../src/MonadVault.sol";
import {RiskExecutor} from "../src/RiskExecutor.sol";
import {UniV3StyleAdapter} from "../src/adapters/UniV3StyleAdapter.sol";

contract DeployScript is Script {
    function run() external {
        string memory pkStr = vm.envString("PRIVATE_KEY");
        uint256 deployerKey = bytes(pkStr).length == 64
            ? vm.parseUint(string.concat("0x", pkStr))
            : vm.parseUint(pkStr);
        address deployer = vm.addr(deployerKey);
        
        address agent = vm.envOr("AGENT_ADDRESS", 0x2c55614E7fC28894F55a7169ce0af42FAFF5E457);
        address guardian = vm.envOr("GUARDIAN_ADDRESS", deployer);

        address usdcAddress = vm.envOr("USDC_ADDRESS", address(0x534b2f3A21130d7a60830c2Df862319e593943A3));

        console2.log("=== Deploying Monad Trading Vault System ===");
        console2.log("Deployer / Owner Address:", deployer);
        console2.log("Guardian Address:        ", guardian);
        console2.log("Agent Trading Hot Key:   ", agent);
        console2.log("USDC Base Asset:         ", usdcAddress);

        vm.startBroadcast(deployerKey);

        // 1. Deploy MonadVault
        MonadVault vault = new MonadVault(IERC20(usdcAddress), deployer, guardian);
        console2.log("MonadVault deployed at:", address(vault));

        // 2. Deploy RiskExecutor
        RiskExecutor executor = new RiskExecutor(address(vault), deployer);
        console2.log("RiskExecutor deployed at:", address(executor));

        // 3. Connect Executor to Vault
        vault.setExecutor(address(executor));
        console2.log("Vault executor authorized.");

        // 4. Configure Agent on Executor (enforces agent != owner)
        executor.setAgent(agent);
        console2.log("Agent hot-key authorized on executor.");

        // 5. Allowlist baseAsset on Executor
        executor.setToken(usdcAddress, true);

        // 6. Set initial conservative risk parameters
        // Max trade: 5,000 USDC, Max allocation: 20% (2000 bps), Max loss: 0.5% (50 bps), Max daily loss: 50 USDC
        executor.setRiskParams(
            RiskExecutor.RiskParams({
                maxTradeSize: 5_000e6,
                maxAllocationBps: 2_000,
                maxLossBps: 50,
                minProfitBps: 0,
                maxDailyLoss: 50e6,
                maxHops: 3
            })
        );
        console2.log("Conservative risk parameters configured.");

        vm.stopBroadcast();

        console2.log("===========================================");
        console2.log("DEPLOYMENT COMPLETE");
        console2.log("Vault Address:   ", address(vault));
        console2.log("Executor Address:", address(executor));
        console2.log("Agent Address:   ", agent);
        console2.log("===========================================");
    }
}
