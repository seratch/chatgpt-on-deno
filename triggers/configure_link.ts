import { Trigger } from "deno-slack-api/types.ts";
import workflowDef from "../workflows/configure.ts";

const trigger: Trigger<typeof workflowDef.definition> = {
  type: "shortcut",
  name: "Configurator for ChatGPT app",
  workflow: `#/workflows/${workflowDef.definition.callback_id}`,
  inputs: { interactivity: { value: "{{data.interactivity}}" } },
};

export default trigger;
