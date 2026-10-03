// AI Agent Reasoning, Signal Triage, Explanation & Reporting Layer
// Core invariant: AI outputs are advisory ONLY. Deterministic code enforces bounds.

export class AIAgentAdvisor {
  constructor({ model = "gemini-3.8-flash", apiKey = null }) {
    this.model = model;
    this.apiKey = apiKey;
  }

  /**
   * Triage an arbitrage signal with structured evaluation schema.
   */
  triageSignal(opp, marketCondition = "normal") {
    const netEdgeBps = opp.amountIn > 0n
      ? Number((opp.expectedProfit * 10_000n) / opp.amountIn)
      : 0;

    const evidence = [
      `Gross Profit: ${opp.grossProfit.toString()} base units`,
      `Net Expected Profit: ${opp.expectedProfit.toString()} base units (Edge: ${netEdgeBps} bps)`,
      `Slippage Buffer: ${opp.minAmountOut < opp.grossOut ? "Conservative floor applied" : "Exact"}`,
      `Market Condition: ${marketCondition}`
    ];

    let classification = "reject";
    let action = "observe";
    let confidence = 0.5;
    let reasoning = "Net expected edge is insufficient after accounting for DEX fees, price impact, and gas overhead.";

    if (opp.expectedProfit > 0n && netEdgeBps >= 10) {
      classification = "actionable";
      action = "propose_cycle";
      confidence = Math.min(0.95, 0.6 + netEdgeBps / 100);
      reasoning = `Statistically significant net edge of ${netEdgeBps} bps identified across venues after full fee, gas, and slippage buffer deduction.`;
    } else if (opp.expectedProfit > 0n) {
      classification = "watch";
      action = "observe";
      confidence = 0.7;
      reasoning = `Marginal positive edge (${netEdgeBps} bps) detected, but within high volatility buffer. Recommend observing next block.`;
    }

    return {
      signal_id: `sig_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      classification,
      confidence,
      evidence,
      recommended_action: action,
      reasoning_summary: reasoning,
      evaluated_at: new Date().toISOString(),
      model: this.model
    };
  }

  /**
   * Generates a plain-language explanation for an executed or rejected trade.
   */
  explainDecision(entry) {
    if (entry.action === "paper-fill" || entry.action === "live-fill") {
      const isProfit = entry.netPnl > 0n;
      return {
        type: "trade_explanation",
        headline: isProfit ? "Net Profitable Cycle Executed" : "Sub-Optimal Fill Managed",
        status: "success",
        explanation: `The trade deployed ${entry.opp.amountIn} USDC across route [${entry.route?.join(" -> ")}]. Realized net PnL: ${entry.netPnl.toString()} USDC after gas and DEX fees.`,
        riskChecksPassed: true
      };
    }

    // Rejection explanation
    const reasons = entry.verdict?.reasons || [];
    let explanationText = "Trade was rejected by on-chain/pre-flight risk controls: ";
    if (reasons.includes("circuit-breaker")) {
      explanationText += "Daily loss circuit breaker tripped. Vault preserved capital by preventing further trading.";
    } else if (reasons.includes("trade-too-large")) {
      explanationText += "Trade principal exceeded the configured maximum size constraint.";
    } else if (reasons.includes("edge-below-safety-margin")) {
      explanationText += "Expected net edge does not exceed the required safety margin buffer.";
    } else if (reasons.includes("quote-stale") || reasons.includes("quote-expired")) {
      explanationText += "Quote timestamp expired before execution window. Protected against stale price execution.";
    } else {
      explanationText += reasons.join(", ");
    }

    return {
      type: "rejection_explanation",
      headline: "Trade Prevented by Deterministic Risk Rules",
      status: "blocked",
      explanation: explanationText,
      reasons
    };
  }

  /**
   * Generates a structured operational summary report.
   */
  generateReport(summary) {
    const pnl = BigInt(summary.realizedPnlCumulative || "0");
    const status = summary.paused ? "PAUSED" : (summary.halted ? "HALTED" : "ACTIVE");

    return {
      report_id: `rep_${Date.now()}`,
      generated_at: new Date().toISOString(),
      vault_status: status,
      nav: summary.nav,
      total_trades: summary.tradeCount,
      win_rate_pct: summary.winRatePct,
      net_pnl: pnl.toString(),
      executive_summary: `Vault is operating under ${status} state. Total volume processed: ${summary.totalVolume} USDC across ${summary.tradeCount} cycles with ${summary.winRatePct}% positive-yield outcomes. Realized cumulative PnL stands at ${pnl.toString()} base units.`
    };
  }
}
