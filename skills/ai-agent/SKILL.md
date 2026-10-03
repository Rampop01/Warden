---
name: ai-agent
description: Implements the AI reasoning, signal triage, explanation and reporting layer while keeping it outside the critical financial trust boundary.
---

# AI Agent

## Core rule

The AI proposes, ranks, classifies and explains.

Deterministic systems validate and enforce.

## Good AI tasks

- wallet behavior classification
- signal triage
- anomaly explanation
- trade rationale summaries
- operator alerts
- daily/weekly reports
- natural-language querying of historical trading data

## Bad AI tasks

Do not let an LLM:
- directly transfer vault assets
- choose arbitrary contract targets
- change its own risk limits
- bypass simulation
- bypass token/router allowlists
- approve its own transactions
- determine accounting truth

## Structured output

Use typed schemas for AI outputs.

Example:

{
  "signal_id": "...",
  "classification": "watch",
  "confidence": 0.0,
  "evidence": [],
  "recommended_action": "observe",
  "reasoning_summary": "..."
}

AI output is advisory until deterministic validation accepts the corresponding action.

## Reliability

- validate model output
- handle malformed JSON
- use bounded enums
- record model/version
- record prompt/config version
- keep source evidence
- never treat confidence as probability of profit
