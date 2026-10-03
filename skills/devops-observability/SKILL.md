---
name: devops-observability
description: Builds deployment, monitoring, alerting, secrets and operational controls for the Monad trading system.
---

# DevOps and Observability

## Environments

Maintain separate:
- local
- testnet
- staging/paper trading
- mainnet pilot

Never share production keys with development environments.

## Secrets

Use environment/secret management.

Never commit:
- private keys
- seed phrases
- API secrets
- RPC credentials
- database passwords

## Metrics

Track:
- opportunities detected
- opportunities rejected
- simulations
- executions
- execution failures
- gross PnL
- net PnL
- gas
- slippage
- drawdown
- vault NAV
- exposure
- circuit-breaker events
- agent errors

## Alerts

Trigger alerts for:
- unusual loss
- daily loss threshold
- repeated reverts
- unexpected executor calls
- stale market data
- indexer lag
- RPC failures
- balance discrepancies
- unauthorized access attempts

## Deployment

Every deployment must record:
- git commit
- contract address
- chain ID
- deployer/multisig
- configuration hash
- ABI version
- verification status
