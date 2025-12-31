export type SSEEvent = "delta" | "done" | "error" | "ping" | "message" | "tool_call" | "tool_result";

export type SSEFrame = {
  event: SSEEvent;
  data: string;
};

export function parseSSEFrames(buffer: string): { frames: SSEFrame[]; rest: string } {
  const frames: SSEFrame[] = [];
  let rest = buffer;

  let idx: number;
  while ((idx = rest.indexOf("\n\n")) !== -1) {
    const frame = rest.slice(0, idx);
    rest = rest.slice(idx + 2);

    let event = "" as SSEEvent | "";
    let data = "";

    for (const line of frame.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim() as SSEEvent;
      if (line.startsWith("data:")) data += line.slice(5).trim() + "\n";
    }

    data = data.trim();
    if (!event) continue;
    frames.push({ event, data });
  }

  return { frames, rest };
}

export function safeJsonParse(s: string): unknown | null {
  try {
    return JSON.parse(s) as unknown;
  } catch {
    return null;
  }
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
