import type { Medication, Store } from "../src/db/synthetic";
import {
  stores,
  medications,
  resolveMedicationLoose,
  findStoreLoose,
} from "../src/db/synthetic";

import { getQuantity } from "../src/utils/stock";

export type ToolResult<T> = { ok: true; data: T } | { ok: false; reason: string; meta?: any };

/* =========================
   Tool 1: get_medication_by_name
   ========================= */

export type ResolveMedicationOut = {
  medication: Pick<
    Medication,
    "id" | "name" | "activeIngredient" | "prescriptionRequired" | "labelUsage"
  >;
  matchedBy: "name" | "ingredient" | "alias";
};

export function get_medication_by_name(query: string): ToolResult<ResolveMedicationOut> {
  const resolved = resolveMedicationLoose(query);
  if (!resolved) return { ok: false, reason: "MED_NOT_FOUND" };

  const med = resolved.medication;

  return {
    ok: true,
    data: {
      medication: {
        id: med.id,
        name: med.name,
        activeIngredient: med.activeIngredient,
        prescriptionRequired: med.prescriptionRequired,
        labelUsage: med.labelUsage,
      },
      matchedBy: resolved.matchedBy,
    },
  };
}

/* =========================
   Tool 2: get_store_by_location
   ========================= */

export type ResolveStoreOut = {
  store: Pick<Store, "storeNumber" | "location" | "city" | "distanceRank">;
  matchedBy: "storeNumber" | "location" | "cityAlias";
  supportedStores: { storeNumber: string; location: string; city: string }[];
};

export function get_store_by_location(query: string): ToolResult<ResolveStoreOut> {
  const st = findStoreLoose(query);
  const supportedStores = stores.map((s) => ({
    storeNumber: s.storeNumber,
    location: s.location,
    city: s.city,
  }));

  if (!st) {
    return { ok: false, reason: "STORE_NOT_FOUND", meta: { supportedStores } };
  }

  return {
    ok: true,
    data: {
      store: {
        storeNumber: st.storeNumber,
        location: st.location,
        city: st.city,
        distanceRank: st.distanceRank,
      },
      matchedBy: "location",
      supportedStores,
    },
  };
}

/* =========================
   Tool 3: check_stock
   ========================= */

export type StockOut =
  | {
      mode: "single_store";
      requestedStore: { storeLabel: string; quantity: number; available: boolean };
      alternativeStores: { storeLabel: string; quantity: number; order: number }[];
    }
  | {
      mode: "all_stores";
      stores: { storeLabel: string; quantity: number; order: number }[];
    };

export function check_stock(medicationId: string, storeNumber?: string): ToolResult<StockOut> {
  const med = medications.find((m) => m.id === medicationId);
  if (!med) return { ok: false, reason: "MED_NOT_FOUND" };

  const store = storeNumber ? stores.find((s) => s.storeNumber === String(storeNumber)) ?? null : null;

  // all stores list (ordered by distanceRank)
  const ordered = [...stores].sort((a, b) => a.distanceRank - b.distanceRank);

  const all = ordered.map((s, idx) => ({
    storeLabel: `${s.location}, ${s.city}`,
    quantity: getQuantity(med, s.storeNumber),
    order: idx + 1,
  }));

  if (!store) {
    return {
      ok: true,
      data: {
        mode: "all_stores",
        stores: all,
      },
    };
  }

  const qtyHere = getQuantity(med, store.storeNumber);

  const alternatives = all
    .filter((x) => x.quantity > 0 && x.storeLabel !== `${store.location}, ${store.city}`)
    .map((x) => ({ storeLabel: x.storeLabel, quantity: x.quantity, order: x.order }));

  return {
    ok: true,
    data: {
      mode: "single_store",
      requestedStore: {
        storeLabel: `${store.location}, ${store.city}`,
        quantity: qtyHere,
        available: qtyHere > 0,
      },
      alternativeStores: alternatives,
    },
  };
}
