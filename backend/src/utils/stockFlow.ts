import type { OpenAIMessage } from "../types/chat";
import {
  stores,
  findMedicationLoose,
  isAllStoresRequest,
  type Medication,
  type Store,
} from "../db/synthetic";
import { isAllStoresFollowup } from "../utils/stock";

const LOCATION_EN: Record<string, string> = {
  "רמת אביב": "Ramat Aviv",
  "דיזנגוף": "Dizengoff",
  "פלורנטין": "Florentin",
  "יפו": "Jaffa",
};

const CITY_EN: Record<string, string> = {
  "תל אביב": "Tel Aviv",
};

export function qtyInStore(med: Medication, storeNumber: string): number {
  const raw = med.stockByStore?.[String(storeNumber)];
  const n = typeof raw === "number" ? raw : 0;
  return Number.isFinite(n) ? n : 0;
}

function toStoreLabel(location: string, city: string, lang: "he" | "en") {
  if (lang === "he") return `${location}, ${city}`;
  return `${LOCATION_EN[location] ?? location}, ${CITY_EN[city] ?? city}`;
}

export function buildStockData(userText: string, med: Medication, requestedStore: Store | null, lang: "he" |"en") {
  const showAllStores = isAllStoresRequest(userText) || isAllStoresFollowup(userText);

  const internal = stores.map((s) => ({
    storeLabel: toStoreLabel(s.location, s.city, lang),
    rank: s.distanceRank,
    qty: qtyInStore(med, s.storeNumber),
    storeNumber: s.storeNumber,
  }));

  const pivotRank = requestedStore?.distanceRank ?? null;

  const sorted =
    pivotRank === null
      ? [...internal].sort((a, b) => a.rank - b.rank)
      : [...internal].sort((a, b) => {
          const da = Math.abs(a.rank - pivotRank);
          const db = Math.abs(b.rank - pivotRank);
          if (da !== db) return da - db;
          return a.rank - b.rank;
        });

  const othersOnly = requestedStore
    ? sorted.filter((p) => p.storeNumber !== requestedStore.storeNumber)
    : sorted;

  const storesToReturn = showAllStores ? othersOnly : othersOnly.filter((x) => x.qty > 0);

  return {
    medication: {
      id: med.id,
      name: med.name,
      activeIngredient: med.activeIngredient,
      prescriptionRequired: med.prescriptionRequired,
    },
    requestedStore: requestedStore
      ? {
          storeLabel: toStoreLabel(requestedStore.location, requestedStore.city, lang),
          qty: qtyInStore(med, requestedStore.storeNumber),
        }
      : null,

    stores: storesToReturn.map((s, idx) => ({
      order: idx + 1,
      storeLabel: s.storeLabel,
      qty: s.qty,
    })),

    meta: {
      showAllStores,
      sortedBy: requestedStore ? "RELATIVE_TO_REQUESTED_STORE" : "GLOBAL_DISTANCE_RANK",
      rule: "Preserve order exactly as given in stores[]. Do not reorder.",
    },
  };
}

export function findMedicationFromContext(messages: OpenAIMessage[]): Medication | null {
  // חפש אחורה הודעות user ו-assistant
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "user" || m.role === "assistant") {
      const med = findMedicationLoose(m.content);
      if (med) return med;
    }
  }
  return null;
}

export function extractMentionedCity(text: string, allowedCities: string[]): string | null {
  const t = String(text ?? "").trim().toLowerCase();

  for (const city of allowedCities) {
    if (t.includes(city.toLowerCase())) return city;
  }

  const hasAvailabilityIntent =
    /\b(האם\s+)?יש\b/.test(t) ||
    t.includes("available") ||
    t.includes("in stock") ||
    t.includes("do you have") ||
    t.includes("do u have");

  if (!hasAvailabilityIntent) return null;

  const mEn = t.match(/\bin\s+([a-z][a-z\s'-]{1,30})[?.!,]?\b/);
  if (mEn) return mEn[1].trim();

  const m1 = t.match(/(?:^|\s)(?:האם\s+)?יש\s+ב\s*([א-ת]{2,}(?:\s+[א-ת]{2,})?)(?=[\s?.,!]|$)/);
  if (m1) return m1[1].trim();

  const m2 = t.match(/(?:^|\s)ב\s*([א-ת]{2,}(?:\s+[א-ת]{2,})?)(?=\s+יש\b|\?)/);
  if (m2) return m2[1].trim();

  return null;
}

export function citiesSummaryHe(cities: string[]): string {
  const uniq = Array.from(new Set(cities.map((c) => c.trim()).filter(Boolean)));
  if (uniq.length === 0) return "לרשת אין סניפים מוגדרים כרגע.";
  if (uniq.length === 1) return `לרשת יש סניפים רק ב${uniq[0]}.`;
  if (uniq.length === 2) return `לרשת יש סניפים רק ב${uniq[0]} ו${uniq[1]}.`;
  return `לרשת יש סניפים רק ב${uniq.slice(0, -1).join(", ")} ו${uniq[uniq.length - 1]}.`;
}

export function citiesSummaryEn(cities: string[]): string {
  const uniq = Array.from(new Set(cities.map((c) => c.trim()).filter(Boolean)));
  const uniqEn = uniq.map((c) => CITY_EN[c] ?? c);
  if (uniqEn.length === 0) return "The chain currently has no configured branches.";
  if (uniqEn.length === 1) return `The chain has branches only in ${uniqEn[0]}.`;
  if (uniqEn.length === 2) return `The chain has branches only in ${uniqEn[0]} and ${uniqEn[1]}.`;
  return `The chain has branches only in ${uniqEn.slice(0, -1).join(", ")} and ${uniqEn[uniqEn.length - 1]}.`;
}

