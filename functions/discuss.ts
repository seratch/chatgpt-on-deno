import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import {
  API_ENDPOINT,
  API_KEY_ERROR,
  buildSystemMessage,
  OpenAIResponse,
} from "./openai.ts";

export const def = DefineFunction({
  callback_id: "discuss",
  title: "Discuss a topic in a Slack thread",
  source_file: "functions/discuss.ts",
  input_parameters: {
    properties: {
      channel_id: { type: Schema.slack.types.channel_id },
      message_ts: { type: Schema.types.string },
      thread_ts: { type: Schema.types.string },
      user_id: { type: Schema.slack.types.user_id },
    },
    required: ["channel_id", "message_ts", "user_id"],
  },
  output_parameters: {
    properties: { answer: { type: Schema.types.string } },
    required: [],
  },
});

export default SlackFunction(def, async ({ inputs, env, client }) => {
  if (!inputs.thread_ts) {
    return { outputs: {} };
  }
  const authTest = await client.auth.test();
  const thisAppBotUserId = authTest.user_id;
  if (inputs.user_id === thisAppBotUserId) {
    return { outputs: {} };
  }

  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log(API_KEY_ERROR);
    return { error: API_KEY_ERROR };
  }
  const messages = [buildSystemMessage()];

  const replies = await client.conversations.replies({
    channel: inputs.channel_id,
    ts: inputs.thread_ts,
    include_all_metadata: true,
    limit: 1000,
  });
  if (replies.error) {
    const error = `Failed to fetch replies in a thread due to ${replies.error}`;
    return { error };
  }
  for (const message of replies.messages) {
    if (
      message.metadata &&
      message.metadata.event_type === "chat-gpt-convo" &&
      message.metadata.event_payload &&
      message.metadata.event_payload.question
    ) {
      // Append the first question from the user
      const content = message.metadata.event_payload.question;
      messages.push({ role: "user", content });
    }
    messages.push({
      role: thisAppBotUserId ? "assistant" : "user",
      content: message.text,
    });
  }

  const body = JSON.stringify({
    // "gpt-4" works too
    "model": env.OPENAI_MODEL ?? "gpt-3.5-turbo",
    "messages": messages,
    "max_tokens": 2000,
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
    thread_ts: inputs.thread_ts,
    text: answer,
  });
  if (replyResponse.error) {
    const error =
      `Failed to post ChatGPT's reply due to ${replyResponse.error}`;
    return { error };
  }
  return { outputs: { answer } };
});
