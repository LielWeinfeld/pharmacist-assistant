import type { Response } from "express";

export function sseInit(res: Response) {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
}

export function sseEvent(res: Response, event: string, data: unknown) {
  const payload =
    typeof data === "string" ? data : JSON.stringify(data ?? {});
  res.write(`event: ${event}\n`);
  res.write(`data: ${payload}\n\n`);
}

export function sseDelta(res: Response, delta: string) {
  if (!delta) return;
  sseEvent(res, "delta", { delta });
}

export function sseDone(res: Response) {
  sseEvent(res, "done", {});
  res.end();
}

export function sseError(res: Response, message: string) {
  sseEvent(res, "error", { message });
  res.end();
}
