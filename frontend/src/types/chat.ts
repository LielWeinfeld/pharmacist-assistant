export type Role = "user" | "assistant" | "loading";

export type ChatMessage =| {
  id: string;
  role: Role | "tool";
  content: string;// ← toolName when role === "tool"
  payload?:unknown;
};

export type OpenAIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};
