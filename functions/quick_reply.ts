import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import {
  API_ENDPOINT,
  API_KEY_ERROR,
  buildSystemMessage,
  OpenAIResponse,
} from "./openai.ts";

export const def = DefineFunction({
  callback_id: "answer",
  title: "Answer a question",
  source_file: "functions/quick_reply.ts",
  input_parameters: {
    properties: {
      channel_id: { type: Schema.slack.types.channel_id },
      user_id: { type: Schema.slack.types.user_id },
      question: { type: Schema.types.string },
    },
    required: ["channel_id", "user_id", "question"],
  },
  output_parameters: {
    properties: { answer: { type: Schema.types.string } },
    required: ["answer"],
  },
});

export default SlackFunction(def, async ({ inputs, env, client }) => {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log(API_KEY_ERROR);
    return { error: API_KEY_ERROR };
  }
  const messages = [
    buildSystemMessage(),
    {
      "role": "user",
      "content": inputs.question.replaceAll("<@[^>]+>\s*", ""),
    },
  ];
  const body = JSON.stringify({
    // "gpt-4" works too
    "model": env.OPENAI_MODEL ?? "gpt-3.5-turbo",
    "messages": messages,
    "max_tokens": 2000,
    // TODO: other parameters for optimization
  });
  console.log(body);
  const response = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body,
  });
  let answer =
    ":warning: ChatGPT didn't respond to your request. Please try it again later.";
  if (!response.ok) {
    console.log(response);
    answer =
      `:warning: Sorry, something is wrong with your ChaGPT request! Can you try it again later? (error: ${response.statusText})`;
  } else {
    const responseBody: OpenAIResponse = await response.json();
    console.log(responseBody);
    if (responseBody.choices && responseBody.choices.length > 0) {
      answer = responseBody.choices[0].message.content;
    }
  }
  const replyResponse = await client.chat.postMessage({
    channel: inputs.channel_id,
    text: `<@${inputs.user_id}> ${answer}`,
    metadata: {
      "event_type": "chat-gpt-convo",
      "event_payload": { "question": inputs.question },
    },
  });
  if (replyResponse.error) {
    const error =
      `Failed to post ChatGPT's reply due to ${replyResponse.error}`;
    return { error };
  }
  return { outputs: { answer } };
});
