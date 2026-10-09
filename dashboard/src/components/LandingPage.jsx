import React, { useState } from "react";
import ParticleVortexCanvas from "./ParticleVortexCanvas";
import IsometricVaultCanvas from "./IsometricVaultCanvas";
import ArbSimulator from "./ArbSimulator";

// Authoritative Warden on-chain specifications for the Technical Specs modal
const MODULE_SPECS = {
  vault: {
    id: "vault",
    title: "MonadVault Core (ERC-4626)",
    category: "Non-Custodial Deposit & Share Accounting",
    badge: "Verified Testnet V1",
    address: "0xd9fc6cC979472A5FA52750ae26805462E1638872",
    explorerUrl: "https://testnet.monadscan.com/address/0xd9fc6cC979472A5FA52750ae26805462E1638872",
    description:
      "The authoritative ERC-4626 vault contract holding all user deposits in 6-decimal Circle USDC. Issues 12-decimal mtvUSDC shares using virtual offset to mathematically neutralize inflation front-running attacks. Only the owner can pause; the agent key possesses zero withdrawal authority.",
    securityInvariant: "require(agent != owner) • Atomic flash borrow pullForTrade() • Inflation offset _decimalsOffset() = 6",
    codeSnippet: `// MonadVault.sol (ERC-4626 Invariant)
function pullForTrade(uint256 amount) external onlyExecutor returns (bool) {
    require(!paused(), "VAULT_PAUSED");
    require(amount <= maxTradeBorrowLimit, "EXCEEDS_CAP");
    totalBorrowedLiquidity += amount;
    SafeERC20.safeTransfer(asset(), msg.sender, amount);
    return true;
}

function settleTrade(uint256 repaidAmount) external onlyExecutor {
    require(repaidAmount >= totalBorrowedLiquidity, "INSOLVENT_FLASH_LOOP");
    totalBorrowedLiquidity = 0;
}`,
    stats: [
      { label: "Asset Denomination", value: "USDC (6 decimals)" },
      { label: "Share Token", value: "mtvUSDC (12 decimals)" },
      { label: "Virtual Offset", value: "10^6 Inflation Protection" },
      { label: "Custody Privilege", value: "Non-Custodial (Owner != Agent)" }
    ]
  },
  risk: {
    id: "risk",
    title: "RiskExecutor Sentinel",
    category: "Deterministic On-Chain Circuit Breaker",
    badge: "Mathematical Guardrails",
    address: "0x274f499201b0716e6CB632FF5BEc10cAD508eAD6",
    explorerUrl: "https://testnet.monadscan.com/address/0x274f499201b0716e6CB632FF5BEc10cAD508eAD6",
    description:
      "Hardened execution gateway mediating all agent operations. Tracks rolling 24-hour cumulative drawdowns against a hard-coded 200 bps threshold. Disallows trades exceeding maximum allocation caps and halts execution automatically without waiting for off-chain oracles.",
    securityInvariant: "maxCumulativeLoss24h <= 200 bps • maxAllocationPct <= 20% • Untrusted DEX balance verification",
    codeSnippet: `// RiskExecutor.sol (Circuit Breaker Invariant)
function executeArb(
    address[] calldata routers,
    bytes[] calldata swapData,
    uint256 borrowAmount,
    uint256 minNetOut
) external onlyAgent nonReentrant returns (uint256 netProfit) {
    _enforceDrawdownLimits();
    uint256 preBalance = IERC20(USDC).balanceOf(address(this));
    vault.pullForTrade(borrowAmount);
    
    // Execute hops across untrusted DEX routers
    _dispatchSwaps(routers, swapData);
    
    uint256 postBalance = IERC20(USDC).balanceOf(address(this));
    require(postBalance >= preBalance + borrowAmount + minNetOut, "SLIPPAGE_BREACH");
    vault.settleTrade(borrowAmount);
}`,
    stats: [
      { label: "Daily Drawdown Cap", value: "200 bps (2.0%)" },
      { label: "Max Single Borrow", value: "20% Vault NAV" },
      { label: "Reentrancy Protection", value: "OpenZeppelin ReentrancyGuard" },
      { label: "Execution Privilege", value: "Authorized Bot Key Only" }
    ]
  },
  agent: {
    id: "agent",
    title: "Autonomous Arbitrage Sentinel",
    category: "Deterministic High-Frequency Routing",
    badge: "Sub-Second Monad Loop",
    address: "0x2c55614E7fC28894F55a7169ce0af42FAFF5E457",
    explorerUrl: "https://testnet.monadscan.com/address/0x2c55614E7fC28894F55a7169ce0af42FAFF5E457",
    description:
      "High-throughput autonomous engine polling Monad RPC every ~400ms. Solves cyclic price disparities across Uniswap V3, Curvance, and Ambient. Employs deterministic constant-product math with full venue fee & gas accounting, relegating off-chain AI strictly to post-trade telemetry and explainability.",
    securityInvariant: "Zero withdrawal rights • Atomic 1-tx flash debt loop • Pure deterministic math (no LLM in execution path)",
    codeSnippet: `// Autonomous Agent Strategy Prompt & Invariant Spec
{
  "system": "Warden Monad Arbitrage Engine",
  "executionMode": "Deterministic Sub-Second Loop",
  "targetChain": "Monad Testnet (Chain ID 10143)",
  "venues": ["Uniswap V3", "Curvance", "Ambient"],
  "rules": [
    "Deduct 30 bps pool fee per hop",
    "Calculate price impact using constant product x * y = k",
    "Reject trade if grossSpread <= venueFees + gasEstimate",
    "Require netYield >= minThreshold (15 bps)"
  ]
}`,
    stats: [
      { label: "Cycle Frequency", value: "~400ms Monad Target" },
      { label: "Math Engine", value: "Deterministic XYK" },
      { label: "AI Role", value: "Post-Trade Advisory & Triage" },
      { label: "Withdrawal Authority", value: "0x00 (Forbidden)" }
    ]
  },
  usdc: {
    id: "usdc",
    title: "Circle USDC (Testnet)",
    category: "Verified Base Asset",
    badge: "Official Circle Contract",
    address: "0x534b2f3A21130d7a60830c2Df862319e593943A3",
    explorerUrl: "https://testnet.monadscan.com/token/0x534b2f3A21130d7a60830c2Df862319e593943A3",
    description:
      "The official Circle USDC token contract deployed on Monad Testnet with 6 decimals. Forms the foundational single-denomination underlying asset of the vault, ensuring zero cross-currency liquidation risk.",
    securityInvariant: "Standard ERC-20 with 6 decimals • Clean uint256 safeTransfer checks",
    codeSnippet: `// IERC20 Underlying Asset
address public constant USDC = 0x534b2f3A21130d7a60830c2Df862319e593943A3;
uint8 public constant DECIMALS = 6;`,
    stats: [
      { label: "Decimals", value: "6" },
      { label: "Standard", value: "ERC-20 Fiat-Backed" },
      { label: "Deployer", value: "Circle Official" },
      { label: "Vault Usage", value: "Primary Underlying Asset" }
    ]
  }
};

