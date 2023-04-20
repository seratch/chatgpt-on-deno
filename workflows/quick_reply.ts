import { DefineWorkflow, Schema } from "deno-slack-sdk/mod.ts";
import { def as QuickReply } from "../functions/quick_reply.ts";

const workflow = DefineWorkflow({
  callback_id: "quick-reply",
  title: "Post a ChatGPT reply to given question",
  input_parameters: {
    properties: {
      channel_id: { type: Schema.slack.types.channel_id },
      user_id: { type: Schema.slack.types.user_id },
      text: { type: Schema.types.string },
      message_ts: { type: Schema.types.string },
    },
    required: ["channel_id", "user_id", "text"],
  },
});

workflow.addStep(QuickReply, {
  channel_id: workflow.inputs.channel_id,
  user_id: workflow.inputs.user_id,
  question: workflow.inputs.text,
  message_ts: workflow.inputs.message_ts,
});

export default workflow;
