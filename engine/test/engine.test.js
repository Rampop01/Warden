import test from "node:test";
import assert from "node:assert/strict";
import { getAmountOut, evaluateCycle } from "../src/arb.js";
import { PaperTrader, riskCheck } from "../src/paper.js";
import { loadConfig, unverifiedItems, assertLiveAllowed } from "../src/config.js";

const U = 1_000_000n;
const costs = { gasBase: 50_000n, overheadBase: 10_000n, slippageBps: 10 };
const limits = {
  maxTradeSize: 20_000n * U, maxAllocationBps: 2000, safetyMarginBps: 5,
  maxDailyLoss: 100n * U, maxQuoteAgeMs: 2000, quoteTtlMs: 1000,
};
const pool = (b, t) => ({ reserveBase: b * U, reserveToken: t * U, feeBps: 30 });

test("gross spread alone is not profit: fees+impact kill a 0.2% spread", () => {
  // buy pool price 1.000, sell pool price ~1.002 (spread 0.2%) < 2x30bps fees
  const sell = { reserveBase: 1_000_000n * U, reserveToken: 998_004n * U, feeBps: 30 };
  const r = evaluateCycle(1_000n * U, pool(1_000_000n, 1_000_000n), sell, costs);
  assert.ok(r.expectedProfit < 0n);
});

test("large spread yields positive net profit after costs", () => {
  const buy = pool(1_000_000n, 1_000_000n);
  const sell = { reserveBase: 1_050_000n * U, reserveToken: 1_000_000n * U, feeBps: 30 };
  const r = evaluateCycle(1_000n * U, buy, sell, costs);
  assert.ok(r.expectedProfit > 0n);
  assert.ok(r.expectedProfit < r.grossProfit);
});

test("getAmountOut matches V2 formula", () => {
  assert.equal(getAmountOut(1000n, 1_000_000n, 1_000_000n, 30), 996n);
});

test("stale/expired quote rejected", () => {
  const opp = { amountIn: 1n * U, expectedProfit: 1n * U, quoteTs: 0, expiry: 1000 };
  const v = riskCheck(opp, limits, { nav: 100_000n * U, lossToday: 0n, paused: false }, 5000);
  assert.ok(v.reasons.includes("quote-expired") && v.reasons.includes("quote-stale"));
});

test("missing metadata fails closed", () => {
  const v = riskCheck({ amountIn: 1n, expectedProfit: 1n }, limits, { nav: 1n, lossToday: 0n, paused: false }, 0);
  assert.ok(!v.approved);
});

test("paper trader: profitable fill raises NAV, ledger logs decisions", () => {
  const pt = new PaperTrader({ limits, costs, initialNav: 100_000n * U });
  const snap = {
    ts: 1000, block: 1, route: ["dex-a", "dex-b"],
    buyPool: pool(1_000_000n, 1_000_000n),
    sellPool: { reserveBase: 1_050_000n * U, reserveToken: 1_000_000n * U, feeBps: 30 },
  };
  const pnl = pt.tick(snap, 1100);
  assert.ok(pnl > 0n);
  assert.equal(pt.state.nav, 100_000n * U + pnl);
  assert.equal(pt.ledger[0].action, "paper-fill");
});

test("paper trader rejects when no net edge and logs reason", () => {
  const pt = new PaperTrader({ limits, costs, initialNav: 100_000n * U });
  const p = pool(1_000_000n, 1_000_000n);
  assert.equal(pt.tick({ ts: 1000, block: 1, route: [], buyPool: p, sellPool: { reserveBase: 1_000_000n * U, reserveToken: 1_000_000n * U, feeBps: 30 } }, 1100), null);
  assert.equal(pt.ledger[0].action, "reject");
});

test("circuit breaker blocks after daily loss", () => {
  const v = riskCheck({ amountIn: 1n, expectedProfit: 10n * U, quoteTs: 0, expiry: 10 }, limits,
    { nav: 100_000n * U, lossToday: 100n * U, paused: false }, 1);
  assert.ok(v.reasons.includes("circuit-breaker"));
});

test("live execution blocked while config is UNVERIFIED", () => {
  const cfg = loadConfig();
  assert.ok(unverifiedItems(cfg).length > 0);
  assert.throws(() => assertLiveAllowed(cfg));
});

test("evaluateHops accurately evaluates explicit hop chain matching on-chain Hop struct", async () => {
  const hops = [
    {
      adapter: "0x1111111111111111111111111111111111111111",
      tokenIn: "USDC",
      tokenOut: "WMON",
      pool: { reserveIn: 1_000_000n * U, reserveOut: 1_000_000n * U, feeBps: 30 },
      data: "0x"
    },
    {
      adapter: "0x2222222222222222222222222222222222222222",
      tokenIn: "WMON",
      tokenOut: "USDC",
      pool: { reserveIn: 1_000_000n * U, reserveOut: 1_050_000n * U, feeBps: 30 },
      data: "0x"
    }
  ];

  const { evaluateHops } = await import("../src/arb.js");
  const res = evaluateHops(1_000n * U, hops, costs);
  assert.equal(res.hops.length, 2);
  assert.ok(res.expectedProfit > 0n);
  assert.equal(res.intermediates[0].tokenOut, "WMON");
  assert.equal(res.hops[1].tokenOut, "USDC");
});

