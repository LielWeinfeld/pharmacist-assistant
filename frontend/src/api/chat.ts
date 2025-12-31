// src/api/chat.ts
import type { OpenAIMessage } from "../types/chat";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

type ToolEvent = unknown;

type Handlers = {
  onDelta: (delta: string) => void;
  onTool?: (ev: ToolEvent) => void;
  onDone: () => void;
  onError: (err: Error) => void;
};

/**
 * Streams SSE from /api/chat/stream.
 * Returns an AbortController so the caller can cancel in-flight requests.
 */
export function streamChat(messages: OpenAIMessage[], handlers: Handlers) {
  const controller = new AbortController();

  fetch(`${API_BASE}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
    signal: controller.signal,
  })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      const read = (): void => {
        reader
          .read()
          .then(({ value, done }) => {
            if (done) {
              handlers.onDone();
              return;
            }

            buffer += decoder.decode(value, { stream: true });

            // SSE events are separated by a blank line
            const parts = buffer.split("\n\n");
            buffer = parts.pop() ?? "";

            for (const part of parts) {
              const lines = part.split("\n");

              let eventName: string | null = null;
              const dataLines: string[] = [];

              for (const line of lines) {
                if (line.startsWith("event:")) {
                  eventName = line.slice("event:".length).trim();
                } else if (line.startsWith("data:")) {
                  // Keep line breaks between data lines
                  dataLines.push(line.slice("data:".length).trim());
                }
              }

              const data = dataLines.join("\n");
              const ev = eventName ?? "message";

              if (ev === "delta") {
                try {
                  const parsed = JSON.parse(data) as { delta?: string };
                  if (parsed.delta) handlers.onDelta(parsed.delta);
                } catch {
                  // ignore parse errors
                }
              } else if (ev === "tool") {
                try {
                  handlers.onTool?.(JSON.parse(data) as ToolEvent);
                } catch {
                  // ignore parse errors
                }
              } else if (ev === "error") {
                // server-side SSE error event
                try {
                  const parsed = JSON.parse(data) as { message?: string };
                  handlers.onError(new Error(parsed.message ?? "Stream error"));
                } catch {
                  handlers.onError(new Error(data || "Stream error"));
                }
                controller.abort();
                return;
              } else if (ev === "done") {
                handlers.onDone();
                controller.abort();
                return;
              }
            }

            read();
          })
          .catch((err) => {
            // If aborted, avoid reporting as an error
            if (controller.signal.aborted) return;
            handlers.onError(err instanceof Error ? err : new Error(String(err)));
          });
      };

      read();
    })
    .catch((err) => {
      if (controller.signal.aborted) return;
      handlers.onError(err instanceof Error ? err : new Error(String(err)));
    });

  return controller;
}
