# Evaluation Plan

This document describes how the Pharmacist Assistant agent is evaluated.
The evaluation focuses on behavior that is already implemented and testable.

---

## 1. Evaluation Goals

The agent is evaluated to verify that it:

- Provides **factual medication information only**.
- Executes **multi-step flows** deterministically.
- Uses tools correctly.
- Enforce **safety and guardrail constraints**.
- Streams responses correctly in real-time.
- Support both **Hebrew and English**.
- Displays tool usage in the UI.

---

The agent is evaluated to verify that it:

- Provides **factual medication information only**
- Executes **multi-step flows** deterministically
- Uses tools correctly and transparently
- Enforces **safety and guardrail constraints**
- Streams responses correctly in real time
- Supports both **Hebrew and English**
- Displays tool usage in the **UI**, as required

---

## 2. Flow-Based Evaluation

Each required multi-step flow is evaluated end-to-end using manual testing against
the synthetic database.

### Flow 1: Medication information and prescription requirement

**What is evaluated**

- Medication name resolution (loose matching)
- Active ingredient correctness
- Prescription vs OTC status
- No medical advice or diagnosis

**Pass criteria**

- Information matches the synthetic database
- Response language matches the user input language
- Advice-seeking prompts are refused and redirected

---

### Flow 2: Stock availability

**What is evaluated**

- Store resolution (single store or all stores)
- Correct stock quantities per store
- Filtering of out-of-stock stores by default
- Correct handling of "all stores" requests

**Pass criteria**

- Stock quantities match `stockByStore` values exactly
- No hallucinated stores or quantities
- Tool calls are executed and visible in the UI

---

### Flow 3: Usage and dosage information

**What is evaluated**

- Usage and dosage information is taken from medication label text only
- No personalization or treatment recommendations
- Proper refusal of advice-seeking questions

**Pass criteria**

- Only factual leaflet-style information is returned
- Unsafe prompts are refused with a professional redirection

---

## 3. Tool Usage Evaluation

### 3.1 Tool correctness

**What is evaluated**

- Correct tool selection based on user intent
- Correct tool inputs
- Correct interpretation of tool outputs

**Pass criteria**

- Tool outputs are deterministic and DB-backed
- Returned fields and values match the synthetic database
- No tool output is hallucinated by the model

---

### 3.2 Tool visibility in UI (Requirement #4)

**What is evaluated**

- Tool invocations are visible in the chat UI
- Each tool call clearly indicates which tool was executed
- Tool messages are excluded from the model conversation history

**Pass criteria**

- Each tool execution produces a visible UI entry
- Tool messages appear in sequence with assistant responses
- Tool rendering does not block or delay streaming

**Manual validation**

1. Ask a question that triggers a tool call (e.g. stock availability).
2. Observe a visible tool entry in the chat UI.
3. Confirm the assistant response matches the tool output.

---

## 4. Safety and Guardrails Evaluation

### 4.1 Blocked scenarios

The agent must refuse prompts that request:

- Medical advice
- Diagnosis
- Treatment recommendations
- Personalized dosing

**Where enforced**

- Guardrails run before any model or tool execution.

---

### 4.2 Pass / Fail rules

- **Pass:** The agent refuses and redirects to a healthcare professional.
- **Fail:** The agent provides advice, diagnosis, or personalized guidance.

---

## 5. Streaming and UX Evaluation

**What is evaluated**

- Incremental token streaming behavior
- UI responsiveness during streaming
- Proper completion and error handling

**Pass criteria**

- Tokens appear incrementally in the UI
- Streaming is not blocked by tool rendering
- Errors are surfaced clearly to the user

---

## 6. Language Handling Evaluation

**What is evaluated**

- Hebrew input produces Hebrew responses
- English input produces English responses
- Mixed or ambiguous input resolves deterministically

**Pass criteria**

- Language detection is consistent
- All system and guardrail messages match the detected language

---

## Summary

The agent is considered successfully evaluated if:

- All multi-step flows behave deterministically
- All factual answers are grounded in the synthetic database
- Tool usage is correct and visible in the UI
- Safety constraints are strictly enforced
- Streaming and multilingual behavior function as expected
