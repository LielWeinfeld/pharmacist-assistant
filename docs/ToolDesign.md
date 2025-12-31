# Tool Design

## Tool 1 — get_medication_by_name

### Purpose

    Resolve a medication entity from the database using loose matching
    (medication name, active ingredient, or known aliases).

### Inputs

{
query: string;
locale?: "en";
}

### Output

{
ok: true;
medication: {
id: string;
name: string;
activeIngredient: string;
prescriptionRequired: boolean;
labelUsage: string;
};
matchedBy: "name" | "ingredient" | "alias";
}

### Errors

{
ok: false;
reason: "MED_NOT_FOUND";
}

### Error handling

    If no medication is found, return MED_NOT_FOUND.

### Fallback behavior

    If not found in the current message, callers may retry using conversation context.

---

## Tool 2 — get_store_by_location

### Purpose:

    Resolve a store or branch from free text (store name, city, or internal identifier).

### Inputs

    {
    query: string;
    }

### Output

    {
    ok: true;
    store: {
        storeNumber: string;
        location: string;
        city: string;
        distanceRank: number;
    };
    matchedBy: "storeNumber" | "location" | "cityAlias";
    }

### Errors

    {
    ok: false;
    reason: "STORE_NOT_FOUND";
    supportedCities?: string[];
    }

### Error handling

    If the requested store or city is not supported, return STORE_NOT_FOUND
    along with the list of supported cities.

### Fallback behavior

    If no store is resolved, the agent may continue in “all stores” mode instead of failing.

---

## Tool 3 — check_stock

### Purpose

    Return deterministic stock availability for a medication,
    either in a specific store or across all stores.

### Inputs

    {
    medicationId: string;
    storeNumber?: string;
    }

### Output (single store)

    {
    ok: true;
    mode: "single_store";
    requestedStore: {
        storeLabel: string;
        quantity: number;
        available: boolean;
    };
    alternativeStores: {
        storeLabel: string;
        quantity: number;
        order: number;
        }[];
    }

### Output (all stores)

    {
    ok: true;
    mode: "all_stores";
    stores: {
        storeLabel: string;
        quantity: number;
        order: number;
        }[];
    }

### Errors

    {
    ok: false;
    reason: "MED_NOT_FOUND" | "STORE_NOT_FOUND";
    }

### Fallback behavior

    If a store is not found but the intent is discovery (“where can I find it?”),
    the agent retries in all-stores mode.

    If no stores have stock, the response explicitly states that the medication is
    out of stock everywhere.
