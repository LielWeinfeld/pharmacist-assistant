// ---------------- Types & Data ----------------//
export type Store = {
  storeNumber: string;
  location: string;
  city: string;
  distanceRank: number;
};

export type Medication = {
  id: string;
  name: string;
  activeIngredient: string;
  prescriptionRequired: boolean;
  labelUsage: string;
  stockByStore: Record<string, number>; // key is storeNumber as a string
};

export type User = {
  id: string;
  fullName: string;
  locale: "he" | "en";
  ageGroup: "child" | "adult" | "senior";
  memberId: string;
};

export type MedicationMatch = {
  medication: Medication;
  matchedBy: "alias" | "name" | "ingredient";
};

export const stores: Store[] = [
  { storeNumber: "101", location: "רמת אביב", city: "תל אביב", distanceRank: 1 },
  { storeNumber: "102", location: "דיזנגוף", city: "תל אביב", distanceRank: 2 },
  { storeNumber: "103", location: "פלורנטין", city: "תל אביב", distanceRank: 3 },
  { storeNumber: "104", location: "יפו", city: "תל אביב", distanceRank: 4 },
];

export const medications: Medication[] = [
  {
    id: "med-1",
    name: "Advil",
    activeIngredient: "Ibuprofen",
    prescriptionRequired: false,
    labelUsage:
      "OTC pain reliever/anti-inflammatory. Follow leaflet for dosing by age/weight and max daily dose.",
    stockByStore: { "101": 5, "102": 0, "103": 3, "104": 0 },
  },
  {
    id: "med-2",
    name: "Paracetamol",
    activeIngredient: "Paracetamol (Acetaminophen)",
    prescriptionRequired: false,
    labelUsage:
      "Common OTC pain reliever/fever reducer. Follow leaflet for dosing by age/weight and maximum daily dose. Avoid taking multiple products that contain paracetamol.",
    stockByStore: { "101": 1, "102": 7, "103": 2, "104": 0 },
  },
  {
    id: "med-3",
    name: "Nurofen",
    activeIngredient: "Ibuprofen",
    prescriptionRequired: false,
    labelUsage: "OTC ibuprofen brand. Follow leaflet for dosing and max daily dose.",
    stockByStore: { "101": 0, "102": 2, "103": 0, "104": 1 },
  },
  {
    id: "med-4",
    name: "Augmentin",
    activeIngredient: "Amoxicillin + Clavulanic acid",
    prescriptionRequired: true,
    labelUsage: "Antibiotic. Use only under physician direction.",
    stockByStore: { "101": 0, "102": 1, "103": 0, "104": 0 },
  },
  {
    id: "med-5",
    name: "Zyrtec",
    activeIngredient: "Cetirizine",
    prescriptionRequired: false,
    labelUsage: "Antihistamine for allergy symptoms. Follow leaflet for dosing.",
    stockByStore: { "101": 2, "102": 2, "103": 2, "104": 2 },
  },
];

export const users: User[] = [
  { id: "u-1", fullName: "Noa Levi", locale: "he", ageGroup: "adult", memberId: "M-1001" },
  { id: "u-2", fullName: "Daniel Cohen", locale: "he", ageGroup: "adult", memberId: "M-1002" },
  { id: "u-3", fullName: "Maya Rosen", locale: "he", ageGroup: "adult", memberId: "M-1003" },
  { id: "u-4", fullName: "Yuval Ben-Ami", locale: "he", ageGroup: "adult", memberId: "M-1004" },
  { id: "u-5", fullName: "Tamar Shani", locale: "he", ageGroup: "senior", memberId: "M-1005" },
  { id: "u-6", fullName: "John Smith", locale: "en", ageGroup: "adult", memberId: "M-2001" },
  { id: "u-7", fullName: "Emily Johnson", locale: "en", ageGroup: "adult", memberId: "M-2002" },
  { id: "u-8", fullName: "Michael Brown", locale: "en", ageGroup: "senior", memberId: "M-2003" },
  { id: "u-9", fullName: "Sophia Davis", locale: "en", ageGroup: "adult", memberId: "M-2004" },
  { id: "u-10", fullName: "Liam Wilson", locale: "en", ageGroup: "child", memberId: "M-2005" },
];

