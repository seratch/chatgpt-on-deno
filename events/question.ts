import { DefineEvent, Schema } from "deno-slack-sdk/mod.ts";

const QuestionEvent = DefineEvent({
  name: "openai_question",
  title: "OpenAI Question Payload",
  type: Schema.types.object,
  properties: {
    channel_id: { type: Schema.slack.types.channel_id },
    user_id: { type: Schema.slack.types.user_id },
    question: { type: Schema.types.string },
  },
  required: ["channel_id", "user_id", "question"],
  additionalProperties: false,
});

export default QuestionEvent;
