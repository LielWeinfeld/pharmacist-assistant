import { useEffect, useRef } from "react";
import type { ChatMessage } from "../../types/chat";
import ChatMessageComp from "./ChatMessage";
import "./ChatMessages.css";

type Props = {
  chatMessages: ChatMessage[];
};

type Locale = "he" | "en";

const INTRO_TEXT: Record<Locale, string> = {
  en: "How can I help with medications today?\nI can provide general, factual info about drugs (uses, active ingredients, OTC vs prescription, leaflet directions).",
  he: "היי! איך אפשר לעזור ?\nאני יכול/ה לספק מידע עובדתי על תרופות: שימושים, רכיבים פעילים, מרשם/ללא מרשם והנחיות מהעלון.",
};
function detectBrowserLocale(): Locale {
  const lang = navigator.languages?.[0] ?? navigator.language ?? "he";

  if (lang.startsWith("he")) return "he";
  return "en";
}

export default function ChatMessages({ chatMessages }: Props) {
  const isEmpty = chatMessages.length === 0;

  // start language is the browsers language
  const locale: Locale = detectBrowserLocale();

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatMessages]);

  return (
    <div className="chatMessages">
      {isEmpty && (
        <ChatMessageComp
          message={{
            id: "intro",
            role: "assistant",
            content: INTRO_TEXT[locale],
          }}
        />
      )}

      {chatMessages.map((m) => (
        <ChatMessageComp key={m.id} message={m} />
      ))}

      <div ref={bottomRef} />
    </div>
  );
}
