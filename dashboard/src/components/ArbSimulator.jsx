import React, { useState, useMemo } from "react";

const ROUTES = [
  {
    id: "triangular-core",
    name: "Triangular Core (USDC ➔ MON ➔ WETH ➔ USDC)",
    hops: ["USDC", "MON", "WETH", "USDC"],
    venues: ["Uniswap V3 (5 bps)", "Ambient DEX (20 bps)", "Uniswap V3 (5 bps)"],
    poolLiquidity: 1500000 // $1.5M pool depth
  },
  {
    id: "ecosystem-meme",
    name: "Ecosystem Alpha (USDC ➔ CHOG ➔ DAK ➔ USDC)",
    hops: ["USDC", "CHOG", "DAK", "USDC"],
    venues: ["Uniswap V2 Style (30 bps)", "UniV2 Style (30 bps)", "Uniswap V3 (30 bps)"],
    poolLiquidity: 600000 // $600k pool depth
  },
  {
    id: "cross-dex-spatial",
    name: "Cross-DEX Spatial (USDC ➔ WBTC ➔ USDC)",
    hops: ["USDC", "WBTC", "USDC"],
    venues: ["Uniswap V3 (0.05%)", "Ambient userCmd (0.05%)"],
    poolLiquidity: 3000000 // $3M pool depth
  }
];

