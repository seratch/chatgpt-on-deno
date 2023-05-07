// TODO: 1.6 does not work in this app
// error: Uncaught (in promise) SyntaxError: Unexpected token '/', "// This is"... is not valid JSON
import { encode } from "https://deno.land/x/gpt@1.5/mod.ts";

export const API_KEY_ERROR =
  "OpenAI's API key is required for running this function! To fix this, follow these two steps:\n\n 1) Grab the API key string in https://platform.openai.com/account/api-keys \n 2) Place .env file for local development, or run `slack env add OPENAI_API_KEY {YOUR KEY HERE}` for deployed app.";

export const API_ENDPOINT = "https://api.openai.com/v1/chat/completions";

export enum OpenAIModel {
  GPT_3_5_TURBO = "gpt-3.5-turbo",
  GPT_4 = "gpt-4",
}

export interface Message {
  role: "assistant" | "user" | "system";
  content: string;
  name?: string;
}

export interface AssistantMessage extends Message {
  role: "assistant";
}

export interface OpenAIResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: {
    message: AssistantMessage;
    index: number;
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export function buildSystemMessage(botUserId?: string): Message {
  return {
    "role": "system",
    "content":
      `You are a bot in a slack chat room. You might receive messages from multiple people. Slack user IDs match the regex \`<@U.*?>\`. Your Slack user ID is <@${botUserId}>.`,
  };
}

export function calculateNumTokens(
  messages: Message[],
): number {
  // Deep Dive: "Counting tokens for chat API calls"
  // https://platform.openai.com/docs/guides/chat/introduction

  let numTokens = 0;

  for (const message of messages) {
    numTokens += 4; // every message follows <im_start>{role/name}\n{content}<im_end>\n
    numTokens += encode(message.role).length;
    numTokens += encode(message.content).length;
    if (message.name) {
      numTokens += encode(message.name).length;
      numTokens -= 1;
    }
  }
  numTokens += 2; // every reply is primed with <im_start>assistant

  return numTokens;
}

export async function callOpenAI(
  apiKey: string,
  timeoutSeconds: number,
  body: string,
): Promise<string> {
  try {
    const c = new AbortController();
    const id = setTimeout(() => c.abort(), timeoutSeconds * 1000);
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body,
      signal: c.signal,
    });
    clearTimeout(id);
    if (!response.ok) {
      console.log(response);
      return `:warning: Something is wrong with your ChaGPT request (error: ${response.statusText})`;
    } else {
      const responseBody: OpenAIResponse = await response.json();
      console.log(responseBody);
      if (responseBody.choices && responseBody.choices.length > 0) {
        return responseBody.choices[0].message.content;
      }
    }
  } catch (e) {
    if (e.name === "AbortError") {
      return `:warning: ChatGPT didn't respond within ${timeoutSeconds} seconds.`;
    } else {
      return `:warning: Something is wrong with your ChaGPT request (error: ${e})`;
    }
  }
  return ":warning: ChatGPT didn't respond to your request. Please try it again later.";
}
