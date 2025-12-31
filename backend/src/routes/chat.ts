import { Router, type Request, type Response } from "express";

import type { OpenAIMessage, SendChatRequest } from "../types/chat";
import { sseInit, sseDelta, sseDone, sseError } from "../utils/sse";
import { runGuardrailsOrNull } from "../utils/guardrails";

import { streamOpenAIText, type FunctionToolDef } from "../services/openaiStream";

import { stores, findStoreLoose, resolveMedicationLoose } from "../db/synthetic";
import {
  buildStockData,
  findMedicationFromContext,
  extractMentionedCity,
  citiesSummaryHe,
  citiesSummaryEn,
} from "../utils/stockFlow";
import { isStockQuestion, type Lang } from "../utils/stock";

const router = Router();
export default router;

/* ============================================================================
Helpers
============================================================================ */

function detectLang(text: string): Lang {
  return /[\u0590-\u05FF]/.test(text ?? "") ? "he" : "en";
}

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

function sseCustom(res: Response, eventName: string, payload: unknown) {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

/* ============================================================================
OpenAI function tools
============================================================================ */

const TOOLS: FunctionToolDef[] = [
  {
    type: "function",
    name: "get_medication_info",
    description:
      "Lookup factual medication information in the pharmacy database by name/alias. Returns active ingredient, Rx requirement, and leaflet-style usage.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Medication name/brand/alias (Hebrew or English)." },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "check_prescription_requirement",
    description:
      "Check whether a medication requires a prescription (Rx) or is OTC, based on the pharmacy database.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Medication name/brand/alias (Hebrew or English)." },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "check_stock",
    description:
      "Check inventory for a medication. If a specific store is requested and out of stock, returns alternative branches with stock sorted by distance.",
    parameters: {
      type: "object",
      properties: {
        medication_query: {
          type: "string",
          description: "Medication name/brand/alias (Hebrew or English).",
        },
        store_query: {
          type: ["string", "null"],
          description:
            "Optional store hint (store number or location like 'יפו', 'דיזנגוף', 'Jaffa'). If null, tool tries to infer from the user message.",
        },
        show_all_stores: {
          type: "boolean",
          description:
            "If true, return all stores (including out of stock). Otherwise return only stores with qty>0 (except requested store, which is always returned).",
        },
      },
      required: ["medication_query"],
      additionalProperties: false,
    },
  },
];

/* ============================================================================
Route
============================================================================ */

router.post("/stream", async (req: Request, res: Response) => {
  sseInit(res);

  try {
    const body = req.body as SendChatRequest;
    const messages = cleanMessages(body?.messages ?? []);
    const userText = getLastUserText(messages);
    const lang: Lang = detectLang(userText);

    // Guardrails first
    const guardrailMsg = runGuardrailsOrNull(userText);
    if (guardrailMsg) {
      sseDelta(res, guardrailMsg);
      return sseDone(res);
    }


    const forceStockTool = isStockQuestion(userText);

    const toolExecutor = async (name: string, args: unknown) => {
      const a = (typeof args === "object" && args !== null ? (args as any) : {}) as any;

      if (name === "get_medication_info") {
        const q = String(a.query ?? userText).trim();
        const resolved = resolveMedicationLoose(q);
        const med = resolved?.medication ?? findMedicationFromContext(messages);
        if (!med) {
          return { ok: false, reason: "MED_NOT_FOUND" as const };
        }
        return {
          ok: true,
          medication: {
            id: med.id,
            name: med.name,
            activeIngredient: med.activeIngredient,
            prescriptionRequired: med.prescriptionRequired,
            labelUsage: med.labelUsage,
          },
          matchedBy: resolved?.matchedBy ?? "context",
        };
      }

      if (name === "check_prescription_requirement") {
        const q = String(a.query ?? userText).trim();
        const resolved = resolveMedicationLoose(q);
        const med = resolved?.medication ?? findMedicationFromContext(messages);
        if (!med) {
          return { ok: false, reason: "MED_NOT_FOUND" as const };
        }
        return {
          ok: true,
          medication: { id: med.id, name: med.name },
          prescriptionRequired: Boolean(med.prescriptionRequired),
        };
      }

      if (name === "check_stock") {
        const medQ = String(a.medication_query ?? userText).trim();
        const storeQ =
          a.store_query === null || a.store_query === undefined ? "" : String(a.store_query);
        const showAll = Boolean(a.show_all_stores ?? false);

        const resolved = resolveMedicationLoose(medQ);
        const med = resolved?.medication ?? findMedicationFromContext(messages);
        if (!med) return { ok: false, reason: "MED_NOT_FOUND" as const };

        let requestedStore = (storeQ ? findStoreLoose(storeQ) : null) ?? findStoreLoose(userText);

        const t = `${storeQ} ${userText}`.toLowerCase();
        const mentionsJaffa = t.includes("יפו") || t.includes("jaffa") || t.includes("jafa");
        if (!requestedStore && mentionsJaffa) {
          requestedStore = stores.find((s) => s.storeNumber === "104") ?? null;
        }

        const allowedCities = Array.from(new Set(stores.map((s) => s.city)));
        const mentionedCity = extractMentionedCity(userText, allowedCities);
        if (mentionedCity && !requestedStore) {
          const allowedLower = allowedCities.map((c) => c.toLowerCase());
          if (!allowedLower.includes(mentionedCity.toLowerCase())) {
            return {
                ok: false,
                reason: "CITY_NOT_SERVED",
                city: mentionedCity,
                message:
                  lang === "he"
                    ? `אין לנו סניפים ב${mentionedCity}. אפשר לבדוק זמינות בערים שבהן יש לנו סניפים.`
                    : `We don’t have stores in ${mentionedCity}. You can check availability in cities where we operate.`,
              };


          }
        }

        const payload = buildStockData(userText, med, requestedStore, lang);

        if (showAll && payload.meta && payload.meta.showAllStores === false) {
          payload.meta.showAllStores = true;
        }

        return { ok: true, ...payload };
      }

      return { ok: false, reason: "UNKNOWN_TOOL" as const, tool: name };
    };

    await streamOpenAIText({
      messages,
      tools: TOOLS,
      toolExecutor,
      forcedToolName: forceStockTool ? "check_stock" : undefined,

      // Stream text to UI
      onTextDelta: (delta) => sseDelta(res, delta),
      onDone: () => sseDone(res),
      onError: (err) => sseError(res, err.message || "Unknown error"),

      // Show tool calls to UI
      onToolCall: (call) => {
        sseCustom(res, "tool_call", {
          id: call.call_id,
          name: call.name,
          input: call.arguments,
        });
      },
      onToolResult: (r) => {
        sseCustom(res, "tool_result", {
          id: r.call_id,
          name: r.name,
          output: r.output,
        });
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    sseError(res, msg);
  }
});
