# Router and Guardrails Architecture

## High-level overview

- **Core service with MCP-style router**: The intent router (`src/router/index.js`) lives inside the core runtime and exposes a minimal set of callbacks that mimic MCP tools. The router accepts channel-agnostic envelopes, annotates them with intent/entity metadata, enforces guardrails, and finally dispatches the payload to the correct domain module (Budget, Cashflow, or Goal). Modules are pluggable workers that run side-by-side with the router but remain stateless and channel agnostic.
- **Channel layer**: Twilio and Exotel adapters (`src/channels`) normalize inbound SMS/voice payloads and provide outbound helpers (including 15-second voice scripting hooks). The adapters also own offline resilience by pushing failed requests into a shared local queue so that no interaction is lost when providers are unavailable.
- **Interaction between layers**: Incoming events flow through adapters → router (intent extraction + prompt building) → modules → guardrails → adapters. Compliance (DPDP) and audit logging run orthogonally and are invoked by the router before any state is persisted.

## Intent extraction and prompt building

1. **Hybrid intent & entity extraction** (`src/router/intentExtractor.js`)
   - Deterministic keyword slots aggressively pick up well-known terms (budget, cashflow, goal) and capture entities such as monetary amounts and durations.
   - A light-weight embedding classifier compares user text with prototype corpora to recover intents even when keywords are absent. The router inspects both signals to determine the final intent and confidence.

2. **Channel-specific prompt builder** (`src/router/promptBuilder.js`)
   - The builder pulls the last 90 days of history (if consented) and serializes the three most recent turns.
   - Festival context is injected automatically (`src/utils/festivalContext.js`) but can be overridden per message.
   - Compliance reminders are appended and formatted per channel: SMS context is capped at 160 characters using `➤` separators, while voice scripts are capped at 60 seconds (~150 words).

## Modules and routing

- Routing rules live in `src/router/routingRules.js`; each intent maps to a dedicated module located under `src/modules`.
- Modules remain pure workers implementing domain-specific logic:
  - `BudgetModule`: expense caps and envelope reminders.
  - `CashflowModule`: short-term inflow/outflow cues.
  - `GoalModule`: milestone alignment and planning nudges.
- Modules receive the enriched prompt context so they can tailor their responses without touching channel specifics.

## Guardrails and safety

- `src/router/guardrails.js` combines semantic similarity (embeddings) with keyword classification to block content tied to debt, credit, or investment risk.
- When a response is blocked or rewritten, the guardrail logs a structured entry to `audit_log.jsonl` through `AuditLogger` to preserve an immutable audit trail.

## DPDP compliance flows

- `DPDPService` (`src/compliance/dpdpService.js`) is invoked before any history is stored:
  - If consent is missing, the service sends localized consent requests (SMS by default) and the router halts further processing until approval is recorded.
  - Automatic 48-hour deletion warnings are triggered after each successful interaction; the service deduplicates warnings for at least 12 hours.
  - User-language fallback messaging ensures unsupported locales automatically revert to English text while Hindi is natively supported.

## Channel adapters and offline guarantees

- Twilio and Exotel adapters extend a shared base and provide:
  - Normalized inbound/outbound SMS and voice helpers.
  - Voice-call scripting hooks that trim explanations to 15 seconds before invoking provider APIs.
  - Offline error handling—any transport failure results in the payload being pushed to `LocalQueue`, making retries deterministic and preventing data loss.

## Auditability and storage

- `HistoryStore` keeps a rolling log of interactions per user but is only written to once DPDP consent is confirmed.
- Guardrail blocks, consent status changes, and deletion notifications are all emitted to `audit_log.jsonl`, guaranteeing regulatory traceability.

## Testing strategy

- Jest-based tests exercise routing decisions, guardrail enforcement, DPDP notifications, and channel adapter failover logic to ensure regressions are caught early.
