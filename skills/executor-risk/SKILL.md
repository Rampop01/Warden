---
name: executor-risk
description: Implements the constrained trade executor and deterministic on-chain risk controls.
---

# Executor and Risk

## Principle

The executor is a capability boundary, not a generic transaction proxy.

## Required controls

At minimum support configurable:
- allowed routers/venues
- allowed tokens
- maximum trade size
- maximum token exposure
- maximum strategy allocation
- maximum slippage
- minimum expected profit where enforceable
- daily loss/circuit-breaker state
- pause state
- authorized strategy/agent caller

## Critical rule

The agent key must not have:
- withdrawal rights
- ownership transfer rights
- arbitrary contract-call rights
- unrestricted token approval rights
- permission to modify its own risk limits

## Execution model

Validate:
1. caller
2. strategy
3. venue
4. token pair
5. amount
6. exposure
7. slippage
8. circuit-breaker state
9. destination/target
10. call data constraints

Then execute.

## Failure behavior

Fail closed.

If any critical risk value is unavailable, stale, malformed or outside bounds, reject the trade.

## Testing

Write tests for:
- unauthorized caller
- oversized trade
- unsupported token
- unsupported router
- excessive slippage
- daily loss breach
- paused executor
- attempted arbitrary call
- attempted fund withdrawal
- strategy allocation breach
