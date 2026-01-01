import { useEffect, useRef, useState } from "react";
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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const t = UI_TEXT[locale];

  useEffect(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [locale]);

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");

    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  return (
    <div className={`chat-input-container ${locale === "he" ? "rtl" : "ltr"}`}>
      <input
        className="chat-input"
        ref={inputRef}
        dir={locale === "he" ? "rtl" : "ltr"}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t.placeholder}
        disabled={false}
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
        onMouseDown={(e) => e.preventDefault()} // keep focus on input
        onClick={send}
        disabled={text.trim().length === 0}
        aria-busy={isLoading}
      >
        {t.send}
      </button>
    </div>
  );
}
