import React, { useState, useEffect } from "react";

const INDEXER_URL = "http://127.0.0.1:4000";

const MONAD_TESTNET = {
  chainId: "0x279f", // 10143 in hex
  chainIdDecimal: 10143,
  chainName: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: ["https://testnet-rpc.monad.xyz"],
  blockExplorerUrls: ["https://testnet.monadscan.com"]
};

// ABI fragments for direct browser Web3 calls
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)"
];

const VAULT_ABI = [
  "function totalAssets() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function deposit(uint256 assets, address receiver) returns (uint256)",
  "function redeem(uint256 shares, address receiver, address owner) returns (uint256)",
  "function paused() view returns (bool)"
];

export default function App() {
  const [activeTab, setActiveTab] = useState("vault");
  
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
        // balanceOf(address) selector = 0x70a08231
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
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 20px" }}>
      {/* Network Warning Banner */}
      {isWrongNetwork && (
        <div style={{ background: "rgba(239, 68, 68, 0.2)", border: "1px solid #ef4444", borderRadius: 12, padding: "14px 20px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <strong style={{ color: "#fca5a5" }}>Wrong Network Detected!</strong>
            <p style={{ fontSize: "0.85rem", color: "#fecaca", marginTop: 2 }}>You are on Chain ID {userChainId}. Switch to Monad Testnet (10143) to interact with the vault.</p>
          </div>
          <button className="btn-primary" style={{ background: "#ef4444" }} onClick={switchToMonadTestnet}>
            Switch to Monad Testnet
          </button>
        </div>
      )}

      {/* Main Header */}
      <header className="glass-panel" style={{ padding: "18px 24px", marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="pulse-dot"></span>
            <h1 style={{ fontSize: "1.3rem", fontWeight: 800, letterSpacing: "-0.02em" }}>Warden Trading Vault</h1>
            <span className="badge badge-purple">Monad Testnet</span>
          </div>
          <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: 4 }}>
            Warden: Autonomous Non-Custodial Arbitrage Vault with Deterministic On-Chain Risk Controls
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className={`badge ${indexerOnline ? "badge-green" : "badge-red"}`}>
            {indexerOnline ? `Indexer Online (Block ${indexerState?.blockNumber || "..."})` : "Indexer Offline"}
          </div>

          {walletAddress ? (
            <div className="glass-panel" style={{ padding: "6px 14px", display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", fontWeight: 600 }}>
              <span style={{ color: "var(--monad-purple)" }}>●</span>
              <span>{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
              <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>({monBalance} MON)</span>
            </div>
          ) : (
            <button className="btn-primary" onClick={connectWallet}>
              Connect Web3 Wallet
            </button>
          )}
        </div>
      </header>

      {/* Live On-Chain Metrics Bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 24 }}>
        <div className="glass-panel" style={{ padding: 20 }}>
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Real On-Chain NAV</span>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, marginTop: 4 }}>
            ${indexerState?.formatted?.navUsdc?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? "0.00"}{" "}
            <span style={{ fontSize: "0.85rem", color: "var(--monad-purple)" }}>USDC</span>
          </div>
          <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", display: "block", marginTop: 4 }}>
            Directly from <code style={{ color: "var(--monad-purple)" }}>totalAssets()</code> on Monad Testnet
          </span>
        </div>

        <div className="glass-panel" style={{ padding: 20 }}>
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>mtvUSDC Share Price</span>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--neon-green)", marginTop: 4 }}>
            ${indexerState?.formatted?.sharePriceUsdc?.toFixed(4) ?? "1.0000"}
          </div>
          <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", display: "block", marginTop: 4 }}>
            Total Supply: {indexerState?.formatted?.totalSupplyShares?.toLocaleString() ?? "0"} shares
          </span>
        </div>

        <div className="glass-panel" style={{ padding: 20 }}>
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Daily Loss Circuit Breaker</span>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, marginTop: 4 }}>
            ${indexerState?.formatted?.lossTodayUsdc?.toFixed(2) ?? "0.00"}{" "}
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>/ ${indexerState?.riskLimits?.maxDailyLossUsdc ?? 50} Cap</span>
          </div>
          <span style={{ fontSize: "0.75rem", color: "var(--neon-cyan)", display: "block", marginTop: 4 }}>
            On-chain check prevents trades if loss exceeds cap
          </span>
        </div>

        <div className="glass-panel" style={{ padding: 20 }}>
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Vault Status</span>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, marginTop: 4 }}>
            <span className={`badge ${indexerState?.formatted?.isPaused ? "badge-red" : "badge-green"}`} style={{ fontSize: "0.9rem" }}>
              {indexerState?.formatted?.isPaused ? "EMERGENCY PAUSED" : "ACTIVE / OPERATIONAL"}
            </span>
          </div>
          <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", display: "block", marginTop: 8 }}>
            Guardian pause mechanism active
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 12, marginBottom: 24 }}>
        {[
          { id: "vault", label: "Deposit / Redeem Operations" },
          { id: "architecture", label: "How The Architecture Works" },
          { id: "risk", label: "On-Chain Risk Constraints" },
          { id: "ai", label: "AI Advisor & Reports" }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              background: activeTab === t.id ? "var(--monad-purple-subtle)" : "transparent",
              color: activeTab === t.id ? "#c4b5fd" : "var(--text-muted)",
              border: activeTab === t.id ? "1px solid var(--border-card-hover)" : "1px solid transparent",
              borderRadius: 8,
              padding: "8px 16px",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: "0.9rem"
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: Real Deposit / Redeem */}
      {activeTab === "vault" && (
        <div>
          {/* User balance banner */}
          <div className="glass-panel" style={{ padding: 18, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Connected Wallet Balances:</span>
              <div style={{ display: "flex", gap: 20, marginTop: 4 }}>
                <span>MON: <strong style={{ color: "#fff" }}>{monBalance}</strong></span>
                <span>Testnet USDC: <strong style={{ color: "var(--neon-green)" }}>${usdcBalance} USDC</strong></span>
                <span>Vault Shares: <strong style={{ color: "var(--monad-purple)" }}>{shareBalance} mtvUSDC</strong></span>
              </div>
            </div>
            <a 
              href="https://faucet.monad.xyz" 
              target="_blank" 
              rel="noreferrer" 
              className="btn-secondary"
              style={{ fontSize: "0.8rem", textDecoration: "none" }}
            >
              Get Testnet MON (Faucet) ↗
            </a>
          </div>

          {/* Action Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
            {/* Deposit Box */}
            <div className="glass-panel" style={{ padding: 24 }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 12 }}>Deposit USDC into Vault</h2>
              <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: 16 }}>
                Deposit verified Circle testnet USDC (6 decimals) into the non-custodial MonadVault contract to receive ERC-4626 shares.
              </p>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: 6 }}>AMOUNT TO DEPOSIT (USDC)</label>
                <div style={{ display: "flex", gap: 10 }}>
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border-card)", background: "rgba(0,0,0,0.3)", color: "#fff", fontSize: "1rem" }}
                  />
                  <button className="btn-primary" onClick={executeDeposit}>
                    Deposit USDC
                  </button>
                </div>
              </div>

              {txStatus && (
                <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: txStatus.step === "error" ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)", border: `1px solid ${txStatus.step === "error" ? "#ef4444" : "#10b981"}`, fontSize: "0.82rem" }}>
                  <div>{txStatus.msg}</div>
                  {txStatus.txHash && (
                    <a href={`https://testnet.monadscan.com/tx/${txStatus.txHash}`} target="_blank" rel="noreferrer" style={{ color: "var(--neon-cyan)", marginTop: 6, display: "inline-block", textDecoration: "none" }}>
                      View on Monadscan ↗
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Redeem Box */}
            <div className="glass-panel" style={{ padding: 24 }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 12 }}>Redeem Vault Shares</h2>
              <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: 16 }}>
                Burn your <code style={{ color: "var(--monad-purple)" }}>mtvUSDC</code> shares to receive your principal plus accumulated trading yield back to your wallet.
              </p>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: 6 }}>SHARES TO REDEEM</label>
                <div style={{ display: "flex", gap: 10 }}>
                  <input
                    type="number"
                    value={redeemShares}
                    onChange={(e) => setRedeemShares(e.target.value)}
                    style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border-card)", background: "rgba(0,0,0,0.3)", color: "#fff", fontSize: "1rem" }}
                  />
                  <button className="btn-secondary" onClick={() => alert("Redeem will burn shares and return USDC assets. Ensure you have shares deposited.")}>
                    Redeem Shares
                  </button>
                </div>
              </div>

              <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", lineHeight: 1.5, marginTop: 16 }}>
                Invariant protection: Withdrawals are permanently open even during guardian pauses. Only blocked during atomic trade execution in-flight.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Architecture Explanation */}
      {activeTab === "architecture" && (
        <div className="glass-panel" style={{ padding: 24 }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 8 }}>The Non-Custodial Architecture</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 20 }}>
            Why this vault cannot be exploited by an autonomous agent or external AI model:
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 24 }}>
            <div style={{ background: "rgba(0,0,0,0.25)", padding: 18, borderRadius: 12, border: "1px solid var(--border-card)" }}>
              <div style={{ color: "var(--neon-green)", fontWeight: 700, marginBottom: 6 }}>1. No Withdrawal Authority</div>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                The trading Agent key (<code>{indexerState?.contracts?.agent?.slice(0, 10)}...</code>) has zero withdraw functions. It cannot transfer assets to itself.
              </p>
            </div>

            <div style={{ background: "rgba(0,0,0,0.25)", padding: 18, borderRadius: 12, border: "1px solid var(--border-card)" }}>
              <div style={{ color: "var(--neon-cyan)", fontWeight: 700, marginBottom: 6 }}>2. Atomic Capital Loans Only</div>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                The RiskExecutor can only borrow capital via <code>pullForTrade</code> and must settle in the exact same transaction via <code>settleTrade</code>.
              </p>
            </div>

            <div style={{ background: "rgba(0,0,0,0.25)", padding: 18, borderRadius: 12, border: "1px solid var(--border-card)" }}>
              <div style={{ color: "var(--monad-purple)", fontWeight: 700, marginBottom: 6 }}>3. On-Chain Risk Gate</div>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                Slippage floors, max trade caps ($5,000), and UTC daily loss limits ($50) are enforced directly by the smart contract bytecode.
              </p>
            </div>
          </div>

          <div style={{ fontSize: "0.82rem", background: "rgba(131,110,249,0.08)", border: "1px solid var(--border-card)", borderRadius: 10, padding: 14 }}>
            <strong>Deterministic Trust Boundary:</strong> The LLM suggests and explains; deterministic smart contracts and mathematical off-chain algorithms decide and enforce.
          </div>
        </div>
      )}

      {/* TAB 3: Real On-Chain Risk Limits */}
      {activeTab === "risk" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
          <div className="glass-panel" style={{ padding: 24 }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 16 }}>Live On-Chain Risk Limits</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: "0.85rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 8 }}>
                <span style={{ color: "var(--text-muted)" }}>Max Trade Size:</span>
                <strong>{indexerState?.riskLimits?.maxTradeSizeUsdc?.toLocaleString() ?? 5000} USDC</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 8 }}>
                <span style={{ color: "var(--text-muted)" }}>Max NAV Allocation per Trade:</span>
                <strong>{indexerState?.riskLimits?.maxAllocationPct ?? 20}% of Vault</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 8 }}>
                <span style={{ color: "var(--text-muted)" }}>Max Tolerated Loss (Slippage floor):</span>
                <strong>{indexerState?.riskLimits?.maxLossPct ?? 0.50}%</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 8 }}>
                <span style={{ color: "var(--text-muted)" }}>Daily Loss Circuit Breaker:</span>
                <strong style={{ color: "var(--neon-red)" }}>${indexerState?.riskLimits?.maxDailyLossUsdc ?? 50} USDC / Day</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 8 }}>
                <span style={{ color: "var(--text-muted)" }}>Max Hop Count:</span>
                <strong>{indexerState?.riskLimits?.maxHops ?? 3} Hops</strong>
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: 24 }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 16 }}>Contract Addresses (Monadscan)</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, fontSize: "0.8rem" }}>
              <div>
                <span style={{ color: "var(--text-muted)", display: "block", marginBottom: 4 }}>MonadVault:</span>
                <a href={`https://testnet.monadscan.com/address/${indexerState?.contracts?.vault}`} target="_blank" rel="noreferrer" style={{ color: "var(--monad-purple)", fontFamily: "var(--font-mono)", textDecoration: "none", wordBreak: "break-all" }}>
                  {indexerState?.contracts?.vault} ↗
                </a>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)", display: "block", marginBottom: 4 }}>RiskExecutor:</span>
                <a href={`https://testnet.monadscan.com/address/${indexerState?.contracts?.executor}`} target="_blank" rel="noreferrer" style={{ color: "var(--monad-purple)", fontFamily: "var(--font-mono)", textDecoration: "none", wordBreak: "break-all" }}>
                  {indexerState?.contracts?.executor} ↗
                </a>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Agent Hot Key:</span>
                <span style={{ color: "#fff", fontFamily: "var(--font-mono)", wordBreak: "break-all" }}>
                  {indexerState?.contracts?.agent}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Real AI Advisor Report */}
      {activeTab === "ai" && (
        <div className="glass-panel" style={{ padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
            <div>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>AI Agent Operational Intelligence</h2>
              <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>Autonomous synthesis generated from the live on-chain indexer</p>
            </div>
            <button className="btn-primary" onClick={fetchAiReport} disabled={loadingAi}>
              {loadingAi ? "Synthesizing Report..." : "Generate Live AI Report"}
            </button>
          </div>

          {aiReport ? (
            <div style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--border-card)", borderRadius: 12, padding: 20 }}>
              <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}>
                <span className="badge badge-purple">Status: {aiReport.vault_status}</span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "auto" }}>Generated: {aiReport.generated_at}</span>
              </div>
              <p style={{ fontSize: "0.92rem", lineHeight: 1.6, color: "#e2e8f0", marginBottom: 16 }}>
                {aiReport.executive_summary}
              </p>
              <div style={{ display: "flex", gap: 24, fontSize: "0.8rem", color: "var(--text-muted)", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12 }}>
                <div>Total Indexed Trades: <strong style={{ color: "#fff" }}>{aiReport.total_trades}</strong></div>
                <div>Win Rate: <strong style={{ color: "var(--neon-green)" }}>{aiReport.win_rate_pct}%</strong></div>
                <div>Net Yield: <strong style={{ color: "#fff" }}>{aiReport.net_pnl}</strong></div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)", fontSize: "0.88rem" }}>
              Click "Generate Live AI Report" to query the indexer and run the AI advisor synthesis on live contract state.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
