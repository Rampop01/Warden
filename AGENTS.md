# AGENTS.md — Monad Trading Vault

## Mission

Build a production-oriented, non-custodial autonomous trading vault on Monad.

## Non-negotiable architecture

- The vault owns user funds.
- Strategy services identify opportunities.
- Deterministic risk controls approve/reject actions.
- The executor can only perform explicitly permitted actions.
- The agent has no withdrawal authority.
- The LLM must never be the sole authority for trade execution.
- Critical limits must be enforceable on-chain.
- Latency-sensitive arbitrage must not depend on an LLM round trip.
- Never invent Monad addresses, DEX router addresses, RPC endpoints, token addresses, or protocol APIs. Verify them from authoritative documentation/configuration.

## Default implementation sequence

Research → contracts → paper trading → testnet → capped pilot → intelligence → copy trading.

## Engineering rules

1. Inspect existing code before editing.
2. Preserve existing interfaces unless there is a documented reason to change them.
3. Prefer small, reviewable changes.
4. Add tests for every critical financial invariant.
5. Never hard-code production addresses without a verified source.
6. Treat token and router integrations as untrusted.
7. Use simulation before submission where possible.
8. Log every decision relevant to PnL and risk.
9. Never claim a trade is profitable using gross spread alone.
10. Account for fees, gas, slippage and price impact.
11. Keep secrets out of source control.
12. Never add a withdrawal capability to the agent key.
