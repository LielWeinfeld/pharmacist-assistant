import { Router, type Request, type Response } from "express";

import type { OpenAIMessage, SendChatRequest } from "../types/chat";

import { sseInit, sseDelta, sseDone, sseError } from "../utils/sse";
import { runGuardrailsOrNull } from "../utils/guardrails";
import { isStockQuestion, type Lang } from "../utils/stock";
import { streamOpenAIText } from "../services/openaiStream";

import {
  stores,
  findMedicationLoose,
  findStoreLoose,
} from "../db/synthetic";

import {
  buildStockData,
  findMedicationFromContext,
  extractMentionedCity,
  citiesSummaryHe,
  citiesSummaryEn,
} from "../utils/stockFlow";

const router = Router();
export default router;

/* ============================================================================
   Helpers
============================================================================ */

function cleanMessages(messages: OpenAIMessage[]): OpenAIMessage[] {
  return (Array.isArray(messages) ? messages : [])
    .filter((m) => m && (m.role === "system" || m.role === "user" || m.role === "assistant"))
    .map((m) => ({ role: m.role, content: String(m.content ?? "").trim() }))
    .filter((m) => m.content.length > 0);
}

function getLastUserText(messages: OpenAIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i].content;
  }
  return "";
}

function isYesNo(text: string): boolean {
  const t = text.trim().toLowerCase();
  return ["כן", "כן.", "yes", "sure", "ok", "אוקיי", "בבקשה"].includes(t);
}

function lastAssistantWasStockQuestion(messages: OpenAIMessage[]): boolean {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "assistant") {
      const t = m.content.toLowerCase();
      return (
        m.content.includes("זמינות") ||
        m.content.includes("סניפים") ||
        m.content.includes("כמות") ||
        m.content.includes("מלאי")||
        t.includes("in-stock") ||
        t.includes("availability") ||
        t.includes("otc") ||
        t.includes("qty")
      );
    }
  }
  return false;
}

function lastAssistantAskedForStore(messages: OpenAIMessage[]): boolean {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "assistant") {
      return (
        m.content.includes("רוצה לבדוק") ||
        m.content.includes("איזה סניף") ||
        m.content.includes("check a specific store")
      );
    }
  }
  return false;
}

/* ============================================================================
   Stock flow handler (same logic, extracted)
============================================================================ */

