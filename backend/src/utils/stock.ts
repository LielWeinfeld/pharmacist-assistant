import type { Medication, Store } from "../db/synthetic";
import { stores, findMedicationLoose, findStoreLoose, isAllStoresRequest } from "../db/synthetic";

export type Lang = "he" | "en";

function norm(s: string): string {
  return String(s ?? "").toLowerCase();
}

export function isStockQuestion(userText: string): boolean {
  const t = norm(userText);

  // Hebrew stock intent
  const he =
    t.includes("מלאי") ||
    t.includes("במלאי") ||
    t.includes("זמין") ||
    t.includes("זמינות") ||
    t.includes("יש לכם") ||
    t.includes("יש בסניף") ||
    t.includes("בסניף") ||
    t.includes("איפה יש") ||
    t.includes("איפה ניתן למצוא");

  // English stock intent
  const en =
    t.includes("stock") ||
    t.includes("in stock") ||
    t.includes("available") ||
    t.includes("availability") ||
    t.includes("do you have") ||
    t.includes("at the store")||
    t.includes("avaliable");

  return he || en;
}

export function isAllStoresFollowup(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("עוד") ||
    t.includes("נוספים") ||
    t.includes("אחרים") ||
    t.includes("additional") ||
    t.includes("other stores") ||
    t.includes("all stores") ||
    t.includes("anywhere")
  );
}


export type InStockStore = {
  storeNumber: string;
  location: string;
  city: string;
  distanceRank: number;
  quantity: number;
};

export function getQuantity(med: Medication, storeNumber: string): number {
  const raw = med.stockByStore?.[String(storeNumber)];
  return Number.isFinite(raw) ? Number(raw) : 0;
}

export function computeInStockStores(med: Medication): InStockStore[] {
  return stores
    .map((s) => ({
      storeNumber: s.storeNumber,
      location: s.location,
      city: s.city,
      distanceRank: s.distanceRank,
      quantity: getQuantity(med, s.storeNumber),
    }))
    .filter((x) => x.quantity > 0)
    .sort((a, b) => a.distanceRank - b.distanceRank);
}

export type AvailabilityResult =
  | { ok: false; reason: "MED_NOT_FOUND" | "STORE_NOT_FOUND" }
  | {
      ok: true;
      medication: Medication;
      requestedStore: Store;
      availableHere: boolean;
      quantity: number; // 0 if not available here
      inStockStores: InStockStore[]; // other stores with >0, sorted by distanceRank
      allStoresRequested: boolean;
    };

export function checkAvailability(userText: string): AvailabilityResult {
  const medication = findMedicationLoose(userText);
  if (!medication) return { ok: false, reason: "MED_NOT_FOUND" };

  const requestedStore = findStoreLoose(userText);
  if (!requestedStore) return { ok: false, reason: "STORE_NOT_FOUND" };

  const quantity = getQuantity(medication, requestedStore.storeNumber);
  const inStockStores = computeInStockStores(medication);

  return {
    ok: true,
    medication,
    requestedStore,
    availableHere: quantity > 0,
    quantity,
    inStockStores,
    allStoresRequested: isAllStoresRequest(userText),
  };
}
