---
name: arbitrage-engine
description: Builds the off-chain Monad-native arbitrage scanner, simulator and execution planner.
---

# Arbitrage Engine

## Goal

Find executable, net-profitable opportunities across approved Monad liquidity venues.

## Opportunity calculation

Never use raw price spread as profit.

Use:

expectedProfit =
grossOutput
- input
- DEX fees
- estimated gas
- expected slippage
- price impact
- execution overhead

Only submit when the expected edge exceeds configured safety margin.

## Pipeline

Market data
→ route discovery
→ quote collection
→ route profitability
→ liquidity check
→ simulation
→ deterministic risk check
→ transaction construction
→ executor
→ result reconciliation

## V1

Support:
- DEX-to-DEX arbitrage
- simple triangular routes if liquidity/data quality is sufficient

Avoid complex multi-hop routing until observability is strong.

## Simulation

Before submission:
- simulate the exact or equivalent call
- validate minimum output
- validate expected balances
- detect revert
- reject stale quotes

## Staleness

Every opportunity must carry:
- quote timestamp
- block number where applicable
- route
- input amount
- expected output
- expiry/deadline

Never execute an opportunity using an expired quote.

## PnL

Record:
- gross PnL
- gas cost
- protocol fees
- realized net PnL
- transaction hash
- strategy ID
- route
- timestamps
