// Live Indexer & State Service for Monad Trading Vault
// Connects to Monad RPC, indexes on-chain logs, decodes contract state, and serves API.

import http from "node:http";
import { readFileSync } from "node:fs";
import { VaultIndexer } from "./indexer.js";
import { AIAgentAdvisor } from "./aiAgent.js";

// Load configuration and environment
const config = JSON.parse(readFileSync(new URL("../../config/monad.json", import.meta.url), "utf8"));
const netConfig = config.networks[config.activeNetwork];
const contracts = netConfig.contracts;

let rpcUrl = process.env.MONAD_RPC_URL;
if (!rpcUrl) {
  try {
    const envFile = readFileSync(new URL("../../.env", import.meta.url), "utf8");
    const m = envFile.match(/MONAD_RPC_URL=(.+)/);
    if (m) rpcUrl = m[1].trim();
  } catch {}
}
if (!rpcUrl) {
  rpcUrl = "https://monad-testnet.g.alchemy.com/v2/alch_u-cIpGrEzXGTi2ereUdN5";
}

const PORT = process.env.PORT || 4000;
const START_BLOCK = 67868320; // Just before contract deployment block

// Initialize indexer and AI advisor
const indexer = new VaultIndexer({
  rpcUrl,
  vaultAddress: contracts.vault,
  executorAddress: contracts.executor,
  baseDecimals: 6,
  shareDecimalsOffset: 6
});
const advisor = new AIAgentAdvisor({ model: "gemini-3.8-flash" });

