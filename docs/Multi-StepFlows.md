# Multi-Step Flows Design

---

## Flow 1: Medication Information & Usage

### Purpose

Provide **factual information** about a medication, including:

- Active ingredient
- General usage instructions (leaflet-style)
- Prescription requirement (Rx / OTC)

### Example User Requests

- “What is Advil?”
- “מה החומר הפעיל באקמול?”
- “How do you use paracetamol?”

### Step-by-Step Sequence

1. **User asks** about a medication.
2. **Agent identifies** this as an informational request.
3. **Agent calls tool:** `get_medication_info`
4. **Tool returns** structured medication data from the internal DB.
5. **Agent responds** with:
   - Name of medication
   - Active ingredient
   - General usage instructions
   - Prescription requirement
6. **Safety check:**
   - No diagnosis
   - No personalized dosage
   - No encouragement to purchase

### Tools Used

- `get_medication_info`

### Final Response Characteristics

- Short, factual, leaflet-style
- No follow-up unless clarification is required

---

## Flow 2: Prescription Requirement Check

### Purpose

Clearly confirm whether a medication **requires a prescription**.

### Example User Requests

- “Does Advil require a prescription?”
- “צריך מרשם לאקמול?”
- “Is ibuprofen OTC?”

### Step-by-Step Sequence

1. **User asks** about prescription status.
2. **Agent classifies** the request as Rx/OTC check.
3. **Agent calls tool:** `check_prescription_requirement`
4. **Tool returns** boolean Rx status.
5. **Agent responds** with a clear factual answer:
   - “This medication does not require a prescription.”

### Tools Used

- `check_prescription_requirement`

### Final Response Characteristics

- Binary, unambiguous
- No medical advice
- No recommendations

---

## Flow 3: Stock Availability & Alternatives

### Purpose

Check **real-time inventory availability** and guide the user when stock is unavailable.

### Example User Requests

- “Is there Advil in Rehovot?”
- “יש אקמול ביפו?”
- “Is there paracetamol in NYC?”

### Step-by-Step Sequence

1. **User asks** about availability in a location.
2. **Agent identifies** inventory-related intent.
3. **Agent calls tool (forced):** `check_stock`
4. **Tool performs deterministic DB lookup** and returns:
   - Requested store stock (if applicable)
   - Alternative nearby stores with stock (sorted by distance)
   - Or a city-not-served response
5. **Agent responds** based on tool output:
   - If in stock → confirm availability
   - If out of stock in requested store → list nearby alternatives
   - If city not served → state: “We don’t have stores in <city>.”

### Tools Used

- `check_stock`

### Final Response Characteristics

- Factual and deterministic
- No suggestions to purchase
- No suggestions for unsupported locations
- Clear boundary of system capability

---
