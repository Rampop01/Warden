---
name: frontend-dashboard
description: Builds the user dashboard for vault balances, performance, trades, strategies and risk state.
---

# Frontend Dashboard

## Primary screens

1. Vault overview
2. Deposit/withdraw
3. NAV/share price
4. PnL
5. Strategy performance
6. Live execution feed
7. Trade details
8. Risk status
9. Wallet intelligence
10. Operator controls where authorized

## UX principles

Users should clearly distinguish:
- realized vs unrealized PnL
- gross vs net PnL
- strategy performance vs total vault performance
- pending vs confirmed transactions
- historical performance vs forecasts

Never imply guaranteed returns.

## Wallet interaction

- verify chain/network
- show transaction status
- handle rejected signatures
- prevent accidental wrong-network actions
- display token/share amounts with safe formatting

## Data integrity

Do not calculate authoritative NAV in the browser.

Display backend/indexed/on-chain authoritative values and clearly label estimates.
