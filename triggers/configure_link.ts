import { Trigger } from "deno-slack-api/types.ts";
import {
  TriggerContextData as data,
  TriggerTypes as type,
} from "deno-slack-api/mod.ts";
import workflowDef from "../workflows/configure.ts";

const trigger: Trigger<typeof workflowDef.definition> = {
  type: type.Shortcut,
  name: "Configurator for ChatGPT app",
  workflow: `#/workflows/${workflowDef.definition.callback_id}`,
  inputs: { interactivity: { value: data.Shortcut.interactivity } },
};

export default trigger;
