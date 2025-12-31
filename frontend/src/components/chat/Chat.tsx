import { useState } from "react";
import ChatMessages from "./ChatMessages";
import ChatInput from "./ChatInput";
import type { ChatMessage, OpenAIMessage } from "../../types/chat";
import { streamChat } from "../../api/chat";
import "./Chat.css";

function detectLocale(text?: string): "he" | "en" {
  // 1. אם יש טקסט – לפי הטקסט
  if (text) {
    return /[\u0590-\u05FF]/.test(text) ? "he" : "en";
  }

  // 2. אין טקסט → לפי שפת הדפדפן / מערכת
  if (typeof navigator !== "undefined") {
    const lang = navigator.language || navigator.languages?.[0];
    if (lang?.startsWith("he")) return "he";
  }

  // 3. fallback
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

  const locale = detectLocale(
    [...chatMessages].reverse().find((m) => m.role === "user")?.content
  );

  const handleSend = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    // Detect locale for THIS request, based on what the user is sending now
    const reqLocale = detectLocale(trimmed);

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

    // snapshot model history BEFORE adding loading
    const modelHistory = toOpenAIMessages([...chatMessages, userMsg]);

    setIsLoading(true);
    setChatMessages((prev) => [...prev, userMsg, loadingMsg]);

    // --- ADD: UX timers (do NOT cancel the request) ---
    const t3 = window.setTimeout(() => {
      setChatMessages((curr) => {
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

    const t10 = window.setTimeout(() => {
      setChatMessages((curr) => {
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

    const clearUXTimers = () => {
      window.clearTimeout(t3);
      window.clearTimeout(t10);
    };
    // --- END ADD ---

    let assistantText = "";

    streamChat(modelHistory, {
      onDelta: (delta) => {
        assistantText += delta;
        setChatMessages((curr) => {
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
      onDone: () => {
        clearUXTimers();
        setIsLoading(false);

        if (assistantText.trim().length === 0) {
          const fallback =
            reqLocale === "he"
              ? "היי! כתוב/י שם תרופה (או חומר פעיל) ואשמח לשתף מידע עובדתי מהעלון (שימושים, מינון, אזהרות, מרשם/ללא מרשם)."
              : "Hi! Tell me the medication name (or active ingredient) and I’ll share factual leaflet info (uses, dosage directions, warnings, prescription requirement).";

          setChatMessages((curr) => {
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
        clearUXTimers();
        setIsLoading(false);

        const prefix =
          reqLocale === "he"
            ? "סליחה - משהו השתבש."
            : "Sorry - something went wrong.";

        setChatMessages((curr) => {
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
