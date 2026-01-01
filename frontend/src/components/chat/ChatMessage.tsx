import type { ChatMessage as MessageType } from "../../types/chat";
import LoadingSpinner from "./LoadingSpinner";
import "./ChatMessage.css";

import Robot from "../../assets/robot.png";
import User from "../../assets/user.png";

type Props = { message: MessageType };

export default function ChatMessage({ message }: Props) {
  const isUser = message.role === "user";

  if (message.role === "tool") {
    return;
  }

  return (
    <div className={`row ${isUser ? "rowUser" : "rowBot"}`}>
      {!isUser && <img className="avatar" src={Robot} alt="bot" />}

      <div className={`bubble ${isUser ? "bubbleUser" : ""}`}>
        {message.role === "loading" ? (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              justifyContent: "center",
              minWidth: "15px",
              minHeight: "15px",
            }}
          >
            <LoadingSpinner />
            {message.content?.trim() ? (
              <span className="line" dir="auto">
                {message.content}
              </span>
            ) : null}
          </div>
        ) : (
          message.content.split("\n").map((line, i) => (
            <p key={i} className="line" dir="auto">
              {line}
            </p>
          ))
        )}
      </div>

      {isUser && <img className="avatar" src={User} alt="user" />}
    </div>
  );
}
