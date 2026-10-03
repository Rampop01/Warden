---
name: monad-research
description: Verifies Monad network, DEX, token, RPC, routing and indexing facts before implementation.
---

# Monad Research

## Rule

Never guess chain-specific infrastructure.

Before implementing a Monad integration, verify:
- network/chain configuration
- RPC availability
- deployed contract addresses
- DEX router/factory/pool interfaces
- supported token addresses
- quote/routing APIs
- event/indexing availability
- transaction simulation support
- official SDK/API documentation

## Output

Create a machine-readable configuration or typed constants layer with:
- network
- chain ID
- RPC source
- contract addresses
- protocol names
- ABI/interface references
- verification source
- last verified date

## Safety

Never paste an address into a production constant solely because it appeared in a chat message, blog post, social post, or unverified repository.

If a required integration cannot be verified, mark it `UNVERIFIED` and block production execution for that integration.
