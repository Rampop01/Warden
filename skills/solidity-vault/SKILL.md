---
name: solidity-vault
description: Implements and reviews the ERC-4626-style Monad vault and accounting invariants.
---

# Solidity Vault

## Scope

Implement the vault that:
- accepts the approved base asset, initially USDC
- mints/burns vault shares
- reports total assets
- supports deposit/mint/withdraw/redeem flows
- accounts for realized trading PnL
- supports pause/emergency behavior
- supports carefully designed fees if enabled

## Invariants

At all times, verify:
- shares cannot be minted without corresponding accounting value
- users cannot withdraw more than their entitled assets
- share conversion remains internally consistent
- rounding cannot create exploitable value
- paused state prevents intended risk-bearing operations
- the trading agent cannot withdraw user funds
- only approved accounting/execution paths can alter asset exposure

## Implementation rules

- Use battle-tested OpenZeppelin primitives where appropriate.
- Follow checks-effects-interactions.
- Use safe token transfer patterns.
- Handle non-standard ERC-20 behavior defensively.
- Avoid unnecessary external calls during accounting.
- Write invariant/fuzz tests for share-price and deposit/withdraw behavior.

## Review questions

- Can a malicious token or router drain assets?
- Can rounding be exploited through repeated deposits/withdrawals?
- Can the executor call arbitrary targets?
- Can an agent key move assets to itself?
- Can fees be manipulated?
- What happens if a trade is pending or capital is temporarily unavailable?
