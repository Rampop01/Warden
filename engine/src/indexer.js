// Monad Trading Vault Indexer & Accounting Ledger
// Ingests raw chain events, provides idempotent derived accounting, and exposes state metrics.

export class VaultIndexer {
  constructor({ rpcUrl, vaultAddress, executorAddress, baseDecimals = 6 }) {
    this.rpcUrl = rpcUrl;
    this.vaultAddress = vaultAddress.toLowerCase();
    this.executorAddress = executorAddress.toLowerCase();
    this.baseDecimals = baseDecimals;
    
    // Immutable raw event log (idempotent keyed by `${txHash}-${logIndex}`)
    this.rawEvents = new Map();

    // Derived accounting ledger
    this.derivedState = {
      nav: 0n,
      totalSupply: 0n,
      inFlight: 0n,
      lossToday: 0n,
      lossDay: 0,
      paused: false,
      halted: false,
      totalDeposited: 0n,
      totalWithdrawn: 0n,
      realizedPnlCumulative: 0n,
      totalVolume: 0n,
      tradeCount: 0,
      profitableTrades: 0
    };

    this.trades = [];
  }

  /** Idempotently ingests an event into raw logs and applies state updates */
  ingestEvent(event) {
    const key = `${event.txHash}-${event.logIndex ?? 0}`;
    if (this.rawEvents.has(key)) {
      return false; // Already processed
    }
    this.rawEvents.set(key, { ...event, ingestedAt: Date.now() });

    switch (event.type) {
      case "TradeSettled": {
        const principal = BigInt(event.principal);
        const returned = BigInt(event.returned);
        const pnl = BigInt(event.pnl);

        this.derivedState.inFlight = 0n;
        this.derivedState.realizedPnlCumulative += pnl;
        this.derivedState.totalVolume += principal;
        this.derivedState.tradeCount += 1;
        if (pnl > 0n) {
          this.derivedState.profitableTrades += 1;
        }

        this.trades.push({
          txHash: event.txHash,
          blockNumber: event.blockNumber,
          timestamp: event.timestamp,
          strategyId: event.strategyId || "cycle-arb",
          principal,
          returned,
          netPnl: pnl,
          grossPnl: event.grossPnl ? BigInt(event.grossPnl) : pnl
        });
        break;
      }

      case "TradeStarted": {
        this.derivedState.inFlight = BigInt(event.amount);
        break;
      }

      case "Deposit": {
        const assets = BigInt(event.assets);
        const shares = BigInt(event.shares);
        this.derivedState.totalDeposited += assets;
        this.derivedState.totalSupply += shares;
        this.derivedState.nav += assets;
        break;
      }

      case "Withdraw": {
        const assets = BigInt(event.assets);
        const shares = BigInt(event.shares);
        this.derivedState.totalWithdrawn += assets;
        this.derivedState.totalSupply -= shares;
        this.derivedState.nav -= assets;
        break;
      }

      case "EmergencyPaused": {
        this.derivedState.paused = true;
        break;
      }

      case "EmergencyUnpaused": {
        this.derivedState.paused = false;
        break;
      }

      case "HaltSet": {
        this.derivedState.halted = Boolean(event.halted);
        break;
      }
    }

    return true;
  }

  /** Share price calculation (returns float representation with 6 decimals) */
  getSharePrice() {
    if (this.derivedState.totalSupply === 0n) return 1.0;
    const ratio = (this.derivedState.nav * 1_000_000n) / this.derivedState.totalSupply;
    return Number(ratio) / 1_000_000;
  }

  /** Summary snapshot for dashboards and monitoring */
  getSummary() {
    const winRate = this.derivedState.tradeCount > 0
      ? (this.derivedState.profitableTrades / this.derivedState.tradeCount) * 100
      : 0;

    return {
      vault: this.vaultAddress,
      executor: this.executorAddress,
      nav: this.derivedState.nav.toString(),
      totalSupply: this.derivedState.totalSupply.toString(),
      sharePrice: this.getSharePrice(),
      inFlight: this.derivedState.inFlight.toString(),
      paused: this.derivedState.paused,
      halted: this.derivedState.halted,
      realizedPnlCumulative: this.derivedState.realizedPnlCumulative.toString(),
      totalVolume: this.derivedState.totalVolume.toString(),
      tradeCount: this.derivedState.tradeCount,
      winRatePct: Math.round(winRate * 100) / 100,
      recentTrades: this.trades.slice(-20)
    };
  }
}
