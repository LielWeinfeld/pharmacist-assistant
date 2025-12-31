import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import type { OpenAIMessage } from "../types/chat";
import { medications, stores } from "../db/synthetic";

/* ---------------- mocks ---------------- */

type StreamArgs = {
  messages: OpenAIMessage[];
  onTextDelta: (delta: string) => void | Promise<void>;
  onDone: () => void | Promise<void>;
  onError: (err: Error) => void | Promise<void>;
};

const streamSpy = vi.fn();

vi.mock("../services/openaiStream", () => ({
  streamOpenAIText: async (args: StreamArgs) => {
    streamSpy(args);
    await args.onTextDelta("STREAM_CHUNK_1\n");
    await args.onTextDelta("STREAM_CHUNK_2\n");
    await args.onDone();
  },
}));

vi.mock("../utils/guardrails", () => ({
  runGuardrailsOrNull: (text: string) => {
    const t = text.toLowerCase();
    if (
      t.includes("ממליץ") ||
      t.includes("recommend") ||
      t.includes("what should i take")
    ) {
      return "אני לא יכול להמליץ על טיפול רפואי אישי. מומלץ להתייעץ עם רופא או רוקח.";
    }
    return null;
  },
}));

/* ---------------- helpers ---------------- */

async function makeApp() {
  const { default: chatRouter } = await import("./chat"); // ✅ אחרי mocks

  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use("/api/chat", chatRouter);
  return app;
}


function reqBody(content: string) {
  return { messages: [{ role: "user", content }] };
}

function extractStockData(messages: OpenAIMessage[]) {
  const sysMsg = messages.find(
    (m) =>
      m.role === "system" &&
      typeof m.content === "string" &&
      m.content.includes("STOCK_DATA:")
  );

  if (!sysMsg) return null;

  const txt = String(sysMsg.content);
  const idx = txt.indexOf("STOCK_DATA:");
  const json = txt.slice(idx + "STOCK_DATA:".length).trim(); // כולל ה-\n שאחריו

  return JSON.parse(json) as {
    medication: {
      name: string;
      activeIngredient: string;
      prescriptionRequired: boolean;
    };
    requestedStore?: {
      storeLabel: string;
      quantity: number;
    } | null;
    stores: Array<{
      storeLabel: string;
      quantity: number;
    }>;
  };
}


/* ---------------- tests ---------------- */

describe("Chat /stream – requirements", () => {
  beforeEach(() => {
    streamSpy.mockClear();
  });

  it("8) streams responses using SSE", async () => {
    const app = await makeApp();

    const res = await request(app)
      .post("/api/chat/stream")
      .send(reqBody("hello"))
      .expect(200);

    expect(res.headers["content-type"]).toContain("text/event-stream");
    expect(res.text).toContain("STREAM_CHUNK_1");
    expect(res.text).toContain("STREAM_CHUNK_2");
  });

  it("6+7) blocks medical advice and redirects to professional", async () => {
    const app = await makeApp();

    const res = await request(app)
      .post("/api/chat/stream")
      .send(reqBody("על איזה תרופה אתה ממליץ?"))
      .expect(200);

    expect(res.text).toContain("לא יכול להמליץ");
    expect(streamSpy).not.toHaveBeenCalled();
  });

  it("4) stock availability is taken from DB only", async () => {
    const app = await makeApp();

    const med = medications[0];
    expect(med).toBeDefined();

    const store = stores.find(s => s.storeNumber === "102")!; // Dizengoff

    const question = `Is ${med.name} available in dizengoff? stock`;

    await request(app)
      .post("/api/chat/stream")
      .send(reqBody(question))
      .expect(200);

    const args = streamSpy.mock.calls[0][0];
    const stockData = extractStockData(args.messages);

    expect(stockData).not.toBeNull();

    const expectedQty = Number(
      med.stockByStore?.[String(store.storeNumber)] ?? 0
    );

    const expectedLabel = `${store.location}, ${store.city}`;
    const entry = stockData!.stores.find(
      (s) => s.storeLabel === expectedLabel
    );

    if (expectedQty > 0) {
      expect(entry).toBeTruthy();
      expect(entry!.quantity).toBe(expectedQty);
    }
  });


  it("1+3+5) medication facts include ingredient and prescription flag", async () => {
    const app = await makeApp();
    const med = medications[0];

    await request(app)
      .post("/api/chat/stream")
      .send(reqBody(`איפה יש ${med.name}?`))
      .expect(200);

    const args = streamSpy.mock.calls[0][0];
    const stockData = extractStockData(args.messages)!;

    expect(stockData.medication.name).toBe(med.name);
    expect(stockData.medication.activeIngredient).toBe(med.activeIngredient);
    expect(stockData.medication.prescriptionRequired).toBe(
      med.prescriptionRequired
    );
  });

  it("2) dosage/usage questions are allowed and streamed", async () => {
    const app = await makeApp();

    await request(app)
      .post("/api/chat/stream")
      .send(reqBody("מה המינון המקובל של אקמול לפי העלון?"))
      .expect(200);

    expect(streamSpy).toHaveBeenCalled();
  });
});
