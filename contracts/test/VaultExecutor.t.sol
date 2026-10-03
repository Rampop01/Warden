// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MonadVault} from "../src/MonadVault.sol";
import {RiskExecutor} from "../src/RiskExecutor.sol";
import {MockERC20, MockRouter} from "./Mocks.sol";
import {ThiefAdapter} from "./Mocks_ThiefAdapter.sol";
import {UniV2StyleAdapter} from "../src/adapters/UniV2StyleAdapter.sol";

contract VaultExecutorTest is Test {
    MockERC20 usdc;
    MockERC20 wmon;
    MockRouter dexA;
    UniV2StyleAdapter adapterA;
    MonadVault vault;
    RiskExecutor exec;

    address owner = address(0xA11CE);
    address guardian = address(0x6A8D);
    address agent = address(0xA6E47);
    address user = address(0xB0B);
    address attacker = address(0xBAD);

    function setUp() public {
        vm.warp(1_700_000_000);
        usdc = new MockERC20("USDC", "USDC", 6);
        wmon = new MockERC20("WMON", "WMON", 6);
        dexA = new MockRouter();
        adapterA = new UniV2StyleAdapter(address(dexA));
        vault = new MonadVault(usdc, owner, guardian);
        exec = new RiskExecutor(address(vault), owner);

        vm.startPrank(owner);
        vault.setExecutor(address(exec));
        exec.setAgent(agent);
        exec.setAdapter(address(adapterA), true);
        exec.setToken(address(wmon), true);
        exec.setRiskParams(
            RiskExecutor.RiskParams({
                maxTradeSize: 20_000e6,
                maxAllocationBps: 2_000,
                maxLossBps: 50,
                minProfitBps: 0,
                maxDailyLoss: 100e6,
                maxHops: 3
            })
        );
        vm.stopPrank();

        // user deposits 100k
        usdc.mint(user, 100_000e6);
        vm.startPrank(user);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(100_000e6, user);
        vm.stopPrank();

        // router inventory + rates: USDC->WMON 1:1 (10000), WMON->USDC 1.01 (profitable round trip)
        usdc.mint(address(dexA), 1_000_000e6);
        wmon.mint(address(dexA), 1_000_000e6);
        dexA.setRate(address(usdc), address(wmon), 10_000);
        dexA.setRate(address(wmon), address(usdc), 10_100);
    }

    function _hops() internal view returns (RiskExecutor.Hop[] memory h) {
        h = new RiskExecutor.Hop[](2);
        h[0] = RiskExecutor.Hop(address(adapterA), address(wmon), "");
        h[1] = RiskExecutor.Hop(address(adapterA), address(usdc), "");
    }

    function _run(uint256 amt, uint256 minOut) internal {
        vm.prank(agent);
        exec.executeCycle("arb-v1", amt, minOut, _hops(), block.timestamp + 30);
    }

    // ---------------------------------------------------------- happy path

    function test_profitableCycleIncreasesNav() public {
        uint256 navBefore = vault.totalAssets();
        _run(10_000e6, 10_000e6);
        assertEq(vault.totalAssets(), navBefore + 100e6);
        assertEq(vault.inFlight(), 0);
        assertEq(usdc.balanceOf(address(exec)), 0);
        assertEq(usdc.allowance(address(exec), address(adapterA)), 0);
        assertEq(usdc.balanceOf(address(adapterA)), 0);
        assertEq(usdc.allowance(address(exec), address(vault)), 0);
    }

    function test_userCanWithdrawAfterProfit() public {
        _run(10_000e6, 10_000e6);
        uint256 shares = vault.balanceOf(user);
        vm.prank(user);
        uint256 out = vault.redeem(shares, user, user);
        assertApproxEqAbs(out, 100_100e6, 1e3);
    }

    // ------------------------------------------------------ access control

    function test_unauthorizedCallerReverts() public {
        vm.prank(attacker);
        vm.expectRevert(RiskExecutor.NotAgent.selector);
        exec.executeCycle("x", 1e6, 1e6, _hops(), block.timestamp + 1);
    }

    function test_agentCannotTouchVaultFunds() public {
        vm.startPrank(agent);
        vm.expectRevert(MonadVault.NotExecutor.selector);
        vault.pullForTrade(1e6);
        vm.expectRevert();
        vault.setExecutor(agent);
        vm.expectRevert();
        vault.unpause();
        vm.stopPrank();
    }

    function test_agentCannotWithdrawOthersShares() public {
        vm.prank(agent);
        vm.expectRevert();
        vault.withdraw(1e6, agent, user);
    }

    function test_agentCannotChangeRiskOrAllowlists() public {
        vm.startPrank(agent);
        vm.expectRevert();
        exec.setAdapter(attacker, true);
        vm.expectRevert();
        exec.setToken(attacker, true);
        vm.expectRevert();
        exec.setAgent(attacker);
        vm.expectRevert();
        exec.resume();
        vm.stopPrank();
    }

    function test_executorContractHasNoArbitraryCall() public {
        // Only allowlisted adapters can be called: attacker-controlled target rejected.
        RiskExecutor.Hop[] memory h = _hops();
        h[0].adapter = attacker;
        vm.prank(agent);
        vm.expectRevert(RiskExecutor.AdapterNotAllowed.selector);
        exec.executeCycle("x", 1e6, 1e6, h, block.timestamp + 1);
    }

    function test_thiefAdapterCannotCauseLoss() public {
        // Even if an adapter is (mistakenly) allowlisted, keeping funds => final minOut check reverts.
        ThiefAdapter thief = new ThiefAdapter();
        vm.prank(owner);
        exec.setAdapter(address(thief), true);
        RiskExecutor.Hop[] memory h = _hops();
        h[0].adapter = address(thief);
        uint256 nav = vault.totalAssets();
        vm.prank(agent);
        vm.expectRevert();
        exec.executeCycle("x", 10_000e6, 10_000e6, h, block.timestamp + 1);
        assertEq(vault.totalAssets(), nav);
        assertEq(usdc.balanceOf(address(thief)), 0);
    }

    function test_unexpectedVenueDataRejectedByV2Adapter() public {
        RiskExecutor.Hop[] memory h = _hops();
        h[0].data = hex"01";
        vm.prank(agent);
        vm.expectRevert();
        exec.executeCycle("x", 1e6, 1e6, h, block.timestamp + 1);
    }

    function test_tooManyHopsRejected() public {
        RiskExecutor.Hop[] memory h = new RiskExecutor.Hop[](4);
        for (uint256 i; i < 4; i++) h[i] = RiskExecutor.Hop(address(adapterA), i % 2 == 0 ? address(wmon) : address(usdc), "");
        vm.prank(agent);
        vm.expectRevert(RiskExecutor.BadPath.selector);
        exec.executeCycle("x", 1e6, 1e6, h, block.timestamp + 1);
    }

    // --------------------------------------------------------- risk limits

    function test_oversizedTradeReverts() public {
        vm.prank(agent);
        vm.expectRevert(RiskExecutor.TradeTooLarge.selector);
        exec.executeCycle("x", 20_001e6, 20_001e6, _hops(), block.timestamp + 1);
    }

    function test_allocationBreachReverts() public {
        vm.prank(owner);
        exec.setRiskParams(
            RiskExecutor.RiskParams(50_000e6, 500, 50, 0, 100e6, 3) // 5% of 100k = 5k
        );
        vm.prank(agent);
        vm.expectRevert(RiskExecutor.AllocationExceeded.selector);
        exec.executeCycle("x", 5_001e6, 5_001e6, _hops(), block.timestamp + 1);
    }

    function test_unsupportedTokenReverts() public {
        RiskExecutor.Hop[] memory h = _hops();
        h[0].tokenOut = address(0xDEAD);
        vm.prank(agent);
        vm.expectRevert(RiskExecutor.TokenNotAllowed.selector);
        exec.executeCycle("x", 1e6, 1e6, h, block.timestamp + 1);
    }

    function test_pathMustEndWithBaseAsset() public {
        RiskExecutor.Hop[] memory h = _hops();
        h[1].tokenOut = address(wmon);
        vm.prank(agent);
        vm.expectRevert(RiskExecutor.BadPath.selector);
        exec.executeCycle("x", 1e6, 1e6, h, block.timestamp + 1);
    }

    function test_excessiveSlippageBoundRejected() public {
        // minOut below principal*(1-0.5%) is rejected before any funds move
        vm.prank(agent);
        vm.expectRevert(RiskExecutor.MinOutTooLow.selector);
        exec.executeCycle("x", 10_000e6, 9_900e6, _hops(), block.timestamp + 1);
    }

    function test_staleQuoteReverts() public {
        vm.prank(agent);
        vm.expectRevert(RiskExecutor.Expired.selector);
        exec.executeCycle("x", 1e6, 1e6, _hops(), block.timestamp - 1);
    }

    function test_routerRevertUnwindsAndKeepsFunds() public {
        dexA.setRevert(true);
        uint256 nav = vault.totalAssets();
        vm.prank(agent);
        vm.expectRevert();
        exec.executeCycle("x", 1e6, 1e6, _hops(), block.timestamp + 1);
        assertEq(vault.totalAssets(), nav);
        assertEq(vault.inFlight(), 0);
    }

    function test_actualSlippageBelowMinOutReverts() public {
        dexA.setRate(address(wmon), address(usdc), 9_900); // 0.99 * 0.99 round trip loses ~2%
        vm.prank(agent);
        vm.expectRevert(); // router "slippage"
        exec.executeCycle("x", 10_000e6, 9_950e6, _hops(), block.timestamp + 1);
    }

    function test_dailyLossCircuitBreaker() public {
        // round trip 0.998: loses 0.2% => 20 USDC per 10k trade; cap 100 -> 5 trades ok then tripped
        dexA.setRate(address(wmon), address(usdc), 9_980);
        for (uint256 i; i < 5; i++) {
            _run(10_000e6, 9_950e6);
        }
        vm.prank(agent);
        vm.expectRevert(RiskExecutor.CircuitBreakerTripped.selector);
        exec.executeCycle("x", 10_000e6, 9_950e6, _hops(), block.timestamp + 1);

        // resets next day
        vm.warp(block.timestamp + 1 days);
        _run(10_000e6, 9_950e6);
    }

    function test_singleLossCannotExceedDailyCap() public {
        vm.prank(owner);
        exec.setRiskParams(RiskExecutor.RiskParams(20_000e6, 2_000, 50, 0, 10e6, 3));
        dexA.setRate(address(wmon), address(usdc), 9_980); // loses 20 USDC > 10 cap
        vm.prank(agent);
        vm.expectRevert(RiskExecutor.CircuitBreakerTripped.selector);
        exec.executeCycle("x", 10_000e6, 9_950e6, _hops(), block.timestamp + 1);
    }

    // ----------------------------------------------------------- pause/halt

    function test_pausedVaultBlocksTrading() public {
        vm.prank(guardian);
        vault.pause();
        vm.prank(agent);
        vm.expectRevert(RiskExecutor.VaultPaused.selector);
        exec.executeCycle("x", 1e6, 1e6, _hops(), block.timestamp + 1);
    }

    function test_pausedVaultStillAllowsExit() public {
        vm.prank(guardian);
        vault.pause();
        uint256 shares = vault.balanceOf(user);
        vm.prank(user);
        vault.redeem(shares, user, user);
        assertGt(usdc.balanceOf(user), 99_999e6);
    }

    function test_pausedVaultBlocksDeposits() public {
        vm.prank(guardian);
        vault.pause();
        vm.prank(user);
        vm.expectRevert();
        vault.deposit(1e6, user);
    }

    function test_guardianCannotUnpause() public {
        vm.startPrank(guardian);
        vault.pause();
        vm.expectRevert();
        vault.unpause();
        vm.stopPrank();
    }

    function test_haltedExecutorBlocksTrading() public {
        vm.prank(agent);
        exec.halt();
        vm.prank(agent);
        vm.expectRevert(RiskExecutor.Halted.selector);
        exec.executeCycle("x", 1e6, 1e6, _hops(), block.timestamp + 1);
    }

    function test_unconfiguredRiskFailsClosed() public {
        RiskExecutor e2 = new RiskExecutor(address(vault), owner);
        vm.startPrank(owner);
        e2.setAgent(agent);
        e2.setAdapter(address(adapterA), true);
        e2.setToken(address(wmon), true);
        vm.stopPrank();
        vm.prank(owner);
        vault.setExecutor(address(e2));
        vm.prank(agent);
        vm.expectRevert(RiskExecutor.InvalidParams.selector);
        e2.executeCycle("x", 1e6, 1e6, _hops(), block.timestamp + 1);
    }

    // ------------------------------------------------------------ accounting

    function test_firstDepositorInflationAttackMitigated() public {
        MonadVault v2 = new MonadVault(usdc, owner, guardian);
        usdc.mint(attacker, 1_000_000e6);
        usdc.mint(user, 10_000e6);
        vm.startPrank(attacker);
        usdc.approve(address(v2), type(uint256).max);
        v2.deposit(1, attacker);
        usdc.transfer(address(v2), 50_000e6); // donation
        vm.stopPrank();
        vm.startPrank(user);
        usdc.approve(address(v2), type(uint256).max);
        v2.deposit(10_000e6, user);
        vm.stopPrank();
        assertGt(v2.maxWithdraw(user), 9_900e6);
    }

    function testFuzz_depositRedeemNeverProfitsUser(uint96 amt) public {
        amt = uint96(bound(amt, 1e6, 1_000_000e6));
        usdc.mint(attacker, amt);
        vm.startPrank(attacker);
        usdc.approve(address(vault), amt);
        uint256 s = vault.deposit(amt, attacker);
        uint256 out = vault.redeem(s, attacker, attacker);
        vm.stopPrank();
        assertLe(out, amt);
    }

    function testFuzz_tradeNeverBreachesBounds(uint96 amt, uint16 rateBps) public {
        amt = uint96(bound(amt, 1e6, 20_000e6));
        rateBps = uint16(bound(rateBps, 9_000, 11_000));
        dexA.setRate(address(wmon), address(usdc), rateBps);
        uint256 nav = vault.totalAssets();
        uint256 minOut = (uint256(amt) * 9_950) / 10_000;
        vm.prank(agent);
        try exec.executeCycle("f", amt, minOut, _hops(), block.timestamp + 1) {
            // loss never exceeds maxLossBps of principal
            assertGe(vault.totalAssets() + (uint256(amt) * 50) / 10_000, nav);
        } catch {}
        assertEq(vault.inFlight(), 0);
    }
}