async function handleStockFlow(params: {
  res: Response;
  messages: OpenAIMessage[];
  userText: string;
  lang: Lang;
}) {
  const { res, messages, userText, lang } = params;

  // 1) resolve medication (from userText, else from context)
  let med = findMedicationLoose(userText);
  if (!med) med = findMedicationFromContext(messages);

  if (!med) {
    sseDelta(
      res,
      lang === "he"
        ? "לא הצלחתי לזהות איזו תרופה הכוונה. אפשר לציין שם תרופה?"
        : "I couldn’t determine which medication you mean. Please specify a name."
    );
    return sseDone(res);
  }

  // 2) resolve store (optional)
  const requestedStore = findStoreLoose(userText);

  // 3) handle unknown city mention (only if user mentions a city we don't have)
  const allowedCities = Array.from(new Set(stores.map((s) => s.city)));
  const mentionedCity = extractMentionedCity(userText, allowedCities);

  if (mentionedCity) {
    const allowedLower = allowedCities.map((c) => c.toLowerCase());
    const mentionedLower = mentionedCity.toLowerCase();

    if (!allowedLower.includes(mentionedLower)) {
      const prefix = lang === "he" ? citiesSummaryHe(allowedCities) : citiesSummaryEn(allowedCities);

      sseDelta(
        res,
        lang === "he"
          ? `${prefix}\nאין לנו סניפים ב${mentionedCity}.`
          : `${prefix}\nWe don’t have any branches in ${mentionedCity}.`
      );
      return sseDone(res);
    }
  }
if (!requestedStore && isYesNo(userText) && lastAssistantAskedForStore(messages)) {
    sseDelta(
      res,
      lang === "he"
        ? "מעולה, איזה סניף תרצה לבדוק? (יפו, פלורנטין, דיזנגוף, רמת אביב)"
        : "Great, which store would you like me to check? (Jaffa, Florentin, Dizengoff, Ramat Aviv)"
    );
    return sseDone(res);
  }

  // 5) build STOCK_DATA and let OpenAI draft the response using it
  const stockData = buildStockData(userText, med, requestedStore,lang);

  const stockSystem: OpenAIMessage = {
    role: "system",
    content:
      lang === "he"
        ? [
            "אתה עוזר רוקחי במצב 'מלאי'.",
            "חוק ברזל: כל העובדות על מלאי/כמויות/סניפים חייבות להגיע אך ורק מ-STOCK_DATA.",
            "אסור להמציא, אסור לנחש.",
            "אסור להציג מספרי סניפים. הצג רק storeLabel.",
            "אתה חייב להציג את הסניפים בדיוק לפי הסדר שמופיע ב-STOCK_DATA.stores (לפי order). אסור לשנות סדר או למיין מחדש.",
            "תשובה קצרה וברורה בבולטים.",
            "התשובה חייבת להיות בעברית בלבד (ללא אנגלית).",
          ].join("\n")
        : [
            "You are a pharmacist assistant in 'stock mode'.",
            "Hard rule: all stock facts must come ONLY from STOCK_DATA. No guessing.",
            "Do NOT show store numbers. Use storeLabel only.",
            "You MUST present stores in the exact order provided in STOCK_DATA.stores (by order). Do not reorder or sort.",
            "Keep it short, bullet points.",
            "Answer MUST be in English only (no Hebrew characters).",
          ].join("\n"),
  };

  const stockDataMsg: OpenAIMessage = {
    role: "system",
    content: `STOCK_DATA:\n${JSON.stringify(stockData, null, 2)}`,
  };

  await streamOpenAIText({
    messages: [stockSystem, stockDataMsg, { role: "user", content: userText }],
    onTextDelta: (delta) => sseDelta(res, delta),
    onDone: () => sseDone(res),
    onError: (err) => sseError(res, err.message || "Unknown error"),
  });
}

/* ============================================================================
   Route
============================================================================ */

router.post("/stream", async (req: Request, res: Response) => {
  sseInit(res);

  try {
    const body = req.body as SendChatRequest;
    const messages = cleanMessages(body?.messages ?? []);
    const userText = getLastUserText(messages);
    const lang: Lang = /[a-zA-Z]/.test(userText) ? "en" : "he";

    // Guardrails first
    const guardrailMsg = runGuardrailsOrNull(userText);
    if (guardrailMsg) {
      sseDelta(res, guardrailMsg);
      return sseDone(res);
    }

    /* ============================================================
       STOCK — OpenAI drafts answer but facts ONLY from DB JSON
       ============================================================ */
    const wasStockFlow = lastAssistantWasStockQuestion(messages);
    const continueStockFlow =
      isStockQuestion(userText) ||
      wasStockFlow ||
      (isYesNo(userText) && wasStockFlow);

    if (continueStockFlow) {
      await handleStockFlow({ res, messages, userText, lang });
      return;
    }

    /* ============================================================
       Normal (non-stock)
       ============================================================ */
    const systemPrompt: OpenAIMessage = {
      role: "system",
      content:
        lang === "he"
          ? "אתה עוזר רוקחי. מותר מידע כללי ועובדתי בלבד (התוויות, מרכיבים, צורך במרשם, מידע עלון). אסור אבחנה/ייעוץ אישי/עידוד רכישה."
          : "You are a pharmacist assistant. Provide factual general info only (indications, ingredients, prescription requirement, leaflet-style usage). No diagnosis/personal medical advice/purchase encouragement.",
    };

    const openAIMessages: OpenAIMessage[] = [
      systemPrompt,
      ...messages.filter((m) => m.role !== "system"),
    ];

    await streamOpenAIText({
      messages: openAIMessages,
      onTextDelta: (delta) => sseDelta(res, delta),
      onDone: () => sseDone(res),
      onError: (err) => sseError(res, err.message || "Unknown error"),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    sseError(res, msg);
  }
});
