// Deterministic off-chain risk check (mirrors on-chain RiskExecutor; on-chain remains authoritative)
// plus paper-trading loop with an append-only decision ledger. No LLM in this path.
import { appendFileSync } from "node:fs";
import { bestSize } from "./arb.js";

export function riskCheck(opp, limits, state, now) {
  const reasons = [];
  if (!opp || opp.expiry == null || opp.quoteTs == null) reasons.push("missing-quote-metadata");
  else {
    if (now > opp.expiry) reasons.push("quote-expired");
    if (now - opp.quoteTs > limits.maxQuoteAgeMs) reasons.push("quote-stale");
  }
  if (opp && opp.amountIn > limits.maxTradeSize) reasons.push("trade-too-large");
  if (opp && opp.amountIn * 10_000n > state.nav * BigInt(limits.maxAllocationBps)) reasons.push("allocation-exceeded");
  if (opp && opp.expectedProfit <= (opp.amountIn * BigInt(limits.safetyMarginBps)) / 10_000n)
    reasons.push("edge-below-safety-margin");
  if (state.lossToday >= limits.maxDailyLoss) reasons.push("circuit-breaker");
  if (state.paused) reasons.push("paused");
  return { approved: reasons.length === 0, reasons };
}

const ser = (o) => JSON.stringify(o, (_, v) => (typeof v === "bigint" ? v.toString() : v));

export class PaperTrader {
  constructor({ limits, costs, logPath = null, strategyId = "paper-arb-v1", initialNav }) {
    this.limits = limits;
    this.costs = costs;
    this.logPath = logPath;
    this.strategyId = strategyId;
    this.state = { nav: initialNav, lossToday: 0n, paused: false };
    this.ledger = [];
  }

  log(entry) {
    this.ledger.push(entry);
    if (this.logPath) appendFileSync(this.logPath, ser(entry) + "\n");
  }

  /** snapshot: { ts, block, buyPool, sellPool, route }. Simulated fill = quoted result (paper). */
  tick(snapshot, now = Date.now()) {
    const best = bestSize(this.limits.maxTradeSize, snapshot.buyPool, snapshot.sellPool, this.costs);
    const opp = best && {
      ...best,
      route: snapshot.route,
      quoteTs: snapshot.ts,
      block: snapshot.block,
      expiry: snapshot.ts + this.limits.quoteTtlMs,
    };
    const verdict = riskCheck(opp, this.limits, this.state, now);
    const base = { ts: now, strategyId: this.strategyId, block: snapshot.block, route: snapshot.route, opp, verdict };
    if (!verdict.approved) {
      this.log({ ...base, action: "reject" });
      return null;
    }
    // Paper fill: net PnL = grossOut - input - gas - overhead (slippage buffer not realized in paper).
    const pnl = opp.grossOut - opp.amountIn - this.costs.gasBase - this.costs.overheadBase;
    this.state.nav += pnl;
    if (pnl < 0n) this.state.lossToday += -pnl;
    this.log({ ...base, action: "paper-fill", grossPnl: opp.grossProfit, gasCost: this.costs.gasBase, netPnl: pnl, navAfter: this.state.nav });
    return pnl;
  }
}
