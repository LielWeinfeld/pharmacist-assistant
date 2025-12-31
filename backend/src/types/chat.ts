export type OpenAIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type SendChatRequest = {
  messages: OpenAIMessage[];
  userId?: string;
};