export default function ArbSimulator() {
  const [selectedRouteId, setSelectedRouteId] = useState("triangular-core");
  const [borrowAmount, setBorrowAmount] = useState(15000); // $15,000 USDC
  const [grossSpreadBps, setGrossSpreadBps] = useState(48); // 0.48% gross spread
  const [maxSlippageBps, setMaxSlippageBps] = useState(25); // 0.25% max slippage

  const currentRoute = ROUTES.find((r) => r.id === selectedRouteId) || ROUTES[0];

  // Deterministic financial calculation accounting for all frictional losses
  const simulation = useMemo(() => {
    const borrow = Number(borrowAmount);
    const spread = Number(grossSpreadBps) / 10000;
    const grossRevenue = borrow * (1 + spread);
    const grossProfit = grossRevenue - borrow;

    // Venue Fees (estimate based on route hops)
    const hopFeeBps = currentRoute.id === "ecosystem-meme" ? 30 * 3 : 15 * currentRoute.venues.length;
    const totalDEXFees = borrow * (hopFeeBps / 10000);

    // Constant Product AMM Price Impact Model: impact ≈ borrow / (2 * poolLiquidity)
    const priceImpactRatio = borrow / (2 * currentRoute.poolLiquidity);
    const priceImpactCost = borrow * priceImpactRatio;

    // Monad High-Throughput Gas Model (10k TPS, ~180k gas units at 0.001 Gwei)
    const monadGasCostUSD = 0.00045; // Sub-cent on Monad!

    // Net Profit Calculation
    const totalExpenses = totalDEXFees + priceImpactCost + monadGasCostUSD;
    const netProfit = grossProfit - totalExpenses;
    const netYieldBps = (netProfit / borrow) * 10000;

    // Risk Sentinel Invariant Checks
    const maxBorrowAllowed = 50000; // $50,000 USDC cap in RiskExecutor
    const isUnderCap = borrow <= maxBorrowAllowed;
    const isImpactWithinSlippage = (priceImpactRatio * 10000) <= maxSlippageBps;
    const isProfitable = netProfit > 0;

    let decisionStatus = "APPROVED";
    let decisionReason = "All deterministic on-chain invariants verified. Calldata validated.";
    if (!isUnderCap) {
      decisionStatus = "REJECTED";
      decisionReason = `Exceeds max single-trade cap of $${maxBorrowAllowed.toLocaleString()} USDC (RiskExecutor Invariant).`;
    } else if (!isImpactWithinSlippage) {
      decisionStatus = "REJECTED";
      decisionReason = `Price impact (${(priceImpactRatio * 100).toFixed(3)}%) exceeds max allowed slippage (${(maxSlippageBps / 100).toFixed(2)}%).`;
    } else if (!isProfitable) {
      decisionStatus = "REJECTED";
      decisionReason = "Net return negative after DEX venue fees and price impact. Agent halts submission.";
    }

    // Mock Calldata representation for RiskExecutor
    const mockCalldata = `0x29c74f1b` +
      `000000000000000000000000${(borrow * 1e6).toString(16).padStart(64, "0")}` +
      `000000000000000000000000${Math.floor(Math.max(0, (borrow + netProfit) * 1e6)).toString(16).padStart(64, "0")}`;

    return {
      borrow,
      grossProfit,
      totalDEXFees,
      priceImpactCost,
      priceImpactPct: (priceImpactRatio * 100).toFixed(3),
      monadGasCostUSD,
      netProfit,
      netYieldBps: netYieldBps.toFixed(1),
      decisionStatus,
      decisionReason,
      mockCalldata
    };
  }, [selectedRouteId, borrowAmount, grossSpreadBps, maxSlippageBps, currentRoute]);

  return (
    <div className="glass-card" style={{ padding: "32px", border: "1px solid rgba(131, 110, 249, 0.35)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "24px" }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <span className="pulse-purple"></span>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.08em", color: "var(--monad-purple)", textTransform: "uppercase" }}>
              Interactive Engine Sandbox
            </span>
          </div>
          <h3 style={{ fontSize: "1.6rem", margin: 0 }}>Cyclic Arbitrage & Invariant Simulator</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.92rem", marginTop: "4px" }}>
            Evaluate how Warden calculates net profits across multi-hop DEX routes with on-chain risk guardrails.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          {ROUTES.map((route) => (
            <button
              key={route.id}
              onClick={() => setSelectedRouteId(route.id)}
              style={{
                background: selectedRouteId === route.id ? "rgba(131, 110, 249, 0.25)" : "rgba(255, 255, 255, 0.04)",
                color: selectedRouteId === route.id ? "#ffffff" : "var(--text-secondary)",
                border: selectedRouteId === route.id ? "1px solid var(--monad-purple)" : "1px solid var(--border-hairline)",
                padding: "8px 14px",
                borderRadius: "10px",
                fontSize: "0.82rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
            >
              {route.id === "triangular-core" ? "Triangular (Core)" : route.id === "ecosystem-meme" ? "Ecosystem Alpha" : "Spatial (WBTC)"}
            </button>
          ))}
        </div>
      </div>

      {/* Simulator Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "28px" }}>
        {/* Controls Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Active Route Blueprint */}
          <div style={{ background: "rgba(10, 12, 18, 0.6)", padding: "16px", borderRadius: "12px", border: "1px solid var(--border-hairline)" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", marginBottom: "8px" }}>
              Active Multi-Hop Route
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              {currentRoute.hops.map((hop, idx) => (
                <React.Fragment key={idx}>
                  <span style={{ background: "rgba(131, 110, 249, 0.15)", color: "#c7bdff", padding: "4px 10px", borderRadius: "6px", fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: "0.85rem" }}>
                    {hop}
                  </span>
                  {idx < currentRoute.hops.length - 1 && (
                    <span style={{ color: "var(--monad-purple)", fontSize: "0.9rem" }}>➔</span>
                  )}
                </React.Fragment>
              ))}
            </div>
            <div style={{ marginTop: "10px", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              Venues: <span style={{ color: "#ffffff" }}>{currentRoute.venues.join(" • ")}</span>
            </div>
          </div>

          {/* Borrow Size Slider */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <label style={{ fontSize: "0.88rem", fontWeight: 600 }}>Flash Borrow Capital</label>
              <span className="font-mono" style={{ color: "#ffffff", fontWeight: 700 }}>
                ${Number(borrowAmount).toLocaleString()} USDC
              </span>
            </div>
            <input
              type="range"
              min="1000"
              max="75000"
              step="1000"
              value={borrowAmount}
              onChange={(e) => setBorrowAmount(e.target.value)}
              style={{ width: "100%", accentColor: "var(--monad-purple)", cursor: "pointer" }}
            />
            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
              {[5000, 15000, 30000, 50000, 60000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setBorrowAmount(amt)}
                  style={{
                    background: "rgba(255, 255, 255, 0.04)",
                    border: "1px solid var(--border-hairline)",
                    color: borrowAmount === amt ? "var(--monad-purple)" : "var(--text-tertiary)",
                    borderRadius: "6px",
                    padding: "3px 8px",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                    fontFamily: "var(--font-mono)"
                  }}
                >
                  ${amt / 1000}k
                </button>
              ))}
            </div>
          </div>

          {/* Gross Spread Slider */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <label style={{ fontSize: "0.88rem", fontWeight: 600 }}>Gross Price Spread Discrepancy</label>
              <span className="font-mono" style={{ color: "#ffffff", fontWeight: 700 }}>
                {grossSpreadBps} bps ({(grossSpreadBps / 100).toFixed(2)}%)
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="150"
              step="2"
              value={grossSpreadBps}
              onChange={(e) => setGrossSpreadBps(e.target.value)}
              style={{ width: "100%", accentColor: "var(--monad-purple)", cursor: "pointer" }}
            />
          </div>

          {/* Slippage Floor */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <label style={{ fontSize: "0.88rem", fontWeight: 600 }}>Max Permitted Slippage Floor</label>
              <span className="font-mono" style={{ color: "#ffffff", fontWeight: 700 }}>
                {maxSlippageBps} bps ({(maxSlippageBps / 100).toFixed(2)}%)
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="60"
              step="5"
              value={maxSlippageBps}
              onChange={(e) => setMaxSlippageBps(e.target.value)}
              style={{ width: "100%", accentColor: "var(--monad-purple)", cursor: "pointer" }}
            />
          </div>
        </div>

        {/* Results & Verification Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Decision Sentinel Banner */}
          <div
            style={{
              padding: "16px 20px",
              borderRadius: "12px",
              background: simulation.decisionStatus === "APPROVED" ? "rgba(16, 185, 129, 0.12)" : "rgba(244, 63, 94, 0.12)",
              border: simulation.decisionStatus === "APPROVED" ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(244, 63, 94, 0.4)",
              display: "flex",
              alignItems: "flex-start",
              gap: "14px"
            }}
          >
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                background: simulation.decisionStatus === "APPROVED" ? "#10b981" : "#f43f5e",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: "0.9rem",
                flexShrink: 0
              }}
            >
              {simulation.decisionStatus === "APPROVED" ? "✓" : "!"}
            </div>
            <div>
              <div style={{ fontSize: "0.95rem", fontWeight: 700, color: simulation.decisionStatus === "APPROVED" ? "#34d399" : "#fb7185" }}>
                Risk Sentinel: {simulation.decisionStatus}
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                {simulation.decisionReason}
              </div>
            </div>
          </div>

          {/* Breakdown Table */}
          <div style={{ background: "rgba(10, 12, 18, 0.7)", padding: "18px", borderRadius: "12px", border: "1px solid var(--border-hairline)" }}>
            <div style={{ fontSize: "0.78rem", color: "var(--text-tertiary)", fontWeight: 700, textTransform: "uppercase", marginBottom: "12px" }}>
              Frictional Loss & Net Accounting
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "0.88rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary)" }}>Gross Spread Revenue:</span>
                <span className="font-mono" style={{ color: "#34d399", fontWeight: 600 }}>
                  +${simulation.grossProfit.toFixed(2)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary)" }}>DEX Venue Protocol Fees:</span>
                <span className="font-mono" style={{ color: "#fb7185" }}>
                  -${simulation.totalDEXFees.toFixed(2)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary)" }}>AMM Price Impact ({simulation.priceImpactPct}%):</span>
                <span className="font-mono" style={{ color: "#fb7185" }}>
                  -${simulation.priceImpactCost.toFixed(2)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary)" }}>Monad Consensus Gas (~180k gas @ 0.001 Gwei):</span>
                <span className="font-mono" style={{ color: "#38bdf8" }}>
                  -${simulation.monadGasCostUSD.toFixed(5)}
                </span>
              </div>

              <div style={{ height: "1px", background: "var(--border-hairline)", margin: "4px 0" }} />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, color: "#ffffff" }}>Net Vault Profit:</span>
                <div style={{ textAlign: "right" }}>
                  <div className="font-mono" style={{ fontSize: "1.2rem", fontWeight: 800, color: simulation.netProfit >= 0 ? "#10b981" : "#f43f5e" }}>
                    {simulation.netProfit >= 0 ? "+" : ""}${simulation.netProfit.toFixed(2)} USDC
                  </div>
                  <div className="font-mono" style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                    Net Yield: {simulation.netYieldBps} bps
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Generated On-Chain Payload Snippet */}
          <div style={{ background: "rgba(5, 6, 9, 0.9)", padding: "14px", borderRadius: "10px", border: "1px solid rgba(131, 110, 249, 0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <span style={{ fontSize: "0.72rem", color: "var(--monad-purple)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                RISK_EXECUTOR_CALLDATA
              </span>
              <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)" }}>
                Atomic 1-Tx Execution
              </span>
            </div>
            <div className="font-mono" style={{ fontSize: "0.72rem", color: "rgba(255, 255, 255, 0.75)", wordBreak: "break-all" }}>
              {simulation.mockCalldata}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
