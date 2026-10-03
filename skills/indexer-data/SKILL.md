---
name: indexer-data
description: Builds the Monad on-chain data ingestion, event processing and trading ledger.
---

# Indexer and Data

## Responsibilities

Collect and normalize:
- blocks
- transactions
- swaps
- liquidity events
- vault events
- executor events
- token metadata
- wallet activity
- strategy signals

## Data integrity

Every financial record should be traceable to:
- chain ID
- block number
- transaction hash
- log/event identifier where applicable
- timestamp
- contract address

## Processing

Use idempotent event processing.

A replayed block or event must not double-count:
- PnL
- deposits
- withdrawals
- shares
- trades

## Reorgs

Design ingestion so affected records can be marked/reconciled when chain history changes.

## Ledger

Maintain immutable trade facts and derived accounting separately.

Raw event:
what happened on-chain.

Derived record:
what it means for strategy PnL, NAV, exposure and reporting.

Never overwrite raw chain facts.
