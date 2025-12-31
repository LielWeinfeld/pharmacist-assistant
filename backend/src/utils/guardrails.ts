const advicePatterns: RegExp[] = [
  /מה (כדאי|מומלץ) (לעשות|לקחת)/i,
  /האם (כדאי|מותר) (לי )?(לקחת|לשלב)/i,
  /כמה (כדאי|מומלץ) לקחת/i,
  /אבחון|לאבחן|מה יש לי/i,
  /should i (take|use|combine)/i,
  /what should i do/i,
  /diagnose|diagnosis/i,
];

function isHebrew(text: string) {
  return /[\u0590-\u05FF]/.test(text);
}

export function runGuardrailsOrNull(userText: string): string | null {
  const text = (userText ?? "").trim();
  if (!text) return null;

  const he = isHebrew(text);

  if (advicePatterns.some((r) => r.test(text))) {
    return he
      ? "אני יכולה לתת מידע עובדתי כללי מהעלון על תרופות (שימושים, רכיבים פעילים, מרשם/ללא מרשם, הנחיות כלליות). אם זו שאלה אישית לגבי מינון/מצב רפואי - כדאי להתייעץ עם רוקח/רופא."
      : "I can share general, factual leaflet information (uses, active ingredients, Rx/OTC, general label directions). For personal dosing/medical decisions, please consult a pharmacist or clinician.";
  }

  return null;
}