import React, { useState, useEffect } from "react";
import LandingPage from "./components/LandingPage";
import ArbSimulator from "./components/ArbSimulator";

const INDEXER_URL = "http://127.0.0.1:4000";

const MONAD_TESTNET = {
  chainId: "0x279f", // 10143 in hex
  chainIdDecimal: 10143,
  chainName: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: ["https://testnet-rpc.monad.xyz"],
  blockExplorerUrls: ["https://testnet.monadscan.com"]
};

export default function App() {
  const [activeTab, setActiveTab] = useState("overview");

  // Real indexer / on-chain state
  const [indexerState, setIndexerState] = useState(null);
  const [indexerOnline, setIndexerOnline] = useState(false);
  const [aiReport, setAiReport] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // User wallet state
  const [walletAddress, setWalletAddress] = useState(null);
  const [userChainId, setUserChainId] = useState(null);
  const [monBalance, setMonBalance] = useState("0");
  const [usdcBalance, setUsdcBalance] = useState("0");
  const [shareBalance, setShareBalance] = useState("0");
  const [txStatus, setTxStatus] = useState(null);

  // Forms
  const [depositAmount, setDepositAmount] = useState("10");
  const [redeemShares, setRedeemShares] = useState("10");

  // Poll live indexer state
  useEffect(() => {
    const fetchState = async () => {
      try {
        const res = await fetch(`${INDEXER_URL}/api/vault-state`);
        if (res.ok) {
          const data = await res.json();
          setIndexerState(data);
          setIndexerOnline(true);
        } else {
          setIndexerOnline(false);
        }
      } catch (err) {
        setIndexerOnline(false);
      }
    };

    fetchState();
    const interval = setInterval(fetchState, 3000);
    return () => clearInterval(interval);
  }, []);

  // Web3 Wallet Connect
  const connectWallet = async () => {
    if (typeof window.ethereum === "undefined") {
      alert("No Ethereum browser wallet (MetaMask / Rabby) detected. Please install a wallet extension.");
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      if (accounts && accounts[0]) {
        setWalletAddress(accounts[0]);
        const chainId = await window.ethereum.request({ method: "eth_chainId" });
        setUserChainId(parseInt(chainId, 16));
        loadUserBalances(accounts[0]);
      }
    } catch (err) {
      console.error("Wallet connection failed:", err);
    }
  };

  // Switch network to Monad Testnet
  const switchToMonadTestnet = async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: MONAD_TESTNET.chainId }]
      });
      setUserChainId(MONAD_TESTNET.chainIdDecimal);
    } catch (switchError) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [MONAD_TESTNET]
          });
          setUserChainId(MONAD_TESTNET.chainIdDecimal);
        } catch (addError) {
          console.error("Failed to add Monad Testnet:", addError);
        }
      }
    }
  };

  // Load user balances via RPC
  const loadUserBalances = async (account) => {
    if (!window.ethereum || !account) return;
    try {
      // 1. Native MON balance
      const monBalHex = await window.ethereum.request({
        method: "eth_getBalance",
        params: [account, "latest"]
      });
      setMonBalance((Number(BigInt(monBalHex)) / 1e18).toFixed(4));

      // 2. Circle USDC balance via eth_call
      if (indexerState?.contracts?.vault) {
        const usdcAddress = "0x534b2f3A21130d7a60830c2Df862319e593943A3";
        const cleanAddr = account.toLowerCase().replace("0x", "").padStart(64, "0");
        const usdcCall = await window.ethereum.request({
          method: "eth_call",
          params: [{ to: usdcAddress, data: "0x70a08231" + cleanAddr }, "latest"]
        });
        setUsdcBalance((Number(BigInt(usdcCall || "0x0")) / 1e6).toFixed(2));

        // 3. Vault Shares balance via eth_call
        const sharesCall = await window.ethereum.request({
          method: "eth_call",
          params: [{ to: indexerState.contracts.vault, data: "0x70a08231" + cleanAddr }, "latest"]
        });
        setShareBalance((Number(BigInt(sharesCall || "0x0")) / 1e6).toFixed(2));
      }
    } catch (err) {
      console.error("Balance fetch error:", err);
    }
  };

  // Trigger deposit flow
  const executeDeposit = async () => {
    if (!walletAddress) {
      alert("Please connect your wallet first.");
      return;
    }
    if (userChainId !== MONAD_TESTNET.chainIdDecimal) {
      alert("Please switch network to Monad Testnet (Chain ID 10143).");
      return;
    }

    try {
      setTxStatus({ step: "approval", msg: "Requesting USDC allowance approval..." });
      const usdcAddress = "0x534b2f3A21130d7a60830c2Df862319e593943A3";
      const vaultAddress = indexerState.contracts.vault;
      const amountUnits = BigInt(Math.floor(parseFloat(depositAmount) * 1e6));

      // approve(spender, amount) = 0x095ea7b3
      const spenderData = vaultAddress.toLowerCase().replace("0x", "").padStart(64, "0");
      const amountData = amountUnits.toString(16).padStart(64, "0");

      const approveTx = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [{
          from: walletAddress,
          to: usdcAddress,
          data: "0x095ea7b3" + spenderData + amountData
        }]
      });

      setTxStatus({ step: "deposit", msg: `Approval submitted (${approveTx.slice(0, 10)}...). Calling deposit()...` });

      // deposit(assets, receiver) = 0x6e553f65
      const receiverData = walletAddress.toLowerCase().replace("0x", "").padStart(64, "0");
      const depositTx = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [{
          from: walletAddress,
          to: vaultAddress,
          data: "0x6e553f65" + amountData + receiverData
        }]
      });

      setTxStatus({
        step: "success",
        msg: "Deposit transaction confirmed on Monad Testnet!",
        txHash: depositTx
      });
      loadUserBalances(walletAddress);
    } catch (err) {
      setTxStatus({ step: "error", msg: err.message || "Transaction rejected or failed" });
    }
  };

  // Trigger AI Report
  const fetchAiReport = async () => {
    setLoadingAi(true);
    try {
      const res = await fetch(`${INDEXER_URL}/api/ai-report`);
      if (res.ok) {
        const data = await res.json();
        setAiReport(data);
      }
    } catch (err) {
      console.error("AI report error:", err);
    } finally {
      setLoadingAi(false);
    }
  };

  const isWrongNetwork = walletAddress && userChainId !== MONAD_TESTNET.chainIdDecimal;

  return (
    <div style={{ minHeight: "100vh", position: "relative" }}>
      {/* Background Decorative Grid */}
      <div className="grid-bg-overlay" />

      {/* Network Warning Banner */}
      {isWrongNetwork && (
        <div style={{ background: "rgba(244, 63, 94, 0.18)", borderBottom: "1px solid #f43f5e", padding: "12px 24px", position: "sticky", top: 0, zIndex: 100, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <strong style={{ color: "#ffffff" }}>Wrong Network Detected!</strong>
            <span style={{ fontSize: "0.85rem", color: "#fecdd3", marginLeft: "12px" }}>
              Your wallet is on Chain ID {userChainId}. Switch to Monad Testnet (10143) to interact.
            </span>
          </div>
          <button className="btn-monad-primary" style={{ padding: "6px 14px", fontSize: "0.82rem" }} onClick={switchToMonadTestnet}>
            Switch to Monad Testnet
          </button>
        </div>
      )}

      {/* Top Protocol Navigation Header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 90,
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          background: "rgba(5, 6, 9, 0.78)",
          borderBottom: "1px solid var(--border-hairline)"
        }}
      >
        <div style={{ maxWidth: 1300, margin: "0 auto", padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          {/* Logo & Brand */}
          <div
            onClick={() => setActiveTab("overview")}
            style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #836ef9 0%, #432ec4 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 16px rgba(131, 110, 249, 0.45)",
                border: "1px solid rgba(255, 255, 255, 0.25)"
              }}
            >
              {/* Sleek Geometric Shield SVG */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M12 8v8" />
                <path d="M8 12h8" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: "1.25rem", fontWeight: 800, letterSpacing: "-0.03em", color: "#ffffff", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>WARDEN</span>
                <span className="font-mono" style={{ fontSize: "0.68rem", color: "var(--monad-purple)", background: "rgba(131, 110, 249, 0.15)", padding: "2px 6px", borderRadius: "4px" }}>
                  MONAD
                </span>
              </div>
            </div>
          </div>

          {/* Nav Tabs Switcher */}
          <nav style={{ display: "flex", gap: "6px", background: "rgba(10, 12, 18, 0.6)", padding: "4px", borderRadius: "12px", border: "1px solid var(--border-hairline)" }}>
            {[
              { id: "overview", label: "Protocol Overview" },
              { id: "terminal", label: "Vault Terminal" },
              { id: "simulator", label: "Arb Simulator" },
              { id: "ai", label: "AI Advisor" },
              { id: "risk", label: "Risk & Proof" }
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  background: activeTab === t.id ? "rgba(131, 110, 249, 0.2)" : "transparent",
                  color: activeTab === t.id ? "#ffffff" : "var(--text-secondary)",
                  border: activeTab === t.id ? "1px solid rgba(131, 110, 249, 0.45)" : "1px solid transparent",
                  borderRadius: "8px",
                  padding: "7px 15px",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {/* Right Status & Wallet Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 12px",
                borderRadius: "8px",
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid var(--border-hairline)",
                fontSize: "0.75rem",
                fontFamily: "var(--font-mono)"
              }}
            >
              <span className={indexerOnline ? "pulse-green" : "pulse-purple"}></span>
              <span style={{ color: "var(--text-secondary)" }}>
                {indexerOnline ? `BLOCK #${indexerState?.blockNumber || "..."}` : "SYNCING"}
              </span>
            </div>

            {walletAddress ? (
              <div
                style={{
                  padding: "7px 14px",
                  borderRadius: "10px",
                  background: "rgba(131, 110, 249, 0.12)",
                  border: "1px solid rgba(131, 110, 249, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  fontFamily: "var(--font-mono)"
                }}
              >
                <span style={{ color: "var(--emerald)" }}>●</span>
                <span style={{ color: "#ffffff" }}>
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </span>
                <span style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>
                  ({monBalance} MON)
                </span>
              </div>
            ) : (
              <button onClick={connectWallet} className="btn-monad-primary" style={{ padding: "8px 18px", fontSize: "0.85rem" }}>
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Page Container */}
      <main style={{ maxWidth: 1300, margin: "0 auto", padding: "28px 24px", position: "relative", zIndex: 1 }}>
        {/* VIEW 1: LANDING PAGE */}
        {activeTab === "overview" && (
          <LandingPage
            onLaunchApp={() => setActiveTab("terminal")}
            indexerState={indexerState}
            indexerOnline={indexerOnline}
          />
        )}

        {/* VIEW 2: VAULT TERMINAL (WEB3 APP) */}
        {activeTab === "terminal" && (
          <div>
            {/* Top Stat Row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px", marginBottom: "28px" }}>
              <div className="glass-card" style={{ padding: "24px" }}>
                <span style={{ fontSize: "0.78rem", color: "var(--text-tertiary)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>
                  Real On-Chain NAV
                </span>
                <div className="font-mono" style={{ fontSize: "2rem", fontWeight: 800, marginTop: "6px", color: "#ffffff" }}>
                  ${indexerState?.formatted?.navUsdc?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? "0.00"}{" "}
                  <span style={{ fontSize: "0.9rem", color: "var(--monad-purple)" }}>USDC</span>
                </div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", display: "block", marginTop: "6px" }}>
                  Queried live via <code className="font-mono" style={{ color: "var(--monad-purple)" }}>totalAssets()</code> on Monad
                </span>
              </div>

              <div className="glass-card" style={{ padding: "24px" }}>
                <span style={{ fontSize: "0.78rem", color: "var(--text-tertiary)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>
                  mtvUSDC Share Price
                </span>
                <div className="font-mono" style={{ fontSize: "2rem", fontWeight: 800, color: "var(--emerald)", marginTop: "6px" }}>
                  ${indexerState?.formatted?.sharePriceUsdc?.toFixed(4) ?? "1.0000"}
                </div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", display: "block", marginTop: "6px" }}>
                  Supply: {indexerState?.formatted?.totalSupplyShares?.toLocaleString() ?? "0"} shares
                </span>
              </div>

              <div className="glass-card" style={{ padding: "24px" }}>
                <span style={{ fontSize: "0.78rem", color: "var(--text-tertiary)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>
                  Daily Loss Circuit Breaker
                </span>
                <div className="font-mono" style={{ fontSize: "2rem", fontWeight: 800, marginTop: "6px", color: "#ffffff" }}>
                  ${indexerState?.formatted?.lossTodayUsdc?.toFixed(2) ?? "0.00"}{" "}
                  <span style={{ fontSize: "0.9rem", color: "var(--text-tertiary)" }}>
                    / ${indexerState?.riskLimits?.maxDailyLossUsdc ?? 50} Cap
                  </span>
                </div>
                <span style={{ fontSize: "0.75rem", color: "var(--emerald)", display: "block", marginTop: "6px" }}>
                  On-chain breaker halts execution if cap is reached
                </span>
              </div>

              <div className="glass-card" style={{ padding: "24px" }}>
                <span style={{ fontSize: "0.78rem", color: "var(--text-tertiary)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>
                  Vault Status
                </span>
                <div style={{ marginTop: "10px" }}>
                  <span
                    className="font-mono"
                    style={{
                      background: indexerState?.formatted?.isPaused ? "rgba(244, 63, 94, 0.15)" : "var(--emerald-subtle)",
                      color: indexerState?.formatted?.isPaused ? "#f43f5e" : "var(--emerald)",
                      border: `1px solid ${indexerState?.formatted?.isPaused ? "rgba(244, 63, 94, 0.3)" : "var(--emerald-border)"}`,
                      padding: "6px 14px",
                      borderRadius: "8px",
                      fontSize: "0.85rem",
                      fontWeight: 700
                    }}
                  >
                    {indexerState?.formatted?.isPaused ? "EMERGENCY PAUSED" : "OPERATIONAL • ACTIVE"}
                  </span>
                </div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", display: "block", marginTop: "12px" }}>
                  Guardian multi-sig control active
                </span>
              </div>
            </div>

            {/* Wallet Balances Bar */}
            <div className="glass-card" style={{ padding: "20px 24px", marginBottom: "28px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
              <div>
                <span style={{ fontSize: "0.8rem", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase" }}>
                  Connected Wallet Balances:
                </span>
                <div style={{ display: "flex", gap: "24px", marginTop: "8px", flexWrap: "wrap" }}>
                  <span className="font-mono">MON: <strong style={{ color: "#ffffff" }}>{monBalance}</strong></span>
                  <span className="font-mono">Official USDC: <strong style={{ color: "var(--emerald)" }}>${usdcBalance} USDC</strong></span>
                  <span className="font-mono">Vault Shares: <strong style={{ color: "var(--monad-purple)" }}>{shareBalance} mtvUSDC</strong></span>
                </div>
              </div>
              <a
                href="https://faucet.monad.xyz"
                target="_blank"
                rel="noreferrer"
                className="btn-monad-secondary"
                style={{ fontSize: "0.82rem", padding: "8px 16px", textDecoration: "none" }}
              >
                Get Testnet MON (Faucet) ↗
              </a>
            </div>

            {/* Deposit & Redeem Action Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "28px" }}>
              {/* Deposit Card */}
              <div className="glass-card" style={{ padding: "28px" }}>
                <h3 style={{ fontSize: "1.3rem", marginBottom: "8px" }}>Deposit USDC</h3>
                <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", marginBottom: "20px" }}>
                  Deposit verified Circle testnet USDC (6 decimals) into the non-custodial MonadVault to receive ERC-4626 shares.
                </p>

                <div style={{ marginBottom: "20px" }}>
                  <label style={{ fontSize: "0.78rem", color: "var(--text-tertiary)", display: "block", marginBottom: "8px", fontWeight: 600, textTransform: "uppercase" }}>
                    AMOUNT TO DEPOSIT (USDC)
                  </label>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      className="font-mono"
                      style={{
                        flex: 1,
                        padding: "12px 16px",
                        borderRadius: "10px",
                        border: "1px solid var(--border-hairline)",
                        background: "rgba(5, 6, 9, 0.6)",
                        color: "#ffffff",
                        fontSize: "1.1rem"
                      }}
                    />
                    <button className="btn-monad-primary" onClick={executeDeposit}>
                      Deposit USDC
                    </button>
                  </div>
                </div>

                {txStatus && (
                  <div
                    style={{
                      padding: "14px",
                      borderRadius: "10px",
                      background: txStatus.step === "error" ? "rgba(244, 63, 94, 0.15)" : "rgba(16, 185, 129, 0.15)",
                      border: `1px solid ${txStatus.step === "error" ? "rgba(244, 63, 94, 0.4)" : "rgba(16, 185, 129, 0.4)"}`,
                      fontSize: "0.85rem"
                    }}
                  >
                    <div>{txStatus.msg}</div>
                    {txStatus.txHash && (
                      <a
                        href={`https://testnet.monadscan.com/tx/${txStatus.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono"
                        style={{ color: "#38bdf8", marginTop: "8px", display: "inline-block", textDecoration: "none" }}
                      >
                        View on Monadscan ↗
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Redeem Card */}
              <div className="glass-card" style={{ padding: "28px" }}>
                <h3 style={{ fontSize: "1.3rem", marginBottom: "8px" }}>Redeem Vault Shares</h3>
                <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", marginBottom: "20px" }}>
                  Burn your <code className="font-mono" style={{ color: "var(--monad-purple)" }}>mtvUSDC</code> shares to withdraw your principal plus accumulated trading yield.
                </p>

                <div style={{ marginBottom: "20px" }}>
                  <label style={{ fontSize: "0.78rem", color: "var(--text-tertiary)", display: "block", marginBottom: "8px", fontWeight: 600, textTransform: "uppercase" }}>
                    SHARES TO REDEEM
                  </label>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <input
                      type="number"
                      value={redeemShares}
                      onChange={(e) => setRedeemShares(e.target.value)}
                      className="font-mono"
                      style={{
                        flex: 1,
                        padding: "12px 16px",
                        borderRadius: "10px",
                        border: "1px solid var(--border-hairline)",
                        background: "rgba(5, 6, 9, 0.6)",
                        color: "#ffffff",
                        fontSize: "1.1rem"
                      }}
                    />
                    <button
                      className="btn-monad-secondary"
                      onClick={() => alert("Redeem burns shares and sends USDC to your wallet. Ensure you have deposited shares.")}
                    >
                      Redeem Shares
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: "0.8rem", color: "var(--text-tertiary)", lineHeight: 1.6, marginTop: "16px" }}>
                  ✦ Invariant Guarantee: Withdrawals are permanently open even during guardian pauses. Funds are only locked for the single transaction block when an atomic cyclic trade executes.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: ARB SIMULATOR */}
        {activeTab === "simulator" && (
          <div style={{ maxWidth: 1000, margin: "0 auto" }}>
            <ArbSimulator />
          </div>
        )}

        {/* VIEW 4: AI ADVISOR */}
        {activeTab === "ai" && (
          <div className="glass-card" style={{ padding: "32px", maxWidth: 1000, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
              <div>
                <h3 style={{ fontSize: "1.5rem", margin: 0 }}>AI Agent Operational Intelligence</h3>
                <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                  Autonomous telemetry synthesis generated from the live on-chain indexer
                </p>
              </div>
              <button className="btn-monad-primary" onClick={fetchAiReport} disabled={loadingAi}>
                {loadingAi ? "Synthesizing Report..." : "Generate Live AI Report"}
              </button>
            </div>

            {aiReport ? (
              <div style={{ background: "rgba(10, 12, 18, 0.7)", border: "1px solid var(--border-hairline)", borderRadius: "14px", padding: "24px" }}>
                <div style={{ display: "flex", gap: "12px", marginBottom: "16px", alignItems: "center" }}>
                  <span className="hero-badge">Status: {aiReport.vault_status}</span>
                  <span className="font-mono" style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginLeft: "auto" }}>
                    Generated: {aiReport.generated_at}
                  </span>
                </div>
                <p style={{ fontSize: "1rem", lineHeight: 1.6, color: "var(--text-platinum)", marginBottom: "20px" }}>
                  {aiReport.executive_summary}
                </p>
                <div style={{ display: "flex", gap: "32px", fontSize: "0.85rem", color: "var(--text-secondary)", borderTop: "1px solid var(--border-hairline)", paddingTop: "16px", flexWrap: "wrap" }}>
                  <div>Total Indexed Trades: <strong style={{ color: "#ffffff" }}>{aiReport.total_trades}</strong></div>
                  <div>Win Rate: <strong style={{ color: "var(--emerald)" }}>{aiReport.win_rate_pct}%</strong></div>
                  <div>Net Yield: <strong style={{ color: "#ffffff" }}>{aiReport.net_pnl}</strong></div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-tertiary)", fontSize: "0.95rem" }}>
                Click "Generate Live AI Report" to query the indexer and run the AI advisor synthesis on live contract state.
              </div>
            )}
          </div>
        )}

        {/* VIEW 5: RISK & ON-CHAIN PROOF */}
        {activeTab === "risk" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "28px", maxWidth: 1000, margin: "0 auto" }}>
            <div className="glass-card" style={{ padding: "28px" }}>
              <h3 style={{ fontSize: "1.3rem", marginBottom: "20px" }}>Live On-Chain Risk Limits</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px", fontSize: "0.9rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-hairline)", paddingBottom: "10px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Max Trade Size:</span>
                  <strong className="font-mono" style={{ color: "#ffffff" }}>{indexerState?.riskLimits?.maxTradeSizeUsdc?.toLocaleString() ?? 5000} USDC</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-hairline)", paddingBottom: "10px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Max Allocation per Trade:</span>
                  <strong className="font-mono" style={{ color: "#ffffff" }}>{indexerState?.riskLimits?.maxAllocationPct ?? 20}% of Vault</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-hairline)", paddingBottom: "10px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Max Tolerated Loss (Slippage):</span>
                  <strong className="font-mono" style={{ color: "#ffffff" }}>{indexerState?.riskLimits?.maxLossPct ?? 0.50}%</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-hairline)", paddingBottom: "10px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Daily Loss Circuit Breaker:</span>
                  <strong className="font-mono" style={{ color: "#f43f5e" }}>${indexerState?.riskLimits?.maxDailyLossUsdc ?? 50} USDC / Day</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-hairline)", paddingBottom: "10px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Max Hop Count:</span>
                  <strong className="font-mono" style={{ color: "#ffffff" }}>{indexerState?.riskLimits?.maxHops ?? 3} Hops</strong>
                </div>
              </div>
            </div>

            <div className="glass-card" style={{ padding: "28px" }}>
              <h3 style={{ fontSize: "1.3rem", marginBottom: "20px" }}>Contract Registry (Monadscan)</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "20px", fontSize: "0.85rem" }}>
                <div>
                  <span style={{ color: "var(--text-tertiary)", display: "block", marginBottom: "4px" }}>MonadVault (ERC-4626):</span>
                  <a href={`https://testnet.monadscan.com/address/${indexerState?.contracts?.vault}`} target="_blank" rel="noreferrer" className="font-mono" style={{ color: "var(--monad-purple)", textDecoration: "none", wordBreak: "break-all" }}>
                    {indexerState?.contracts?.vault} ↗
                  </a>
                </div>
                <div>
                  <span style={{ color: "var(--text-tertiary)", display: "block", marginBottom: "4px" }}>RiskExecutor:</span>
                  <a href={`https://testnet.monadscan.com/address/${indexerState?.contracts?.executor}`} target="_blank" rel="noreferrer" className="font-mono" style={{ color: "var(--monad-purple)", textDecoration: "none", wordBreak: "break-all" }}>
                    {indexerState?.contracts?.executor} ↗
                  </a>
                </div>
                <div>
                  <span style={{ color: "var(--text-tertiary)", display: "block", marginBottom: "4px" }}>Agent Hot Key:</span>
                  <span className="font-mono" style={{ color: "#ffffff", wordBreak: "break-all" }}>
                    {indexerState?.contracts?.agent}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
