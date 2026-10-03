---
name: testing-security
description: Provides testing, threat modeling, fuzzing and security review for the trading vault.
---

# Testing and Security

## Threat model

Assume:
- agent key can be compromised
- backend can be compromised
- DEX contracts can behave unexpectedly
- tokens can be malicious
- RPC/indexer data can be stale
- transactions can fail
- MEV actors can observe transactions
- users can be adversarial

## Smart contract tests

Include:
- unit tests
- integration tests
- fuzz tests
- invariant tests
- access-control tests
- pause tests
- accounting tests

## Critical invariants

Examples:
- agent cannot withdraw
- unauthorized addresses cannot execute
- unsupported targets cannot be called
- max trade size cannot be exceeded
- paused system cannot trade
- share accounting remains solvent
- fees cannot exceed configured bounds

## Integration tests

Test:
- real ABI encoding
- simulation
- reverted swaps
- stale quote rejection
- slippage failure
- partial external failure behavior
- event indexing
- PnL reconciliation

## Security gate

No production funds until:
- contract review
- test suite passes
- deployment addresses verified
- ownership/multisig configuration verified
- emergency procedure tested
- monitoring active
