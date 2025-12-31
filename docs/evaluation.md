# Agent Evaluation Plan

This document describes how the agent’s quality, safety, correctness, and performance
are evaluated. The goal is to ensure the agent behaves like a professional pharmacist
assistant: factual, safe, deterministic, and user-friendly.

---

## Evaluation Goals

The agent is evaluated on the following high-level goals:

1. **Factual correctness** — All medication and stock information must match the database.
2. **Safety & compliance** — The agent must not provide medical advice, diagnosis, or treatment recommendations.
3. **Hallucination prevention** — The agent must not invent medications, availability, or quantities.
4. **User experience** — Responses should be clear, concise, and streamed progressively.
5. **System reliability** — The system must behave predictably under normal and error conditions.

---

## Evaluation Dimensions & Metrics

### 1. Medication Knowledge Accuracy

**What is measured**

- Correct medication name resolution
- Correct active ingredient
- Correct prescription requirement (Rx / OTC)
- Correct general usage text (label-style)

**How it is evaluated**

- Unit tests comparing agent responses against database values
- Automated checks on `STOCK_DATA.medication` fields

**Success criteria**

- 100% match with database values
- No hallucinated medications or ingredients

---

### 2. Stock Availability Correctness

**What is measured**

- Correct quantities per store
- Correct ordering of stores by proximity
- No stock reported where quantity = 0

**How it is evaluated**

- Unit tests asserting `STOCK_DATA.stores` against the database
- Verification that store order is preserved exactly

**Success criteria**

- All stock facts come exclusively from database-backed data
- Zero false-positive availability

---

### 3. Safety & Guardrails Compliance

**What is measured**

- Detection of personal medical advice requests
- Proper refusal and redirection to a healthcare professional

**How it is evaluated**

- Automated tests with known “unsafe” prompts
- Manual review of edge cases (e.g., mixed factual + advice questions)

**Success criteria**

- 100% of disallowed requests are blocked
- Allowed factual questions are never blocked

---

### 4. Multi-Step Flow Execution

**What is measured**

- Correct identification of user intent (facts vs. stock vs. follow-up)
- Proper use of conversation context
- Correct branching between flows

**How it is evaluated**

- Integration tests simulating full conversations
- Example transcripts validated against expected sequences

**Success criteria**

- The agent follows the expected sequence for each defined flow
- No missing or skipped steps

---

### 5. Streaming & Latency Performance

**What is measured**

- Time to first token (TTFT)
- Progressive streaming behavior
- Proper stream termination (`done` event)

**How it is evaluated**

- Frontend E2E tests verifying multiple `delta` events
- Manual testing with network throttling

**Success criteria**

- First response chunk within acceptable latency
- UI updates incrementally
- Stream always ends with a `done` event

---

### 6. Error Handling & Resilience

**What is measured**

- Graceful handling of missing medications or stores
- Clear user-facing error messages
- No uncaught server errors

**How it is evaluated**

- Tests for invalid inputs
- Simulated upstream failures (e.g., OpenAI API error)

**Success criteria**

- The agent fails gracefully and informatively
- No crashes or undefined behavior

---

## Summary

The agent is considered **production-ready** when it:

- Produces deterministic, database-backed answers
- Never violates medical safety constraints
- Handles multi-step interactions reliably
- Provides a responsive, streaming user experience

This evaluation plan combines automated testing, manual review,
and UX validation to ensure consistent, safe, and correct behavior.
