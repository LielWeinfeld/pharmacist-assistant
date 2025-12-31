# Function (Tool) Design Requirements

---

## Tool 1: `get_medication_info`

### 1) Name and purpose

**Name:** `get_medication_info`  
**Purpose:** Resolve a medication by name/alias (Hebrew/English) and return factual medication information from the internal DB and leaflet consumer: active ingredient, Rx requirement, and leaflet-style usage text.

### 2) Inputs (parameters, types)

**Parameters (JSON schema):**

- `query` _(string, required)_ — medication name/brand/alias (e.g., `"אקמול"`, `"Advil"`, `"Paracetamol"`)

**Example input:**

```json
{ "query": "אקמול" }
```

### 3) Output schema (fields, types)

**Success output:**

- `ok` _(boolean)_ — `true`
- `medication` _(object)_
  - `id` _(string)_
  - `name` _(string)_
  - `activeIngredient` _(string)_
  - `prescriptionRequired` _(boolean)_
  - `labelUsage` _(string)_ — leaflet-style usage info (general, non-personalized)
- `matchedBy` _(string)_ — e.g. `"alias" | "name" | "ingredient" | "context"`

**Example success output:**

```json
{
  "ok": true,
  "medication": {
    "id": "med-2",
    "name": "Paracetamol",
    "activeIngredient": "Paracetamol (Acetaminophen)",
    "prescriptionRequired": false,
    "labelUsage": "Common OTC pain reliever/fever reducer. Follow the package leaflet..."
  },
  "matchedBy": "alias"
}
```

### 4) Error handling

**Not found:**

- `ok: false`
- `reason: "MED_NOT_FOUND"`

**Example error output:**

```json
{ "ok": false, "reason": "MED_NOT_FOUND" }
```

### 5) Fallback behavior

- If `resolveMedicationLoose(query)` fails, fallback to `findMedicationFromContext(messages)` to support follow-ups like:  
  “And does it require a prescription?” after the user already mentioned the drug earlier.
- If both fail → `MED_NOT_FOUND`.

---

## Tool 2: `check_prescription_requirement`

### 1) Name and purpose

**Name:** `check_prescription_requirement`  
**Purpose:** Return **only** whether a medication is **Rx** or **OTC** based on the internal DB (factual, no advice).

### 2) Inputs (parameters, types)

- `query` _(string, required)_ — medication name/brand/alias.

**Example input:**

```json
{ "query": "Advil" }
```

### 3) Output schema (fields, types)

**Success output:**

- `ok` _(boolean)_ — `true`
- `medication` _(object)_: `{ id: string, name: string }`
- `prescriptionRequired` _(boolean)_

**Example success output:**

```json
{
  "ok": true,
  "medication": { "id": "med-1", "name": "Ibuprofen" },
  "prescriptionRequired": false
}
```

### 4) Error handling

- `MED_NOT_FOUND` (same structure as Tool 1)

**Example error:**

```json
{ "ok": false, "reason": "MED_NOT_FOUND" }
```

### 5) Fallback behavior

- Same fallback as Tool 1: if direct lookup fails, use conversation context.

---

## Tool 3: `check_stock`

### 1) Name and purpose

**Name:** `check_stock`  
**Purpose:** Deterministically check inventory for a medication across stores.  
Supports:

- Stock in a **specific branch** (if requested)
- If requested branch is **out of stock** → return **alternative branches with stock sorted by distance**
- If requested city/location is **not served** → return “We don’t have stores in <city>.”

### 2) Inputs (parameters, types)

**Parameters:**

- `medication_query` _(string, required)_ — medication name/brand/alias.
- `store_query` _(string | null, optional)_ — store hint (e.g., `"יפו"`, `"Jaffa"`, `"101"`, `"Ramat Aviv"`).
- `show_all_stores` _(boolean, optional, default false)_ — if true, include all stores (even `qty=0`).

**Example input (specific branch):**

```json
{
  "medication_query": "Advil",
  "store_query": "Jaffa",
  "show_all_stores": false
}
```

### 3) Output schema (fields, types)

**Success output:**

- `ok` _(boolean)_ — `true`
- `medication` _(object)_
  - `id` _(string)_
  - `name` _(string)_
  - `activeIngredient` _(string)_
  - `prescriptionRequired` _(boolean)_
- `requestedStore` _(object | null)_
  - `storeLabel` _(string)_ — e.g. `"Jaffa, Tel Aviv"`
  - `qty` _(number)_
- `stores` _(array)_ — ordered by distance (closest first)
  - item:
    - `storeLabel` _(string)_
    - `qty` _(number)_
- `meta` _(object, optional)_
  - `showAllStores` _(boolean)_

**Example success output (requested store out of stock):**

```json
{
  "ok": true,
  "medication": {
    "id": "med-1",
    "name": "Ibuprofen",
    "activeIngredient": "Ibuprofen",
    "prescriptionRequired": false
  },
  "requestedStore": { "storeLabel": "Jaffa, Tel Aviv", "qty": 0 },
  "stores": [
    { "storeLabel": "Ramat Aviv, Tel Aviv", "qty": 5 },
    { "storeLabel": "Florentin, Tel Aviv", "qty": 3 }
  ],
  "meta": { "showAllStores": false }
}
```

### 4) Error handling

**Medication not found:**

```json
{ "ok": false, "reason": "MED_NOT_FOUND" }
```

**City not served (no stores there):**

- `ok: false`
- `reason: "CITY_NOT_SERVED"`
- `city` _(string)_
- `message` _(string)_ — e.g., “We don’t have stores in NYC.”

**Example:**

```json
{
  "ok": false,
  "reason": "CITY_NOT_SERVED",
  "city": "NYC",
  "message": "We don’t have stores in NYC."
}
```

### 5) Fallback behavior

- If `store_query` is missing/empty, infer store from the **user message** (e.g., “ביפו”).
- **Hard override:** “יפו/Jaffa” always maps to store `104` (prevents “יפו, תל אביב” city confusion).
- If no store specified:
  - Return `stores` list filtered to `qty > 0` by default, sorted by distance.
- If requested store exists but `qty == 0`:
  - Return alternatives with stock (sorted), excluding the requested store label.
