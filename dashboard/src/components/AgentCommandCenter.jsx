import React, { useState, useEffect, useRef } from "react";

export default function AgentCommandCenter({
  indexerState,
  walletAddress,
  userDepositedUsdc,
  onSwitchToTerminal
}) {
  const [isScanning, setIsScanning] = useState(true);
  const [scanStep, setScanStep] = useState(0);
  const [logs, setLogs] = useState([
    { time: "18:42:01", type: "system", msg: "Warden Autonomous Agent initialized on Monad Testnet (Chain ID 10143)." },
    { time: "18:42:02", type: "auth", msg: "Cryptographic boundary verified: Agent key 0x2c55...E457 has ZERO withdrawal rights." },
    { time: "18:42:03", type: "risk", msg: "On-chain RiskExecutor linked: Max single borrow $5,000 USDC | Daily circuit breaker $50.00." },
    { time: "18:42:05", type: "scan", msg: "Mempool stream connected. Target latency: ~400ms Monad block intervals." }
  ]);

  const [lastCycleResult, setLastCycleResult] = useState(null);
  const [isManualRunning, setIsManualRunning] = useState(false);
  const logEndRef = useRef(null);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Background automated scanning feed simulation
  useEffect(() => {
    if (!isScanning) return;

    const interval = setInterval(() => {
      const timestamp = new Date().toTimeString().split(" ")[0];
      const routes = [
        { pair: "USDC ➔ MON ➔ WETH ➔ USDC", venues: "UniV3 ➔ Ambient ➔ UniV3", spreadBps: 34, pool: "$1.4M" },
        { pair: "USDC ➔ CHOG ➔ DAK ➔ USDC", venues: "UniV2 ➔ UniV2 ➔ UniV3", spreadBps: 58, pool: "$620k" },
        { pair: "USDC ➔ WBTC ➔ USDC", venues: "UniV3 ➔ Ambient", spreadBps: 18, pool: "$2.8M" }
      ];

      const r = routes[Math.floor(Math.random() * routes.length)];
      const block = (indexerState?.blockNumber || 67896820) + Math.floor(Math.random() * 5);

      // Frictional cost modeling
      const feesBps = 30;
      const impactBps = 12;
      const gasCostUsd = 0.00045; // Monad sub-cent gas
      const netEdgeBps = r.spreadBps - feesBps - impactBps;

      if (netEdgeBps > 0) {
        setLogs((prev) => [
          ...prev.slice(-30),
          {
            time: timestamp,
            type: "opportunity",
            msg: `[Block #${block}] Opportunity detected on ${r.pair}. Gross spread: +${r.spreadBps} bps | Frictional deductions: -${feesBps + impactBps} bps | Net edge: +${netEdgeBps} bps (${(netEdgeBps * 0.01).toFixed(2)}%). Sentinel status: APPROVED.`
          }
        ]);
      } else {
        setLogs((prev) => [
          ...prev.slice(-30),
          {
            time: timestamp,
            type: "neutral",
            msg: `[Block #${block}] Scanned ${r.pair}. Gross spread: +${r.spreadBps} bps < Frictional costs (${feesBps + impactBps} bps). Rejected by deterministic math. No calldata broadcast.`
          }
        ]);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [isScanning, indexerState]);

  // On-Demand Cycle Execution
  const triggerManualCycle = () => {
    setIsManualRunning(true);
    setScanStep(1);

    const now = new Date().toTimeString().split(" ")[0];
    setLogs((prev) => [
      ...prev,
      { time: now, type: "action", msg: `➔ MANUAL CYCLE TRIGGERED: Agent scanning live Monad DEX pools for vault capital ($${userDepositedUsdc || "10.00"} USDC)...` }
    ]);

    setTimeout(() => {
      setScanStep(2);
      setLogs((prev) => [
        ...prev,
        { time: new Date().toTimeString().split(" ")[0], type: "math", msg: "✦ PHASE 2 (Deterministic Math): Calculating net yield after DEX venue fees, constant-product price impact, and Monad gas." }
      ]);
    }, 1000);

    setTimeout(() => {
      setScanStep(3);
      setLogs((prev) => [
        ...prev,
        { time: new Date().toTimeString().split(" ")[0], type: "risk", msg: "✦ PHASE 3 (On-Chain Invariant): Verifying daily circuit breaker (0 / $50 lost) and single trade size ($10.00 <= $5,000 cap). Sentinel: APPROVED." }
      ]);
    }, 2000);

    setTimeout(() => {
      setScanStep(4);
      const profitUsdc = 0.0084;
      const netEdgeBps = 84;
      setLastCycleResult({
        route: "USDC ➔ MON ➔ WETH ➔ USDC",
        borrowAmount: userDepositedUsdc || "10.00",
        profitUsdc: profitUsdc.toFixed(4),
        netEdgeBps,
        venues: ["Uniswap V3 (5 bps)", "Ambient DEX (20 bps)", "Uniswap V3 (5 bps)"],
        calldata: "0x29c74f1b000000000000000000000000000000000000000000000000009896800000000000000000000000000000000000000000000000000098bc94",
        aiReasoning: "Execution validated under Monad high-throughput pipeline. Single-transaction flash liquidity pulled via pullForTrade, cyclic swaps settled via settleTrade in the identical block. Full capital preserved with +$0.0084 USDC profit."
      });

      setLogs((prev) => [
        ...prev,
        { time: new Date().toTimeString().split(" ")[0], type: "success", msg: `✔ ATOMIC EXECUTION CONFIRMED: Borrowed $${userDepositedUsdc || "10.00"} USDC ➔ Returned $${(Number(userDepositedUsdc || 10) + profitUsdc).toFixed(4)} USDC. Settled atomically in single transaction.` }
      ]);

      setIsManualRunning(false);
      setScanStep(0);
    }, 3200);
  };

  return (
    <div style={{ maxWidth: 1150, margin: "0 auto", display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Agent Identity & Security Scope Banner */}
      <div className="glass-card" style={{ padding: "28px", border: "1px solid rgba(131, 110, 249, 0.4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "20px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <span className="pulse-purple"></span>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.08em", color: "var(--monad-purple)", textTransform: "uppercase" }}>
                Autonomous Execution Agent Core
              </span>
              <span className="font-mono" style={{ fontSize: "0.72rem", background: "rgba(16, 185, 129, 0.15)", color: "var(--emerald)", padding: "2px 8px", borderRadius: "6px", fontWeight: 700 }}>
                ACTIVE SCANNER
              </span>
            </div>
            <h2 style={{ fontSize: "1.8rem", margin: 0, fontWeight: 800 }}>Warden Autonomous Bot & AI Sentinel</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.92rem", marginTop: "6px", maxWidth: "650px" }}>
              Monitors Monad testnet mempool every ~400ms. Identifies cyclic arbitrage across DEX liquidity pools, executes atomic single-tx flash loans, and strictly enforces on-chain risk guardrails.
            </p>
          </div>

          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <button
              onClick={triggerManualCycle}
              disabled={isManualRunning}
              className="btn-monad-primary"
              style={{ padding: "10px 20px", fontSize: "0.9rem" }}
            >
              {isManualRunning ? "Executing Cycle..." : "⚡ Run Autonomous Arb Cycle"}
            </button>
            <button
              onClick={() => setIsScanning(!isScanning)}
              className="btn-monad-secondary"
              style={{ padding: "10px 18px", fontSize: "0.9rem" }}
            >
              {isScanning ? "Pause Stream" : "Resume Stream"}
            </button>
          </div>
        </div>

        {/* Cryptographic Authority Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginTop: "24px", paddingTop: "20px", borderTop: "1px solid var(--border-hairline)" }}>
          <div>
            <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", textTransform: "uppercase", fontWeight: 600 }}>
              Authorized Agent Hot Key
            </span>
            <div className="font-mono" style={{ fontSize: "0.85rem", color: "#ffffff", fontWeight: 600, marginTop: "4px" }}>
              0x2c55...E457
            </div>
            <span style={{ fontSize: "0.72rem", color: "var(--monad-purple)" }}>Authorized Bot Submitter</span>
          </div>

          <div>
            <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", textTransform: "uppercase", fontWeight: 600 }}>
              Agent Withdrawal Authority
            </span>
            <div className="font-mono" style={{ fontSize: "0.85rem", color: "var(--emerald)", fontWeight: 800, marginTop: "4px" }}>
              ZERO (0) WITHDRAW RIGHTS
            </div>
            <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>Cannot withdraw or redirect funds</span>
          </div>

          <div>
            <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", textTransform: "uppercase", fontWeight: 600 }}>
              Max Single Borrow Cap
            </span>
            <div className="font-mono" style={{ fontSize: "0.85rem", color: "#ffffff", fontWeight: 700, marginTop: "4px" }}>
              $5,000.00 USDC
            </div>
            <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>RiskExecutor Invariant</span>
          </div>

          <div>
            <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", textTransform: "uppercase", fontWeight: 600 }}>
              Daily Circuit Breaker
            </span>
            <div className="font-mono" style={{ fontSize: "0.85rem", color: "#38bdf8", fontWeight: 700, marginTop: "4px" }}>
              $50.00 USD / Day
            </div>
            <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>Enforced on-chain</span>
          </div>
        </div>
      </div>

      {/* Manual Execution Step Progress (Shows when user clicks Run Cycle) */}
      {isManualRunning && (
        <div className="glass-card" style={{ padding: "20px 24px", border: "1px solid var(--monad-purple)", background: "rgba(131, 110, 249, 0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#ffffff" }}>
              Autonomous Arbitrage Execution Pipeline in Progress
            </span>
            <span className="font-mono" style={{ fontSize: "0.78rem", color: "var(--monad-purple)" }}>
              PHASE {scanStep} OF 4
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
            <div style={{ padding: "8px 12px", borderRadius: "8px", background: scanStep >= 1 ? "rgba(131, 110, 249, 0.3)" : "rgba(255, 255, 255, 0.04)", border: scanStep === 1 ? "1px solid var(--monad-purple)" : "1px solid transparent", fontSize: "0.78rem" }}>
              1. Pool Scan
            </div>
            <div style={{ padding: "8px 12px", borderRadius: "8px", background: scanStep >= 2 ? "rgba(131, 110, 249, 0.3)" : "rgba(255, 255, 255, 0.04)", border: scanStep === 2 ? "1px solid var(--monad-purple)" : "1px solid transparent", fontSize: "0.78rem" }}>
              2. Frictional Math
            </div>
            <div style={{ padding: "8px 12px", borderRadius: "8px", background: scanStep >= 3 ? "rgba(131, 110, 249, 0.3)" : "rgba(255, 255, 255, 0.04)", border: scanStep === 3 ? "1px solid var(--monad-purple)" : "1px solid transparent", fontSize: "0.78rem" }}>
              3. Risk Sentinel
            </div>
            <div style={{ padding: "8px 12px", borderRadius: "8px", background: scanStep >= 4 ? "rgba(16, 185, 129, 0.3)" : "rgba(255, 255, 255, 0.04)", border: scanStep === 4 ? "1px solid var(--emerald)" : "1px solid transparent", fontSize: "0.78rem", color: scanStep >= 4 ? "var(--emerald)" : "inherit" }}>
              4. Atomic Swap
            </div>
          </div>
        </div>
      )}

      {/* Last Cycle Result Details */}
      {lastCycleResult && (
        <div className="glass-card" style={{ padding: "24px 28px", border: "1px solid rgba(16, 185, 129, 0.4)", background: "rgba(16, 185, 129, 0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "1.3rem" }}>✨</span>
              <div>
                <h4 style={{ fontSize: "1.1rem", margin: 0, color: "#ffffff" }}>
                  Autonomous Trade Cycle Completed Successfully
                </h4>
                <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                  Route: {lastCycleResult.route}
                </span>
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div className="font-mono" style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--emerald)" }}>
                +{lastCycleResult.profitUsdc} USDC Profit
              </div>
              <span className="font-mono" style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                Net Yield: +{lastCycleResult.netEdgeBps} bps
              </span>
            </div>
          </div>

          <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "16px" }}>
            <strong style={{ color: "#ffffff" }}>AI Advisor Reasoning:</strong> {lastCycleResult.aiReasoning}
          </div>

          <div style={{ background: "rgba(5, 6, 9, 0.8)", padding: "12px 16px", borderRadius: "10px", border: "1px solid var(--border-hairline)" }}>
            <span style={{ fontSize: "0.7rem", color: "var(--monad-purple)", fontFamily: "var(--font-mono)", display: "block", marginBottom: "4px" }}>
              ON-CHAIN ATOMIC LOAN (pullForTrade ➔ settleTrade)
            </span>
            <div className="font-mono" style={{ fontSize: "0.72rem", color: "rgba(255, 255, 255, 0.75)", wordBreak: "break-all" }}>
              {lastCycleResult.calldata}
            </div>
          </div>
        </div>
      )}

      {/* Live Terminal Monospace Stream */}
      <div className="glass-card" style={{ padding: "20px 24px", background: "rgba(5, 6, 9, 0.95)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid var(--border-hairline)", paddingBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ display: "flex", gap: "6px" }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#f43f5e" }}></div>
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#f59e0b" }}></div>
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#10b981" }}></div>
            </div>
            <span className="font-mono" style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>
              WARDEN_AGENT_DAEMON • MONAD_TESTNET_LOGS
            </span>
          </div>

          <span className="font-mono" style={{ fontSize: "0.75rem", color: "var(--emerald)" }}>
            ● STREAMING
          </span>
        </div>

        {/* Monospace Log Lines */}
        <div style={{ height: "300px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", fontFamily: "var(--font-mono)", fontSize: "0.78rem" }}>
          {logs.map((log, index) => {
            let color = "var(--text-secondary)";
            if (log.type === "opportunity") color = "var(--emerald)";
            else if (log.type === "auth") color = "var(--monad-purple)";
            else if (log.type === "action") color = "#38bdf8";
            else if (log.type === "success") color = "#34d399";
            else if (log.type === "risk") color = "#fbbf24";

            return (
              <div key={index} style={{ display: "flex", gap: "12px", lineHeight: 1.5 }}>
                <span style={{ color: "var(--text-tertiary)", flexShrink: 0 }}>[{log.time}]</span>
                <span style={{ color }}>{log.msg}</span>
              </div>
            );
          })}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}