// ------ Helpers handling data from the DB ------ //
function normalize(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, " ");
}

export function findMedicationLoose(text: string): Medication | null {
  const t = normalize(text);

  // Hebrew aliases
  if (t.includes("אדוויל") || t.includes("אדויל")) return medications.find(m => m.name.toLowerCase() === "advil") ?? null;
  if (t.includes("נורופן")) return medications.find(m => m.name.toLowerCase() === "nurofen") ?? null;
  if (t.includes("אוגמנטין")) return medications.find(m => m.name.toLowerCase() === "augmentin") ?? null;
  if (t.includes("זירטק") || t.includes("זירתק")) return medications.find(m => m.name.toLowerCase() === "zyrtec") ?? null;
  if (t.includes("אקמול") || t.includes("פרצטמול") || t.includes("פאראצטמול")) return medications.find(m => m.name.toLowerCase() === "paracetamol") ?? null;
  

  // English name match
  for (const m of medications) {
    if (t.includes(m.name.toLowerCase())) return m;
  }

  // Active ingredient match
  for (const m of medications) {
    const ai = normalize(m.activeIngredient);
    if (ai && t.includes(ai)) return m;
  }
  return null;
}

export function resolveMedicationLoose(text: string): MedicationMatch | null {
  const t = normalize(text);

  // Hebrew aliases
  if (t.includes("אדוויל") || t.includes("אדויל")) {
    const m = medications.find(m => m.name.toLowerCase() === "advil");
    return m ? { medication: m, matchedBy: "alias" } : null;
  }
  if (t.includes("נורופן")) {
    const m = medications.find(m => m.name.toLowerCase() === "nurofen");
    return m ? { medication: m, matchedBy: "alias" } : null;
  }
  if (t.includes("אוגמנטין")) {
    const m = medications.find(m => m.name.toLowerCase() === "augmentin");
    return m ? { medication: m, matchedBy: "alias" } : null;
  }
  if (t.includes("זירטק") || t.includes("זירתק")) {
    const m = medications.find(m => m.name.toLowerCase() === "zyrtec");
    return m ? { medication: m, matchedBy: "alias" } : null;
  }
  if (t.includes("אקמול") || t.includes("פרצטמול") || t.includes("פאראצטמול")) {
    const m = medications.find(m => m.name.toLowerCase() === "paracetamol");
    return m ? { medication: m, matchedBy: "alias" } : null;
  }

  // English name match
  for (const m of medications) {
    if (t.includes(m.name.toLowerCase())) {
      return { medication: m, matchedBy: "name" };
    }
  }

  // Active ingredient match
  for (const m of medications) {
    const ai = normalize(m.activeIngredient);
    if (ai && t.includes(ai)) {
      return { medication: m, matchedBy: "ingredient" };
    }
  }

  return null;
}


export function findStoreLoose(text: string): Store | null {
  const t = normalize(text);

  // by explicit store number
  const m = t.match(/\b(10[1-4])\b/);
  if (m) return stores.find(s => s.storeNumber === m[1]) ?? null;

  // Tel Aviv (city-level) → pick closest TA branch
  if (t.includes("תל אביב") || t.includes("tel aviv") || t.includes("tlv")) {
    return stores.sort((a, b) => a.distanceRank - b.distanceRank)[0] ?? null;
  }


  // by location keywords
  if (t.includes("רמת אביב") || t.includes("ramat aviv")) return stores.find(s => s.storeNumber === "101") ?? null;
  if (t.includes("דיזנגוף") || t.includes("dizengoff")) return stores.find(s => s.storeNumber === "102") ?? null;
  if (t.includes("פלורנטין") || t.includes("florentin")) return stores.find(s => s.storeNumber === "103") ?? null;
  if (t.includes("יפו") || t.includes("jaffa")) return stores.find(s => s.storeNumber === "104") ?? null;

  return null;
}

export function isAllStoresRequest(text: string): boolean {
  const t = normalize(text);
  return t.includes("כל הסניפים") || t.includes("all stores") || t.includes("every store");
}

export function getUserByMemberId(memberId: string): User | null {
  const m = String(memberId ?? "").trim();
  return users.find(u => u.memberId === m) ?? null;
}
