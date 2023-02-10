import { DefineWorkflow, Schema } from "deno-slack-sdk/mod.ts";
import { def as Ask } from "../functions/ask.ts";

const workflow = DefineWorkflow({
  callback_id: "openai_ask",
  title: "Receive a question from an end-user",
  input_parameters: {
    properties: {
      interactivity: { type: Schema.slack.types.interactivity },
      user_id: { type: Schema.slack.types.user_id },
      channel_id: { type: Schema.slack.types.channel_id },
    },
    required: ["interactivity", "user_id"],
  },
});

workflow.addStep(Ask, {
  interactivity_pointer: workflow.inputs.interactivity.interactivity_pointer,
  user_id: workflow.inputs.user_id,
  channel_id: workflow.inputs.channel_id,
});

export default workflow;
