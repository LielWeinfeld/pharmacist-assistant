import { useState } from "react";
import "./ChatInput.css";

type Props = {
  onSend: (text: string) => void;
  isLoading: boolean;
  locale?: "he" | "en";
};

const UI_TEXT = {
  en: {
    placeholder: "Write a message",
    send: "Send",
  },
  he: {
    placeholder: "כתוב/י הודעה",
    send: "שליחה",
  },
} as const;

export default function ChatInput({ onSend, isLoading, locale = "en" }: Props) {
  const [text, setText] = useState("");
  const t = UI_TEXT[locale];

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setText("");
  };

  return (
    <div className={`chat-input-container ${locale === "he" ? "rtl" : "ltr"}`}>
      <input
        className="chat-input"
        dir={locale === "he" ? "rtl" : "ltr"}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t.placeholder}
        disabled={isLoading}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            send();
          }
        }}
      />

      <button
        className="send-button"
        type="button"
        onClick={send}
        disabled={isLoading || text.trim().length === 0}
      >
        {t.send}
      </button>
    </div>
  );
}
