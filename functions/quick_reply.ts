import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import {
  API_KEY_ERROR,
  buildSystemMessage,
  calculateNumTokens,
  callOpenAI,
  Message,
  OpenAIModel,
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
  const messages: Message[] = [
    buildSystemMessage(),
    {
      "role": "user",
      "content": inputs.question.replaceAll("<@[^>]+>\s*", ""),
    },
  ];

  const model = env.OPENAI_MODEL
    ? env.OPENAI_MODEL as OpenAIModel
    : OpenAIModel.GPT_3_5_TURBO;
  const upperLimit = model === OpenAIModel.GPT_4 ? 6000 : 3000;
  while (calculateNumTokens(messages) > upperLimit) {
    messages.shift();
  }
  const body = JSON.stringify({
    "model": model,
    "messages": messages,
    "max_tokens": calculateNumTokens(messages),
  });
  console.log(body);

  const answer = await callOpenAI(apiKey, 12, body);
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
