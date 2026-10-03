# Warden — Autonomous Trading Vault on Monad

**Warden** is a production-oriented, non-custodial autonomous trading vault on Monad with deterministic on-chain risk enforcement.

---

## Architecture

- **`MonadVault` (`ERC-4626`)**: Owns and pools user funds (denominated in verified Circle USDC). Mints vault share tokens. Pausable by the Guardian.
- **`RiskExecutor`**: The sole authorized entity that can borrow idle capital for the duration of a single transaction (`pullForTrade` → swap hops → `settleTrade`). Enforces max trade caps, NAV limits, slippage floors, and a daily loss circuit breaker on-chain.
- **Agent Trading Hot Key**: Autonomous off-chain bot submitter. **Has zero fund withdrawal rights and cannot modify its own risk parameters.**
- **DEX Adapters**: Pluggable venue adapters (`UniV3StyleAdapter`, `UniV2StyleAdapter`) that isolate swaps.
- **Live Indexer & Ledger**: Real-time service indexing blocks and logs from Monad Testnet, providing idempotent accounting.
- **AI Advisory Agent**: Provides advisory signal triage, explainability summaries, and executive reports without fund authority.
- **Warden Web3 Dashboard**: Operator & depositor interface for live NAV, wallet deposits, real-time metrics, and risk status.

---

## Deployed Contracts (Monad Testnet — Chain ID 10143)

| Contract | Address | Explorer Link |
| :--- | :--- | :--- |
| **MonadVault** | `0xd9fc6cC979472A5FA52750ae26805462E1638872` | [View on Monadscan](https://testnet.monadscan.com/address/0xd9fc6cC979472A5FA52750ae26805462E1638872) |
| **RiskExecutor** | `0x274f499201b0716e6CB632FF5BEc10cAD508eAD6` | [View on Monadscan](https://testnet.monadscan.com/address/0x274f499201b0716e6CB632FF5BEc10cAD508eAD6) |
| **Base Asset (USDC)** | `0x534b2f3A21130d7a60830c2Df862319e593943A3` | [View on Monadscan](https://testnet.monadscan.com/token/0x534b2f3A21130d7a60830c2Df862319e593943A3) |
| **Agent Hot Key** | `0x2c55614E7fC28894F55a7169ce0af42FAFF5E457` | Authorized on-chain executor |

---

## Quickstart

### 1. Run Smart Contract Tests (Foundry)
```bash
cd contracts
forge test
```
*(29 tests passing, including fuzz testing, inflation attack mitigations, and circuit breakers)*

### 2. Run Engine & AI Tests (Node.js)
```bash
cd engine
npm test
```
*(14 tests passing, including multi-hop arb simulation, risk checks, and ledger idempotency)*

### 3. Launch the Live Indexer & State Service
```bash
cd engine
npm start
```
*Runs on `http://127.0.0.1:4000` with live Monad Testnet block sync and JSON-RPC API.*

### 4. Launch the Warden Dashboard
```bash
cd dashboard
npm run dev
```
*Open `http://127.0.0.1:5173` in your browser to interact with the vault using MetaMask or any Web3 wallet.*
