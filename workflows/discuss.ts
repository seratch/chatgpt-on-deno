import { DefineWorkflow, Schema } from "deno-slack-sdk/mod.ts";
import { def as Discuss } from "../functions/discuss.ts";

const workflow = DefineWorkflow({
  callback_id: "discussion",
  title: "Post a ChatGPT reply within a discussion",
  input_parameters: {
    properties: {
      channel_id: { type: Schema.slack.types.channel_id },
      message_ts: { type: Schema.types.string },
      thread_ts: { type: Schema.types.string },
      user_id: { type: Schema.slack.types.user_id },
    },
    required: ["channel_id", "message_ts"],
  },
});

workflow.addStep(Discuss, {
  channel_id: workflow.inputs.channel_id,
  message_ts: workflow.inputs.message_ts,
  thread_ts: workflow.inputs.thread_ts,
  user_id: workflow.inputs.user_id,
});

export default workflow;
