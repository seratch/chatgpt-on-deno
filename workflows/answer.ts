import { DefineWorkflow, Schema } from "deno-slack-sdk/mod.ts";
import { def as Answer } from "../functions/answer.ts";

const workflow = DefineWorkflow({
  callback_id: "openai_answer",
  title: "Post a reply when OpenAI's response is ready",
  input_parameters: {
    properties: {
      channel_id: { type: Schema.slack.types.channel_id },
      thread_ts: { type: Schema.types.string },
      question: { type: Schema.types.string },
    },
    required: ["channel_id", "thread_ts", "question"],
  },
});

const answerStep = workflow.addStep(Answer, {
  question: workflow.inputs.question,
});

workflow.addStep(Schema.slack.functions.SendMessage, {
  channel_id: workflow.inputs.channel_id,
  thread_ts: workflow.inputs.thread_ts,
  message: answerStep.outputs.answer,
});

export default workflow;
