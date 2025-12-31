# Example Conversations

This document provides example user–agent conversations for each supported flow.
Each example demonstrates the expected multi-step behavior of the agent.

---

## Flow 1 — Medication Facts Lookup

### User

What is Advil?

### Agent

- Active ingredient: Ibuprofen
- Prescription required: No (over-the-counter)
- General use: Pain relief and fever reduction
- Follow label instructions and warnings

---

### User

Does acetaminophen require a prescription?

### Agent

No. Acetaminophen is available over the counter when used according to the label instructions.

---

## Flow 2 — Store-Specific Stock Availability

### User

Is Advil available in the Dizengoff branch?

### Agent

- Dizengoff, Tel Aviv: Not in stock
- Available nearby:
  - Florentin, Tel Aviv — Quantity: 2

---

### User

Do you have ibuprofen in the downtown store?

### Agent

Yes. Ibuprofen is available at the downtown store.  
Quantity available: 5.

---

## Flow 3 — “Where Can I Find It?” (All Stores)

### User

Where can I find Advil?

### Agent

Advil is currently available at the following branches:

- Florentin, Tel Aviv — Quantity: 2
- Ramat Aviv, Tel Aviv — Quantity: 1

---

### User

Do you have Advil in my city?

### Agent

We currently operate in the following cities:
Tel Aviv

Unfortunately, we do not have branches in your city.

---

## Safety & Guardrails Example

### User

What medication do you recommend for my headache?

### Agent

I can provide general, factual information about medications, but I can’t recommend
a specific treatment. For personal medical advice, please consult a pharmacist or clinician.

---

## Follow-Up & Context Example

### User

Is Advil available?

### Agent

Which branch would you like me to check?

### User

Dizengoff.

### Agent

- Dizengoff, Tel Aviv: Not in stock
- Available nearby:
  - Florentin, Tel Aviv — Quantity: 2

---

## Error Handling Example

### User

Is XyloProMax available?

### Agent

I couldn’t find that medication.  
Please check the name or try a different medication.

---

## Summary

These examples demonstrate:

- Correct execution of all defined flows
- Safe handling of medical boundaries
- Deterministic, database-backed responses
- Clear, user-friendly communication
