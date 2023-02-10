import { Trigger } from "deno-slack-api/types.ts";
import workflow from "../workflows/ask.ts";

const trigger: Trigger<typeof workflow.definition> = {
  type: "shortcut",
  name: "Ask OpenAI",
  workflow: `#/workflows/${workflow.definition.callback_id}`,
  inputs: {
    interactivity: { value: "{{data.interactivity}}" },
    user_id: { value: "{{data.user_id}}" },
    channel_id: { value: "{{data.channel_id}}" },
  },
};
export default trigger;
