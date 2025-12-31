export type Role = "user" | "assistant" | "loading";

export type ChatMessage = {
  id: string;
  role: Role;
  content: string;
};

export type OpenAIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};