// JSON-RPC helper
async function rpcCall(method, params = []) {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

// Function signature hashes
const SIGS = {
  totalAssets: "0x01e1d114",
  totalSupply: "0x18160ddd",
  inFlight: "0xd9099e03", // custom getter
  paused: "0x5c975abb",
  lossToday: "0x161e1a5a",
  risk: "0x5e56e093"
};

let latestBlock = 0;
let lastIndexedBlock = START_BLOCK;
let liveOnChainState = {
  totalAssets: 0n,
  totalSupply: 0n,
  inFlight: 0n,
  paused: false,
  lossToday: 0n,
  riskParams: {
    maxTradeSize: 5000000000n,
    maxAllocationBps: 2000,
    maxLossBps: 50,
    minProfitBps: 0,
    maxDailyLoss: 50000000n,
    maxHops: 3
  },
  lastUpdated: null
};

// Poll on-chain state directly via eth_call
async function pollOnChainState() {
  try {
    const blockHex = await rpcCall("eth_blockNumber");
    latestBlock = parseInt(blockHex, 16);

    // 1. Query totalAssets()
    const totalAssetsHex = await rpcCall("eth_call", [
      { to: contracts.vault, data: SIGS.totalAssets },
      "latest"
    ]);
    liveOnChainState.totalAssets = BigInt(totalAssetsHex || "0x0");

    // 2. Query totalSupply()
    const totalSupplyHex = await rpcCall("eth_call", [
      { to: contracts.vault, data: SIGS.totalSupply },
      "latest"
    ]);
    liveOnChainState.totalSupply = BigInt(totalSupplyHex || "0x0");

    // 3. Query inFlight()
    try {
      const inFlightHex = await rpcCall("eth_call", [
        { to: contracts.vault, data: "0xa92d99d3" }, // inFlight()
        "latest"
      ]);
      liveOnChainState.inFlight = BigInt(inFlightHex || "0x0");
    } catch {}

    // 4. Query paused()
    const pausedHex = await rpcCall("eth_call", [
      { to: contracts.vault, data: SIGS.paused },
      "latest"
    ]);
    liveOnChainState.paused = Boolean(parseInt(pausedHex, 16));

    // 5. Query lossToday() on executor
    try {
      const lossTodayHex = await rpcCall("eth_call", [
        { to: contracts.executor, data: "0x39a1c1d8" }, // lossToday()
        "latest"
      ]);
      liveOnChainState.lossToday = BigInt(lossTodayHex || "0x0");
    } catch {}

    liveOnChainState.lastUpdated = new Date().toISOString();

    // Sync into indexer derived state
    indexer.derivedState.nav = liveOnChainState.totalAssets;
    indexer.derivedState.totalSupply = liveOnChainState.totalSupply;
    indexer.derivedState.inFlight = liveOnChainState.inFlight;
    indexer.derivedState.paused = liveOnChainState.paused;
    indexer.derivedState.lossToday = liveOnChainState.lossToday;

    console.log(`[Indexer] Synced block ${latestBlock} | NAV: ${liveOnChainState.totalAssets.toString()} | Paused: ${liveOnChainState.paused}`);
  } catch (err) {
    console.error("[Indexer] Polling error:", err.message);
  }
}

// Event log topic signatures
const TOPICS = {
  Deposit: "0xdcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d7",
  Withdraw: "0xfbde797d201c681b91056529119e5048d8a042d65d2119d64d763f2955430018",
  TradeStarted: "0xd9099e03b2e537ba313c0b064bb19ad77bbbe5be8bb98ba8b1c4e7fae44bdf98", // approximate
  EmergencyPaused: "0x62e78cea01bee320cd4e420270b5ea74000d11b0c9f74754ebdbfc544b05a258"
};

// Poll event logs
async function pollLogs() {
  if (latestBlock <= lastIndexedBlock) return;
  const toBlock = Math.min(latestBlock, lastIndexedBlock + 1000);

  try {
    const logs = await rpcCall("eth_getLogs", [{
      fromBlock: "0x" + lastIndexedBlock.toString(16),
      toBlock: "0x" + toBlock.toString(16),
      address: [contracts.vault, contracts.executor]
    }]);

    for (const log of logs) {
      indexer.ingestEvent({
        txHash: log.transactionHash,
        blockNumber: parseInt(log.blockNumber, 16),
        logIndex: parseInt(log.logIndex, 16),
        type: "OnChainLog",
        address: log.address,
        topics: log.topics,
        data: log.data
      });
    }

    lastIndexedBlock = toBlock;
  } catch (err) {
    console.error("[Indexer] Error querying logs:", err.message);
  }
}

// Start polling loops
setInterval(pollOnChainState, 4000);
setInterval(pollLogs, 8000);
pollOnChainState();

// HTTP API Server
const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === "/api/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      network: netConfig.name,
      chainId: netConfig.chainId,
      latestBlock,
      lastIndexedBlock,
      contracts: contracts,
      status: "ONLINE",
      timestamp: new Date().toISOString()
    }));
    return;
  }

  if (url.pathname === "/api/vault-state") {
    const navUSDC = Number(liveOnChainState.totalAssets) / 1e6;
    const supplyShares = Number(liveOnChainState.totalSupply) / 1e12;
    const sharePrice = supplyShares > 0 ? navUSDC / supplyShares : 1.0;
    const inFlightUSDC = Number(liveOnChainState.inFlight) / 1e6;
    const lossTodayUSDC = Number(liveOnChainState.lossToday) / 1e6;

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      contracts,
      blockNumber: latestBlock,
      raw: {
        totalAssets: liveOnChainState.totalAssets.toString(),
        totalSupply: liveOnChainState.totalSupply.toString(),
        inFlight: liveOnChainState.inFlight.toString(),
        lossToday: liveOnChainState.lossToday.toString(),
      },
      formatted: {
        navUsdc: navUSDC,
        totalSupplyShares: supplyShares,
        sharePriceUsdc: Math.round(sharePrice * 10000) / 10000,
        inFlightUsdc: inFlightUSDC,
        lossTodayUsdc: lossTodayUSDC,
        isPaused: liveOnChainState.paused,
        circuitBreakerMaxUsdc: 50.0
      },
      riskLimits: {
        maxTradeSizeUsdc: 5000,
        maxAllocationPct: 20,
        maxLossPct: 0.50,
        maxDailyLossUsdc: 50,
        maxHops: 3
      },
      lastUpdated: liveOnChainState.lastUpdated
    }));
    return;
  }

  if (url.pathname === "/api/events") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      count: indexer.rawEvents.size,
      events: Array.from(indexer.rawEvents.values())
    }));
    return;
  }

  if (url.pathname === "/api/ai-report") {
    const summary = indexer.getSummary();
    summary.nav = (Number(liveOnChainState.totalAssets) / 1e6) + " USDC";
    summary.paused = liveOnChainState.paused;
    const report = advisor.generateReport(summary);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(report));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Endpoint not found" }));
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`Monad Vault Indexer & Ledger Service running on http://127.0.0.1:${PORT}`);
  console.log(`Target Chain: ${netConfig.name} (Chain ID: ${netConfig.chainId})`);
  console.log(`Vault:    ${contracts.vault}`);
  console.log(`Executor: ${contracts.executor}`);
  console.log(`RPC:      ${rpcUrl.split('/')[2]}`);
  console.log(`====================================================`);
});
