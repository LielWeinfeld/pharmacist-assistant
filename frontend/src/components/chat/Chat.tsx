import { useEffect, useRef, useState } from "react";
import ChatMessages from "./ChatMessages";
import ChatInput from "./ChatInput";
import type { ChatMessage, OpenAIMessage } from "../../types/chat";
import { streamChat } from "../../api/chat";
import "./Chat.css";

function detectLocale(text?: string): "he" | "en" {
  if (text && text.trim().length > 0) {
    return /[\u0590-\u05FF]/.test(text) ? "he" : "en";
  }

  if (typeof navigator !== "undefined") {
    const lang = navigator.language || navigator.languages?.[0];
    if (lang?.toLowerCase().startsWith("he")) return "he";
  }

  return "en";
}

type ModelRole = "user" | "assistant";
function isModelMessage(
  m: ChatMessage
): m is ChatMessage & { role: ModelRole } {
  return m.role === "user" || m.role === "assistant";
}

function toOpenAIMessages(uiMessages: ChatMessage[]): OpenAIMessage[] {
  return uiMessages
    .filter(isModelMessage)
    .map((m) => ({ role: m.role, content: m.content }));
}

export default function Chat() {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [locale, setLocale] = useState<"he" | "en">(() => detectLocale());

  const streamAbortRef = useRef<AbortController | null>(null);
  const t3Ref = useRef<number | null>(null);
  const t10Ref = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const clearUXTimers = () => {
    if (t3Ref.current !== null) window.clearTimeout(t3Ref.current);
    if (t10Ref.current !== null) window.clearTimeout(t10Ref.current);
    t3Ref.current = null;
    t10Ref.current = null;
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearUXTimers();
      streamAbortRef.current?.abort();
      streamAbortRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const safeSetChatMessages = (
    updater: (prev: ChatMessage[]) => ChatMessage[]
  ) => {
    if (!mountedRef.current) return;
    setChatMessages(updater);
  };

  const safeSetIsLoading = (v: boolean) => {
    if (!mountedRef.current) return;
    setIsLoading(v);
  };

  const handleSend = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return; // ✅ מאפשר לשלוח גם בזמן loading

    // ✅ abort previous stream to avoid mixed deltas
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    clearUXTimers();

    const reqLocale = detectLocale(trimmed);
    setLocale(reqLocale);

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };

    const assistantId = crypto.randomUUID();
    const loadingMsg: ChatMessage = {
      id: assistantId,
      role: "loading",
      content: "",
    };

    const modelHistory = toOpenAIMessages([...chatMessages, userMsg]);

    safeSetIsLoading(true);
    safeSetChatMessages((prev) => [...prev, userMsg, loadingMsg]);

    t3Ref.current = window.setTimeout(() => {
      safeSetChatMessages((curr) => {
        const copy = [...curr];
        const idx = copy.findIndex((m) => m.id === assistantId);
        if (idx === -1) return copy;
        if (copy[idx].role !== "loading") return copy;

        copy[idx] = {
          ...copy[idx],
          content: reqLocale === "he" ? "בודק/ת…" : "Working on it…",
        };
        return copy;
      });
    }, 3000);

    t10Ref.current = window.setTimeout(() => {
      safeSetChatMessages((curr) => {
        const copy = [...curr];
        const idx = copy.findIndex((m) => m.id === assistantId);
        if (idx === -1) return copy;
        if (copy[idx].role !== "loading") return copy;

        copy[idx] = {
          ...copy[idx],
          content:
            reqLocale === "he"
              ? "עדיין עובד/ת על זה… זה עשוי לקחת עוד כמה שניות."
              : "Still working… this may take a few more seconds.",
        };
        return copy;
      });
    }, 10000);

    let assistantText = "";

    const controller = streamChat(modelHistory, {
      onDelta: (delta) => {
        assistantText += delta;

        safeSetChatMessages((curr) => {
          const copy = [...curr];
          const idx = copy.findIndex((m) => m.id === assistantId);
          if (idx === -1) return copy;

          copy[idx] = {
            id: assistantId,
            role: "assistant",
            content: assistantText,
          };
          return copy;
        });
      },

      onTool: (ev) => {
        console.log("TOOL EVENT:", ev);
      },

      onDone: () => {
        clearUXTimers();
        safeSetIsLoading(false);

        if (assistantText.trim().length === 0) {
          const fallback =
            reqLocale === "he"
              ? "היי! כתוב/י שם תרופה (או חומר פעיל) ואשמח לשתף מידע עובדתי מהעלון (שימושים, מינון, אזהרות, מרשם/ללא מרשם)."
              : "Hi! Tell me the medication name (or active ingredient) and I’ll share factual leaflet info (uses, dosage directions, warnings, prescription requirement).";

          safeSetChatMessages((curr) => {
            const copy = [...curr];
            const idx = copy.findIndex((m) => m.id === assistantId);
            if (idx === -1) return copy;

            copy[idx] = {
              id: assistantId,
              role: "assistant",
              content: fallback,
            };
            return copy;
          });
        }
      },

      onError: (err) => {
        // ✅ ignore abort errors
        if (controller.signal.aborted) return;

        clearUXTimers();
        safeSetIsLoading(false);

        const prefix =
          reqLocale === "he"
            ? "סליחה - משהו השתבש."
            : "Sorry - something went wrong.";

        safeSetChatMessages((curr) => {
          const copy = [...curr];
          const idx = copy.findIndex((m) => m.id === assistantId);
          if (idx === -1) return copy;

          copy[idx] = {
            id: assistantId,
            role: "assistant",
            content: `${prefix}\n${err.message}`,
          };
          return copy;
        });
      },
    });

    streamAbortRef.current = controller;
  };

  return (
    <section className="chat">
      <div className="chatMessagesWrap">
        <ChatMessages chatMessages={chatMessages} />
      </div>

      <div className="chatInputWrap">
        <ChatInput onSend={handleSend} isLoading={isLoading} locale={locale} />
      </div>
    </section>
  );
}
