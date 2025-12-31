# Agent Multi-Step Flows & Tool Design

This document describes the multi-step flows supported by the agent and the internal tools it uses.
The agent is designed as a **pharmacist assistant**, providing factual medication information and
stock availability, while strictly avoiding medical advice, diagnosis, or purchase encouragement.

---

## Overview

The agent supports **three distinct multi-step flows**, each representing a realistic customer interaction.
All flows follow these shared principles:

- **Safety first**: personal medical advice is blocked via guardrails.
- **Deterministic facts**: medication and stock data always come from the database.
- **Streaming responses**: answers are returned incrementally via Server-Sent Events (SSE).
- **Clear separation of concerns**: routing, business logic, and external integrations are isolated.

---

# Flow 1 — Medication Facts Lookup (Non-Stock)

## Use case

The user asks for general, factual information about a medication.

**Examples**

- “What is Advil?”
- “What is the active ingredient of acetaminophen?”
- “Does ibuprofen require a prescription?”

## Expected sequence

1. Receive the user request.
2. Run safety guardrails to detect requests for personal medical advice.
   - If triggered → respond with a refusal and redirect to a healthcare professional.
3. Identify the medication by name or active ingredient.
4. Retrieve factual medication data from the database.
5. Compose a short, factual response (indications, active ingredient, prescription requirement, leaflet-style usage).
6. Stream the response to the frontend.
7. End the stream.

## Tools used

- `get_medication_by_name`

## Agent response behavior

- Uses concise, factual language (often bullet points).
- Does not personalize dosage or treatment.
- If the medication is not found, asks the user to clarify the name.

---

# Flow 2 — Store-Specific Stock Availability

## Use case

The user asks whether a medication is available in a specific store or branch.

**Examples**

- “Is Advil available in the Dizengoff branch?”
- “Do you have ibuprofen in the downtown store?”

## Expected sequence

1. Receive the user request.
2. Run safety guardrails.
3. Identify the medication from the message or conversation context.
4. Identify the requested store from the message.
5. Query stock availability for that medication and store from the database.
6. Compute alternative nearby stores with available stock, ordered by proximity.
7. Build a structured `STOCK_DATA` object containing only database-backed facts.
8. Pass `STOCK_DATA` to the language model for phrasing only.
9. Stream the response.
10. End the stream.

## Tools used

- `get_medication_by_name`
- `get_store_by_location`
- `check_stock`

## Agent response behavior

- If in stock: confirms availability and quantity.
- If not in stock: clearly states unavailability and lists alternative branches with stock.
- Does not show internal store identifiers or reorder stores.

---

# Flow 3 — “Where Can I Find It?” (All Stores)

## Use case

The user asks where a medication is available without specifying a particular store.

**Examples**

- “Where can I find Advil?”
- “Which branches have ibuprofen?”
- “Do you have this medication in my city?” (unsupported city)

## Expected sequence

1. Receive the user request.
2. Run safety guardrails.
3. Identify the medication.
4. Detect whether a city is mentioned:
   - If the city is not supported → respond with a list of supported cities and stop.
5. Query all stores with quantity greater than zero for the medication.
6. Order stores by proximity (`distanceRank`).
7. Build `STOCK_DATA` with the ordered list of stores.
8. Let the language model format the response using only `STOCK_DATA`.
9. Stream the response.
10. End the stream.

## Tools used

- `get_medication_by_name`
- `list_stores`
- `check_stock` (all-stores mode)

## Agent response behavior

- Returns a clear list of stores with available stock.
- If no stock exists anywhere, states this explicitly.
- Never invents availability.
