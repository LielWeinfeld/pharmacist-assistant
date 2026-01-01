import { Router, type Request, type Response } from "express";

import type { OpenAIMessage, SendChatRequest } from "../types/chat";
import { sseInit, sseDelta, sseDone, sseError, sseEvent } from "../utils/sse";
import { runGuardrailsOrNull } from "../utils/guardrails";

import { streamOpenAIText, type FunctionToolDef } from "../services/openaiStream";

import { stores, findStoreLoose, resolveMedicationLoose } from "../db/synthetic";
import {
  buildStockData,
  findMedicationFromContext,
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

/**
 * Canonical city resolver
 * Maps user input → DB city value
 */
function canonicalizeCity(input: string): string | null {
  const t = String(input ?? "").trim().toLowerCase();

  if (["tel aviv", "tel-aviv", "telaviv", "tlv", "תל אביב"].includes(t)) {
    return "תל אביב";
  }

  return null;
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
      "Lookup factual medication information in the pharmacy database by name/alias.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "check_prescription_requirement",
    description:
      "Check whether a medication requires a prescription (Rx) or is OTC.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "check_stock",
    description:
      "Check inventory for a medication in a specific store or city.",
    parameters: {
      type: "object",
      properties: {
        medication_query: { type: "string" },
        store_query: { type: ["string", "null"] },
        show_all_stores: { type: "boolean" },
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

    // Guardrails
    const guardrailMsg = runGuardrailsOrNull(userText);
    if (guardrailMsg) {
      sseDelta(res, guardrailMsg);
      return sseDone(res);
    }

    const forceStockTool = isStockQuestion(userText);

    const toolExecutor = async (name: string, args: unknown) => {
      const a = (typeof args === "object" && args !== null ? args : {}) as any;

      /* ================= get_medication_info ================= */
      if (name === "get_medication_info") {
        const q = String(a.query ?? userText);
        const resolved = resolveMedicationLoose(q);
        const med = resolved?.medication ?? findMedicationFromContext(messages);
        if (!med) return { ok: false, reason: "MED_NOT_FOUND" };

        return {
          ok: true,
          medication: {
            id: med.id,
            name: med.name,
            activeIngredient: med.activeIngredient,
            prescriptionRequired: med.prescriptionRequired,
            labelUsage: med.labelUsage,
          },
        };
      }

      /* ================= check_prescription_requirement ================= */
      if (name === "check_prescription_requirement") {
        const q = String(a.query ?? userText);
        const resolved = resolveMedicationLoose(q);
        const med = resolved?.medication ?? findMedicationFromContext(messages);
        if (!med) return { ok: false, reason: "MED_NOT_FOUND" };

        return {
          ok: true,
          medication: { id: med.id, name: med.name },
          prescriptionRequired: med.prescriptionRequired,
        };
      }

      /* ================= check_stock ================= */
      if (name === "check_stock") {
        const medQ = String(a.medication_query ?? userText);
        const storeQ = String(a.store_query ?? "");
        const showAll = Boolean(a.show_all_stores);

        const resolved = resolveMedicationLoose(medQ);
        const med = resolved?.medication ?? findMedicationFromContext(messages);
        if (!med) return { ok: false, reason: "MED_NOT_FOUND" };

        // Try explicit store
        let requestedStore =
          (storeQ && findStoreLoose(storeQ)) ||
          findStoreLoose(userText);

        // Try city (canonical)
        if (!requestedStore) {
          const canonicalCity = canonicalizeCity(storeQ || userText);
          if (canonicalCity) {
            requestedStore =
              stores
                .filter((s) => s.city === canonicalCity)
                .sort((a, b) => a.distanceRank - b.distanceRank)[0] ?? null;
          }
        }

        // City truly not served
        if (!requestedStore) {
          const canonicalCity = canonicalizeCity(storeQ || userText);
          if (canonicalCity === null) {
            return {
              ok: false,
              reason: "CITY_NOT_SERVED",
              message:
                lang === "he"
                  ? "אין לנו סניפים בעיר שציינת."
                  : "We don’t have stores in that city.",
            };
          }
        }

        const payload = buildStockData(userText, med, requestedStore, lang);
        if (showAll && payload.meta) payload.meta.showAllStores = true;

        return { ok: true, ...payload };
      }

      return { ok: false, reason: "UNKNOWN_TOOL" };
    };

    await streamOpenAIText({
      messages,
      tools: TOOLS,
      toolExecutor,
      forcedToolName: forceStockTool ? "check_stock" : undefined,
      onTextDelta: (d) => sseDelta(res, d),
      onDone: () => sseDone(res),
      onError: (e) => sseError(res, e.message),
      onToolCall: (c) =>
        sseCustom(res, "tool_call", { name: c.name, input: c.arguments }),
      onToolResult: (r) =>
        sseCustom(res, "tool_result", { name: r.name, output: r.output }),
    });
  } catch (err) {
    sseError(res, err instanceof Error ? err.message : "Unknown error");
  }
});