export default function LandingPage({ onLaunchApp, onOpenAgent, indexerState, indexerOnline }) {
  const [activeModalSpec, setActiveModalSpec] = useState(null);
  const [copiedAddress, setCopiedAddress] = useState(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [simCycleActive, setSimCycleActive] = useState(false);
  const [simStep, setSimStep] = useState(0); // 0: idle, 1: flash borrow, 2: swap hop 1, 3: swap hop 2, 4: verified settlement
  const [activeAgentTab, setActiveAgentTab] = useState("pipeline"); // "pipeline" | "prompt"
  const [simLog, setSimLog] = useState([
    "Initialized Monad RPC listener on chainId 10143",
    "Connected to MonadVault @ 0xd9fc6c...8872",
    "Mempool scanner synced • polling block height ~400ms"
  ]);

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    if (key === "prompt") {
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } else {
      setCopiedAddress(key);
      setTimeout(() => setCopiedAddress(null), 2000);
    }
  };

  const triggerSimulatedCycle = () => {
    if (simCycleActive) return;
    setSimCycleActive(true);
    setSimStep(1);
    
    // Step 1: Scan Monad Mempool & Pull Flash Debt
    setSimLog((prev) => [
      `[00:00.040] [RPC ~400ms] Scanning Monad testnet mempool #14,892,104...`,
      `[00:00.085] [FLASH_PULL] pullForTrade(10.00 USDC) initiated from MonadVault`,
      ...prev.slice(0, 6)
    ]);

    // Step 2: Swap Hop 1 on Uniswap V3
    setTimeout(() => {
      setSimStep(2);
      setSimLog((prev) => [
        `[00:00.220] [HOP_1] UniV3: Buy MON @ 24.81 USDC (fee: -30 bps)`,
        ...prev.slice(0, 6)
      ]);
    }, 450);

    // Step 3: Swap Hop 2 on Ambient & Risk Check
    setTimeout(() => {
      setSimStep(3);
      setSimLog((prev) => [
        `[00:00.380] [HOP_2] Ambient: Sell MON @ 24.93 USDC (spread: +48 bps)`,
        `[00:00.395] [RISK_CHECK] Gross 48 bps - Fees 30 bps - Gas 2 bps = +16 bps NET (APPROVED)`,
        ...prev.slice(0, 6)
      ]);
    }, 900);

    // Step 4: Single-tx Atomic Settlement
    setTimeout(() => {
      setSimStep(4);
      setSimLog((prev) => [
        `[00:00.418] [SETTLE] settleTrade() verified in 1-Tx • Vault balance +$0.16 USDC`,
        ...prev.slice(0, 6)
      ]);
    }, 1350);

    // Reset back to idle state
    setTimeout(() => {
      setSimCycleActive(false);
      setSimStep(0);
    }, 3200);
  };

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div style={{ position: "relative", zIndex: 1, width: "100%" }}>
      {/* =========================================================================
          HERO STAGE: BORDERLESS NATIVE 3D VORTEX (EDGE-TO-EDGE FULL BLEED)
         ========================================================================= */}
      <section className="anchor-stage" style={{ width: "100%", minHeight: "86vh", position: "relative", marginBottom: "80px", overflow: "hidden" }}>
        {/* Pure Native 3D Particle Vortex & Concentric Water Ripple Canvas */}
        <ParticleVortexCanvas />

        {/* Cinematic Vignette Overlay */}
        <div className="anchor-vignette"></div>

        {/* ---------------------------------------------------------------------
            BOTTOM SPLIT HERO CONTENT (SPANS LUXURIOUS 1600px WITH EDGE COMFORT)
           --------------------------------------------------------------------- */}
        <div style={{ maxWidth: 1600, margin: "0 auto", padding: "60px 48px 36px", width: "100%", marginTop: "auto", position: "relative", zIndex: 10 }}>
          <div className="hero-split-row">
            {/* Bottom-Left: Pill Badge + Pixel Display Title */}
            <div>
              <div className="anchor-badge-pill" style={{ marginBottom: "14px" }}>
                <span className="anchor-purple-dot"></span>
                <span>ZERO-CUSTODY SENTINEL</span>
              </div>

              {/* Giant Pixel Display Typography */}
              <h1 className="anchor-pixel-headline" style={{ margin: 0 }}>
                Autonomous<br />
                Trading<br />
                Operations
              </h1>
            </div>

            {/* Bottom-Right: Clean, Punchy Copy + Dual Pill Buttons with generous edge margin */}
            <div style={{ maxWidth: "520px", paddingRight: "16px" }}>
              <p style={{ fontSize: "1.08rem", color: "rgba(255, 255, 255, 0.88)", lineHeight: 1.6, marginBottom: "24px" }}>
                Deterministic DEX arbitrage powered by sub-second Monad blocks and non-custodial ERC-4626 vaults.
              </p>

              <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
                <button onClick={onLaunchApp} className="anchor-purple-btn">
                  <span>Enter Vault Terminal</span>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                </button>
                <a
                  href="https://youtu.be/z7WPtDbIuNA"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="anchor-white-btn"
                  style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "8px" }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10 8.64L15.27 12 10 15.36V8.64M8 5v14l11-7L8 5z"/>
                  </svg>
                  <span>Watch Walkthrough</span>
                </a>
                <button onClick={() => setActiveModalSpec(MODULE_SPECS.vault)} className="anchor-white-btn">
                  <span>View Specs</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          EXPANSIVE CONTENT CONTAINER: 1600px Max-Width for Generous Card Breathing Room
         ========================================================================= */}
      <div style={{ maxWidth: 1600, margin: "0 auto", padding: "0 48px 80px", width: "100%" }}>
        {/* INTERACTIVE MODULE SHOWCASE (FULL-WIDTH 2-COLUMN BALANCED GRID) */}
        <section id="vault-section" className="vault-showcase-grid" style={{ marginBottom: "80px" }}>
          
          {/* CARD 1: 3D ISOMETRIC VAULT CANVAS */}
          <div className="motionsites-card" style={{ padding: "28px", background: "#06080e", borderColor: "rgba(131, 110, 249, 0.22)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span className="pulse-purple"></span>
                  <span style={{ fontSize: "0.72rem", color: "var(--monad-purple)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.08em" }}>
                    CORE CONTRACT MESH
                  </span>
                </div>
                <h3 style={{ fontSize: "1.45rem", fontWeight: 800 }}>MonadVault ERC-4626 Core</h3>
                <p style={{ fontSize: "0.86rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                  Virtual offset protection against inflation attacks • 12-decimal mtvUSDC shares
                </p>
              </div>

              <button
                onClick={() => setActiveModalSpec(MODULE_SPECS.vault)}
                className="btn-motionsites-secondary"
                style={{ padding: "6px 14px", fontSize: "0.78rem" }}
              >
                Inspect Specs ↗
              </button>
            </div>

            {/* 3D Wireframe Canvas Frame */}
            <div className="motionsites-preview-frame" style={{ minHeight: "440px", position: "relative" }}>
              <IsometricVaultCanvas />
            </div>
          </div>

        {/* CARD 2: AGENT SENTINEL PROMPT & EXECUTION CONSOLE */}
        <div id="risk-section" className="motionsites-card" style={{ padding: "28px", background: "#06080e", borderColor: "rgba(131, 110, 249, 0.22)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <span className="pulse-purple"></span>
                <span style={{ fontSize: "0.72rem", color: "var(--monad-purple)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.08em" }}>
                  AUTONOMOUS RADAR
                </span>
              </div>
              <h3 style={{ fontSize: "1.45rem", fontWeight: 800 }}>Agent Sentinel Console</h3>
              <p style={{ fontSize: "0.86rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                Sub-second cyclic arbitrage loop with mathematical risk checks
              </p>
            </div>

            <button
              onClick={() => setActiveModalSpec(MODULE_SPECS.agent)}
              className="btn-motionsites-secondary"
              style={{ padding: "6px 14px", fontSize: "0.78rem" }}
            >
              Inspect Spec ↗
            </button>
          </div>

          {/* Real-time Sentinel Metric HUD Tiles */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "14px" }}>
            <div className="sentinel-hud-tile">
              <span style={{ fontSize: "0.68rem", color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>LATENCY</span>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--monad-purple)", fontFamily: "var(--font-mono)" }}>~400ms</span>
            </div>
            <div className="sentinel-hud-tile">
              <span style={{ fontSize: "0.68rem", color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>CIRCUIT</span>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#ffffff", fontFamily: "var(--font-mono)" }}>200 bps</span>
            </div>
            <div className="sentinel-hud-tile">
              <span style={{ fontSize: "0.68rem", color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>CUSTODY</span>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#ffffff", fontFamily: "var(--font-mono)" }}>Zero Auth</span>
            </div>
            <div className="sentinel-hud-tile">
              <span style={{ fontSize: "0.68rem", color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>INVARIANT</span>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--monad-purple)", fontFamily: "var(--font-mono)" }}>Net &gt; Gas</span>
            </div>
          </div>

          {/* Sub-Tabs: Pipeline vs Spec */}
          <div style={{ display: "flex", gap: "6px", marginBottom: "12px", background: "rgba(14, 16, 24, 0.7)", padding: "3px", borderRadius: "10px", width: "fit-content" }}>
            <button
              onClick={() => setActiveAgentTab("pipeline")}
              style={{
                background: activeAgentTab === "pipeline" ? "#1e1a38" : "transparent",
                border: activeAgentTab === "pipeline" ? "1px solid rgba(131, 110, 249, 0.4)" : "1px solid transparent",
                color: activeAgentTab === "pipeline" ? "#ffffff" : "var(--text-tertiary)",
                borderRadius: "8px",
                padding: "4px 12px",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
            >
              1-Tx Arbitrage Pipeline
            </button>
            <button
              onClick={() => setActiveAgentTab("prompt")}
              style={{
                background: activeAgentTab === "prompt" ? "#1e1a38" : "transparent",
                border: activeAgentTab === "prompt" ? "1px solid rgba(131, 110, 249, 0.4)" : "1px solid transparent",
                color: activeAgentTab === "prompt" ? "#ffffff" : "var(--text-tertiary)",
                borderRadius: "8px",
                padding: "4px 12px",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
            >
              Strategy Prompt Spec
            </button>
          </div>

          {/* View Mode 1: 4-Stage Arbitrage Route Pipeline */}
          {activeAgentTab === "pipeline" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", marginBottom: "14px" }}>
              <div className={`pipeline-step-node ${simStep === 1 ? "active-step" : ""}`}>
                <div className="pipeline-step-badge">1</div>
                <div>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#ffffff" }}>Vault Flash Pull</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--monad-purple)", fontFamily: "var(--font-mono)" }}>pullForTrade(10 USDC)</div>
                </div>
              </div>

              <div className={`pipeline-step-node ${simStep === 2 ? "active-step" : ""}`}>
                <div className="pipeline-step-badge">2</div>
                <div>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#ffffff" }}>Hop 1: Uniswap V3</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>USDC ➔ MON (-30 bps)</div>
                </div>
              </div>

              <div className={`pipeline-step-node ${simStep === 3 ? "active-step" : ""}`}>
                <div className="pipeline-step-badge">3</div>
                <div>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#ffffff" }}>Hop 2: Ambient DEX</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>MON ➔ USDC (+48 bps)</div>
                </div>
              </div>

              <div className={`pipeline-step-node ${simStep === 4 ? "active-step" : ""}`}>
                <div className="pipeline-step-badge">4</div>
                <div>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#ffffff" }}>Atomic Risk Settle</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--monad-purple)", fontFamily: "var(--font-mono)" }}>settleTrade() (+16 bps Net)</div>
                </div>
              </div>
            </div>
          ) : (
            /* View Mode 2: Prompt Specification Box */
            <div style={{ background: "#030508", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "14px", padding: "14px", marginBottom: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "0.72rem", color: "var(--monad-purple)", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                  [AGENT_EXECUTION_PROMPT]
                </span>
                <button
                  onClick={() => copyToClipboard(MODULE_SPECS.agent.codeSnippet, "prompt")}
                  style={{ background: "none", border: "none", color: copiedPrompt ? "var(--monad-purple)" : "var(--text-tertiary)", fontSize: "0.75rem", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                >
                  {copiedPrompt ? "Copied" : "Copy Spec"}
                </button>
              </div>
              <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.5, margin: 0, fontFamily: "var(--font-mono)" }}>
                "Scan Monad orderbooks for cyclic price disparity &gt; poolFees (30 bps) + gas. Execute single-tx flash borrow via RiskExecutor. Zero gross-spread fallacy."
              </p>
            </div>
          )}

          {/* Live Terminal Telemetry Box */}
          <div style={{ background: "#020305", borderRadius: "14px", padding: "14px", border: "1px solid rgba(131, 110, 249, 0.25)", minHeight: "140px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", borderBottom: "1px solid var(--border-hairline)", paddingBottom: "6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "rgba(131, 110, 249, 0.5)" }}></span>
                <span style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
                  TELEMETRY STREAM • DAEMON_10143
                </span>
              </div>
              <span className="font-mono" style={{ fontSize: "0.7rem", color: simCycleActive ? "var(--monad-purple)" : "var(--text-tertiary)" }}>
                {simCycleActive ? `CYCLE STEP ${simStep}/4 ACTIVE` : "LATENCY: ~400ms"}
              </span>
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: 1.6, maxHeight: "105px", overflowY: "auto" }}>
              {simLog.map((log, idx) => (
                <div key={idx} style={{ color: log.includes("SETTLE") || log.includes("APPROVED") ? "var(--monad-purple)" : log.includes("HOP") ? "#ffffff" : "inherit" }}>
                  {log}
                </div>
              ))}
              <span className="cursor-blink" />
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
            <button
              onClick={triggerSimulatedCycle}
              disabled={simCycleActive}
              className="btn-motionsites-secondary"
              style={{ flex: 1, padding: "10px", fontSize: "0.82rem", borderColor: simCycleActive ? "var(--monad-purple)" : undefined }}
            >
              {simCycleActive ? `Executing Step ${simStep}/4...` : "Trigger 1-Click Cycle"}
            </button>
            <button
              onClick={onOpenAgent}
              className="anchor-purple-btn"
              style={{ flex: 1, padding: "10px", fontSize: "0.82rem" }}
            >
              <span>Open Full Agent</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          THE FOUR DETERMINISTIC RISK PILLARS
         ========================================================================= */}
      <section id="pillars-section" style={{ marginBottom: "80px" }}>
        <div className="motionsites-card" style={{ width: "100%", padding: "36px 32px", background: "#06080e", borderColor: "rgba(131, 110, 249, 0.2)" }}>
          <div style={{ textAlign: "center", maxWidth: "680px", margin: "0 auto 32px" }}>
            <div className="anchor-badge-pill" style={{ marginBottom: "12px" }}>
              MATHEMATICAL SECURITY BOUNDARIES
            </div>
            <h3 style={{ fontSize: "1.9rem", fontWeight: 800 }}>The Four Deterministic Risk Pillars</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", marginTop: "6px" }}>
              Unlike naive trading bots where an off-chain API holds private keys to user deposits, Warden establishes an unbreachable boundary directly in Solidity.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "20px" }}>
            <div style={{ background: "rgba(10, 14, 24, 0.6)", padding: "20px", borderRadius: "18px", border: "1px solid var(--border-hairline)" }}>
              <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "rgba(131, 110, 249, 0.12)", border: "1px solid var(--monad-purple)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "14px" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--monad-purple)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <h4 style={{ fontSize: "1.1rem", marginBottom: "8px" }}>Zero-Custody Agent</h4>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                The agent hot key holds <strong style={{ color: "#ffffff" }}>zero withdrawal authority</strong>. By enforcing <code className="font-mono" style={{ color: "var(--monad-purple)" }}>require(agent != owner)</code>, the bot cannot withdraw funds or alter its own risk caps.
              </p>
            </div>

            <div style={{ background: "rgba(10, 14, 24, 0.6)", padding: "20px", borderRadius: "18px", border: "1px solid var(--border-hairline)" }}>
              <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "rgba(131, 110, 249, 0.12)", border: "1px solid var(--monad-purple)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "14px" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--monad-purple)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
              <h4 style={{ fontSize: "1.1rem", marginBottom: "8px" }}>Atomic Single-Tx Liquidity</h4>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                Capital is borrowed via <code className="font-mono" style={{ color: "var(--monad-purple)" }}>pullForTrade</code> and settled via <code className="font-mono" style={{ color: "var(--monad-purple)" }}>settleTrade</code> within the exact same transaction. Funds never leave uncollateralized across blocks.
              </p>
            </div>

            <div style={{ background: "rgba(10, 14, 24, 0.6)", padding: "20px", borderRadius: "18px", border: "1px solid var(--border-hairline)" }}>
              <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "rgba(131, 110, 249, 0.12)", border: "1px solid var(--monad-purple)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "14px" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--monad-purple)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <h4 style={{ fontSize: "1.1rem", marginBottom: "8px" }}>Deterministic Circuit Breaker</h4>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                The on-chain <strong style={{ color: "#ffffff" }}>RiskExecutor</strong> tracks rolling 24-hour drawdowns. If cumulative losses exceed the 200 bps threshold, execution automatically halts until the multi-sig Guardian intervenes.
              </p>
            </div>

            <div style={{ background: "rgba(10, 14, 24, 0.6)", padding: "20px", borderRadius: "18px", border: "1px solid var(--border-hairline)" }}>
              <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "rgba(131, 110, 249, 0.12)", border: "1px solid var(--monad-purple)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "14px" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--monad-purple)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
              </div>
              <h4 style={{ fontSize: "1.1rem", marginBottom: "8px" }}>Untrusted Venue Isolation</h4>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                Multi-venue DEX interactions occur via modular <code className="font-mono" style={{ color: "var(--monad-purple)" }}>IDexAdapter</code> contracts. The executor independently measures actual token balances before and after each swap.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          INTERACTIVE ARBITRAGE SIMULATOR SECTION
         ========================================================================= */}
      <section id="simulator-section" style={{ marginBottom: "80px" }}>
        <div style={{ textAlign: "center", maxWidth: "680px", margin: "0 auto 28px" }}>
          <div className="anchor-badge-pill" style={{ marginBottom: "12px" }}>
            MATHEMATICAL ARB ENGINE
          </div>
          <h2 style={{ fontSize: "2.2rem", fontWeight: 800 }}>Interactive Cyclic Simulator</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
            Test arbitrage routing across simulated Monad DEX liquidity pools with venue fee and constant-product slippage deduction.
          </p>
        </div>
        <ArbSimulator />
      </section>

      {/* =========================================================================
          VERIFIED SMART CONTRACTS TABLE (MONAD TESTNET)
         ========================================================================= */}
      <section id="contracts-section" style={{ marginBottom: "80px" }}>
        <div className="motionsites-card" style={{ padding: "32px", background: "#06080e" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "24px" }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <span className="pulse-green"></span>
                <span style={{ fontSize: "0.76rem", fontWeight: 700, letterSpacing: "0.08em", color: "var(--emerald)", textTransform: "uppercase" }}>
                  Verified Monad Testnet Deployments
                </span>
              </div>
              <h3 style={{ fontSize: "1.7rem", fontWeight: 800 }}>On-Chain Contract Registry</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: "4px" }}>
                All contracts are live on Monad Testnet (Chain ID 10143) and verified on Monadscan.
              </p>
            </div>

            <a
              href="https://testnet.monadscan.com"
              target="_blank"
              rel="noreferrer"
              className="btn-motionsites-secondary"
              style={{ fontSize: "0.82rem", padding: "8px 18px" }}
            >
              Open Monadscan Explorer ↗
            </a>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)", textAlign: "left" }}>
                  <th style={{ padding: "12px 16px", color: "var(--text-tertiary)", fontWeight: 600 }}>CONTRACT / ROLE</th>
                  <th style={{ padding: "12px 16px", color: "var(--text-tertiary)", fontWeight: 600 }}>ADDRESS / HASH</th>
                  <th style={{ padding: "12px 16px", color: "var(--text-tertiary)", fontWeight: 600 }}>SECURITY INVARIANT</th>
                  <th style={{ padding: "12px 16px", color: "var(--text-tertiary)", fontWeight: 600, textAlign: "right" }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {/* MonadVault */}
                <tr style={{ borderBottom: "1px solid var(--border-hairline)" }}>
                  <td style={{ padding: "16px", fontWeight: 600, color: "#ffffff" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span>MonadVault (ERC-4626)</span>
                      <span className="font-mono" style={{ background: "var(--emerald-subtle)", color: "var(--emerald)", padding: "2px 6px", borderRadius: "4px", fontSize: "0.7rem", fontWeight: 700 }}>LIVE</span>
                    </div>
                  </td>
                  <td style={{ padding: "16px" }}>
                    <a
                      href="https://testnet.monadscan.com/address/0xd9fc6cC979472A5FA52750ae26805462E1638872"
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono"
                      style={{ color: "#38bdf8", textDecoration: "none" }}
                    >
                      0xd9fc6cC979472A5FA52750ae26805462E1638872 ↗
                    </a>
                  </td>
                  <td style={{ padding: "16px", color: "var(--text-secondary)" }}>
                    Owns user deposits; virtual offset against inflation; zero agent custody.
                  </td>
                  <td style={{ padding: "16px", textAlign: "right" }}>
                    <button
                      onClick={() => copyToClipboard("0xd9fc6cC979472A5FA52750ae26805462E1638872", "vault")}
                      className="btn-motionsites-secondary"
                      style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                    >
                      {copiedAddress === "vault" ? "Copied" : "Copy"}
                    </button>
                  </td>
                </tr>

                {/* RiskExecutor */}
                <tr style={{ borderBottom: "1px solid var(--border-hairline)" }}>
                  <td style={{ padding: "16px", fontWeight: 600, color: "#ffffff" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span>RiskExecutor</span>
                      <span className="font-mono" style={{ background: "rgba(131, 110, 249, 0.15)", color: "var(--monad-purple)", padding: "2px 6px", borderRadius: "4px", fontSize: "0.7rem", fontWeight: 700 }}>LIVE</span>
                    </div>
                  </td>
                  <td style={{ padding: "16px" }}>
                    <a
                      href="https://testnet.monadscan.com/address/0x274f499201b0716e6CB632FF5BEc10cAD508eAD6"
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono"
                      style={{ color: "var(--monad-purple)", textDecoration: "none" }}
                    >
                      0x274f499201b0716e6CB632FF5BEc10cAD508eAD6 ↗
                    </a>
                  </td>
                  <td style={{ padding: "16px", color: "var(--text-secondary)" }}>
                    Autonomous execution module; strictly enforces 200 bps 24h drawdown limit.
                  </td>
                  <td style={{ padding: "16px", textAlign: "right" }}>
                    <button
                      onClick={() => copyToClipboard("0x274f499201b0716e6CB632FF5BEc10cAD508eAD6", "risk")}
                      className="btn-motionsites-secondary"
                      style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                    >
                      {copiedAddress === "risk" ? "Copied" : "Copy"}
                    </button>
                  </td>
                </tr>

                {/* Circle USDC */}
                <tr style={{ borderBottom: "1px solid var(--border-hairline)" }}>
                  <td style={{ padding: "16px", fontWeight: 600, color: "#ffffff" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span>Official Circle USDC</span>
                      <span className="font-mono" style={{ background: "rgba(131, 110, 249, 0.15)", color: "var(--monad-purple)", padding: "2px 6px", borderRadius: "4px", fontSize: "0.7rem", fontWeight: 700 }}>CIRCLE</span>
                    </div>
                  </td>
                  <td style={{ padding: "16px" }}>
                    <a
                      href="https://testnet.monadscan.com/token/0x534b2f3A21130d7a60830c2Df862319e593943A3"
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono"
                      style={{ color: "var(--monad-purple)", textDecoration: "none" }}
                    >
                      0x534b2f3A21130d7a60830c2Df862319e593943A3 ↗
                    </a>
                  </td>
                  <td style={{ padding: "16px", color: "var(--text-secondary)" }}>
                    Base denomination token from Circle's official Monad deployment (6 decimals).
                  </td>
                  <td style={{ padding: "16px", textAlign: "right" }}>
                    <button
                      onClick={() => copyToClipboard("0x534b2f3A21130d7a60830c2Df862319e593943A3", "usdc")}
                      className="btn-motionsites-secondary"
                      style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                    >
                      {copiedAddress === "usdc" ? "Copied" : "Copy"}
                    </button>
                  </td>
                </tr>

                {/* Agent Hot Key */}
                <tr>
                  <td style={{ padding: "16px", fontWeight: 600, color: "#ffffff" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span>Agent Hot Key (Bot)</span>
                      <span className="font-mono" style={{ background: "rgba(131, 110, 249, 0.15)", color: "#c7bdff", padding: "2px 6px", borderRadius: "4px", fontSize: "0.7rem", fontWeight: 700 }}>AGENT</span>
                    </div>
                  </td>
                  <td style={{ padding: "16px" }}>
                    <span className="font-mono" style={{ color: "var(--text-platinum)" }}>
                      0x2c55614E7fC28894F55a7169ce0af42FAFF5E457
                    </span>
                  </td>
                  <td style={{ padding: "16px", color: "var(--text-secondary)" }}>
                    Zero withdrawal rights; authorized solely to trigger executeArb.
                  </td>
                  <td style={{ padding: "16px", textAlign: "right" }}>
                    <button
                      onClick={() => copyToClipboard("0x2c55614E7fC28894F55a7169ce0af42FAFF5E457", "agent")}
                      className="btn-motionsites-secondary"
                      style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                    >
                      {copiedAddress === "agent" ? "Copied" : "Copy"}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* =========================================================================
          TECHNICAL SPECIFICATIONS MODAL
         ========================================================================= */}
      {activeModalSpec && (
        <div className="motionsites-modal-backdrop" onClick={() => setActiveModalSpec(null)}>
          <div className="motionsites-modal-card" onClick={(e) => e.stopPropagation()}>
            {/* Left Media / Preview Panel */}
            <div style={{ padding: "28px", background: "#0a0c12", display: "flex", flexDirection: "column", justifyContent: "space-between", borderRight: "1px solid var(--border-hairline)" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <span className="anchor-badge-pill">
                    {activeModalSpec.badge}
                  </span>
                  <span className="font-mono" style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                    CHAIN ID: 10143
                  </span>
                </div>

                <h3 style={{ fontSize: "1.7rem", fontWeight: 800, marginBottom: "6px" }}>
                  {activeModalSpec.title}
                </h3>
                <span style={{ fontSize: "0.85rem", color: "var(--monad-purple)", display: "block", marginBottom: "18px" }}>
                  {activeModalSpec.category}
                </span>

                <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "20px" }}>
                  {activeModalSpec.description}
                </p>

                {/* Security Invariant Alert Box */}
                <div style={{ background: "rgba(131, 110, 249, 0.08)", border: "1px solid rgba(131, 110, 249, 0.25)", borderRadius: "12px", padding: "14px", marginBottom: "20px" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--monad-purple)", textTransform: "uppercase", marginBottom: "4px" }}>
                    Enforced Security Invariant
                  </div>
                  <div className="font-mono" style={{ fontSize: "0.8rem", color: "#ffffff" }}>
                    {activeModalSpec.securityInvariant}
                  </div>
                </div>

                {/* Solidity Snippet */}
                <div style={{ background: "#050608", borderRadius: "12px", padding: "16px", border: "1px solid var(--border-hairline)", overflowX: "auto" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
                      SOLIDITY INTERFACE
                    </span>
                    <button
                      onClick={() => copyToClipboard(activeModalSpec.codeSnippet, "snippet")}
                      style={{ background: "none", border: "none", color: copiedAddress === "snippet" ? "var(--monad-purple)" : "var(--text-tertiary)", fontSize: "0.75rem", cursor: "pointer" }}
                    >
                      {copiedAddress === "snippet" ? "Copied" : "Copy Code"}
                    </button>
                  </div>
                  <pre style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "#c7bdff", lineHeight: 1.5 }}>
                    {activeModalSpec.codeSnippet}
                  </pre>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "24px" }}>
                <a
                  href={activeModalSpec.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-motionsites-secondary"
                  style={{ flex: 1, padding: "10px", fontSize: "0.82rem", textDecoration: "none", textAlign: "center" }}
                >
                  View on Monadscan ↗
                </a>
                <button
                  onClick={() => {
                    setActiveModalSpec(null);
                    onLaunchApp();
                  }}
                  className="anchor-purple-btn"
                  style={{ flex: 1, padding: "10px", fontSize: "0.82rem" }}
                >
                  <span>Enter Terminal</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                </button>
              </div>
            </div>

            {/* Right Spec Sheet Panel */}
            <div style={{ padding: "28px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-tertiary)", textTransform: "uppercase", fontWeight: 700 }}>
                    SPECIFICATIONS
                  </span>
                  <button
                    onClick={() => setActiveModalSpec(null)}
                    style={{ background: "none", border: "none", color: "var(--text-tertiary)", fontSize: "1.4rem", cursor: "pointer", lineHeight: 1 }}
                  >
                    ×
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {activeModalSpec.stats.map((stat, idx) => (
                    <div key={idx} style={{ padding: "10px 12px", borderRadius: "10px", background: "rgba(255, 255, 255, 0.03)", border: "1px solid var(--border-hairline)" }}>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", textTransform: "uppercase", fontWeight: 600 }}>
                        {stat.label}
                      </div>
                      <div className="font-mono" style={{ fontSize: "0.85rem", color: "#ffffff", fontWeight: 600, marginTop: "2px" }}>
                        {stat.value}
                      </div>
                    </div>
                  ))}

                  <div style={{ padding: "10px 12px", borderRadius: "10px", background: "rgba(255, 255, 255, 0.03)", border: "1px solid var(--border-hairline)" }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", textTransform: "uppercase", fontWeight: 600 }}>
                      Contract Address
                    </div>
                    <div className="font-mono" style={{ fontSize: "0.76rem", color: "var(--monad-purple)", marginTop: "2px", wordBreak: "break-all" }}>
                      {activeModalSpec.address}
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setActiveModalSpec(null)}
                className="btn-motionsites-secondary"
                style={{ width: "100%", marginTop: "24px", padding: "10px", fontSize: "0.82rem" }}
              >
                Close Spec Sheet
              </button>
            </div>
          </div>
        </div>
      )}

        {/* Footer */}
        <footer style={{ borderTop: "1px solid var(--border-hairline)", paddingTop: "32px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", color: "var(--text-tertiary)", fontSize: "0.85rem" }}>
          <div>
            <strong style={{ color: "#ffffff" }}>Warden</strong> — Autonomous Trading Vault on Monad.
          </div>
          <div style={{ display: "flex", gap: "20px" }}>
            <button onClick={onLaunchApp} style={{ background: "none", border: "none", color: "var(--monad-purple)", cursor: "pointer", fontWeight: 600 }}>
              Launch App
            </button>
            <a href="https://github.com/Rampop01/Warden" target="_blank" rel="noreferrer" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>
              GitHub Repository
            </a>
            <a href="https://testnet.monadscan.com" target="_blank" rel="noreferrer" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>
              Monadscan
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
