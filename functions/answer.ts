import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { API_KEY_ERROR } from "./common.ts";

export const def = DefineFunction({
  callback_id: "answer",
  title: "Receive an answer from OpenAI",
  source_file: "functions/answer.ts",
  input_parameters: {
    properties: { question: { type: Schema.types.string } },
    required: ["question"],
  },
  output_parameters: {
    properties: { answer: { type: Schema.types.string } },
    required: ["answer"],
  },
});

export default SlackFunction(def, async ({ inputs, env }) => {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log(API_KEY_ERROR);
    return { error: API_KEY_ERROR };
  }
  const body = JSON.stringify({
    "model": "text-davinci-003",
    "prompt": `Q: ${inputs.question}\nA:`,
    "temperature": 0,
    "max_tokens": 1000,
    "top_p": 1,
    "frequency_penalty": 0.0,
    "presence_penalty": 0.0,
    "stop": ["\n"],
  });
  console.log(body);
  const response = await fetch(OPEN_AI_ENDPOINT, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "content-type": "application/json;charset=utf-8",
    },
    body,
  });
  let answer =
    "Sorry! OpenAI didn't provide any answers to this question. Can you try a differen way to ask the same?";
  if (!response.ok) {
    console.log(response);
    answer =
      `Sorry! Something is wrong with OpenAI's API access... Can you try it again later? (error: ${response.statusText})`;
  } else {
    const responseBody: OpenAIResponse = await response.json();
    console.log(responseBody);
    if (responseBody.choices && responseBody.choices.length > 0) {
      answer = responseBody.choices[0].text;
    }
  }
  return { outputs: { answer } };
});

const OPEN_AI_ENDPOINT = "https://api.openai.com/v1/completions";

interface OpenAIResponse {
  id: string;
  object: "text_completion";
  created: number;
  model: string;
  choices: { text: string; index: number; finish_reason: string }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
