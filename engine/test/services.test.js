import test from "node:test";
import assert from "node:assert/strict";
import { VaultIndexer } from "../src/indexer.js";
import { AIAgentAdvisor } from "../src/aiAgent.js";

const U = 1_000_000n;

test("VaultIndexer: records deposits, withdrawals, and updates NAV idempotently", () => {
  const indexer = new VaultIndexer({
    rpcUrl: "http://localhost:8545",
    vaultAddress: "0xd9fc6cC979472A5FA52750ae26805462E1638872",
    executorAddress: "0x274f499201b0716e6CB632FF5BEc10cAD508eAD6"
  });

  const depEvent = {
    type: "Deposit",
    txHash: "0xabc1",
    logIndex: 0,
    assets: 10_000n * U,
    shares: 10_000n * U
  };

  assert.equal(indexer.ingestEvent(depEvent), true);
  // Idempotency: replaying same event returns false and does not double-count
  assert.equal(indexer.ingestEvent(depEvent), false);
  assert.equal(indexer.derivedState.nav, 10_000n * U);
  assert.equal(indexer.derivedState.totalSupply, 10_000n * U);
  assert.equal(indexer.getSharePrice(), 1.0);
});

test("VaultIndexer: trade settlement accurately attributes PnL and metrics", () => {
  const indexer = new VaultIndexer({
    rpcUrl: "http://localhost:8545",
    vaultAddress: "0xd9fc6cC979472A5FA52750ae26805462E1638872",
    executorAddress: "0x274f499201b0716e6CB632FF5BEc10cAD508eAD6"
  });

  indexer.ingestEvent({
    type: "TradeStarted",
    txHash: "0x123",
    logIndex: 0,
    amount: 1_000n * U
  });
  assert.equal(indexer.derivedState.inFlight, 1_000n * U);

  indexer.ingestEvent({
    type: "TradeSettled",
    txHash: "0x123",
    logIndex: 1,
    principal: 1_000n * U,
    returned: 1_025n * U,
    pnl: 25n * U,
    timestamp: Date.now()
  });

  assert.equal(indexer.derivedState.inFlight, 0n);
  assert.equal(indexer.derivedState.realizedPnlCumulative, 25n * U);
  assert.equal(indexer.derivedState.tradeCount, 1);
  assert.equal(indexer.derivedState.profitableTrades, 1);
  assert.equal(indexer.getSummary().winRatePct, 100);
});

test("AIAgentAdvisor: triages signals according to net profitability and confidence", () => {
  const advisor = new AIAgentAdvisor({ model: "gemini-3.8-flash" });

  const profitableOpp = {
    amountIn: 1_000n * U,
    grossProfit: 25n * U,
    expectedProfit: 15n * U,
    grossOut: 1_025n * U,
    minAmountOut: 1_020n * U
  };

  const triage = advisor.triageSignal(profitableOpp);
  assert.equal(triage.classification, "actionable");
  assert.equal(triage.recommended_action, "propose_cycle");
  assert.ok(triage.confidence > 0.6);
  assert.ok(triage.evidence.length >= 3);
});

test("AIAgentAdvisor: correctly explains trade rejections due to risk rules", () => {
  const advisor = new AIAgentAdvisor({ model: "gemini-3.8-flash" });

  const rejectionEntry = {
    action: "reject",
    verdict: {
      approved: false,
      reasons: ["circuit-breaker"]
    }
  };

  const explanation = advisor.explainDecision(rejectionEntry);
  assert.equal(explanation.status, "blocked");
  assert.ok(explanation.explanation.includes("circuit breaker"));
});
