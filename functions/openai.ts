export const API_KEY_ERROR =
  "OpenAI's API key is required for running this function! To fix this, follow these two steps:\n\n 1) Grab the API key string in https://platform.openai.com/account/api-keys \n 2) Place .env file for local development, or run `slack env add OPENAI_API_KEY {YOUR KEY HERE}` for deployed app.";

export const API_ENDPOINT = "https://api.openai.com/v1/chat/completions";

export interface OpenAIResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: {
    message: {
      role: "assistant";
      content: string;
    };
    index: number;
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export function buildSystemMessage() {
  return {
    "role": "system",
    "content":
      "You are a bot in a slack chat room. You might receive messages from multiple people. Slack user IDs match the regex `<@U.*?>`. Your Slack user ID is <@{bot_user_id}>.",
  };
}
