import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { SlackAPIClient } from "deno-slack-api/types.ts";
import { API_KEY_ERROR } from "./common.ts";
import QuestionEvent from "../events/question.ts";
import AnswerWorkflow from "../workflows/answer.ts";

export const def = DefineFunction({
  callback_id: "ask",
  title: "Ask OpenAI a question",
  source_file: "functions/ask.ts",
  input_parameters: {
    properties: {
      interactivity_pointer: { type: Schema.types.string },
      user_id: { type: Schema.slack.types.user_id },
      channel_id: { type: Schema.slack.types.channel_id },
    },
    required: ["interactivity_pointer", "user_id"],
  },
  output_parameters: { properties: {}, required: [] },
});

export default SlackFunction(def, async ({ client, inputs, env }) => {
  const view = buildNewModalView();
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    view.blocks.push({
      "type": "section",
      "text": { "type": "mrkdwn", "text": API_KEY_ERROR },
    });
  } else {
    view.blocks.push(
      {
        "type": "input",
        "block_id": "question",
        "element": { "type": "plain_text_input", "action_id": "input" },
        "label": { "type": "plain_text", "text": "Question" },
      },
    );
    const conversation_id = inputs.channel_id
      ? inputs.channel_id
      : inputs.user_id;
    view.blocks.push(
      {
        "type": "input",
        "block_id": "where_to_post",
        "element": {
          "type": "conversations_select",
          "action_id": "input",
          "initial_conversation": conversation_id,
        },
        "label": { "type": "plain_text", "text": "Where to post" },
      },
    );
  }
  // Open the modal to configure the channel list to enable this workflow
  const openingModal = await client.views.open({
    interactivity_pointer: inputs.interactivity_pointer,
    view,
  });
  if (!openingModal.ok) {
    const error =
      `Failed to open a modal in the OpenAI Q&A workflow. Contact the app maintainers with the following information - (error: ${openingModal.error})`;
    return { error };
  }
  return {
    // Set this to continue the interaction with this user
    completed: false,
  };
})
  .addViewSubmissionHandler("openai-qa", async ({ view, body, client }) => {
    const modalView = buildNewModalView();
    const user_id = body.user.id;
    const values = view.state.values;
    const channel_id = values.where_to_post.input.selected_conversation;

    const workflowCallbackId = AnswerWorkflow.definition.callback_id;
    const trigger = await findTrigger(client, workflowCallbackId, channel_id);
    if (!trigger) {
      const error = await createTrigger(client, workflowCallbackId, channel_id);
      if (error) {
        return { error };
      }
    }

    const question = values.question.input.value
      .replace("\r", " ").replace("\n", " ");
    const newMessage = await client.chat.postMessage({
      channel: channel_id,
      text:
        `:wave: A new question from <@${user_id}>! OpenAI's answer will be posted in this thread shortly :raised_hands:\n>${question}`,
      metadata: {
        event_type: QuestionEvent,
        event_payload: { channel_id, user_id, question },
      },
    });
    if (newMessage.error) {
      const error = `Failed to post a message with metadata: ${newMessage}`;
      return { error };
    }
    modalView.blocks.push(
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text":
            `:incoming_envelope: Thanks for submitting the question! Once this app receives an answer from the OpenAI platform, it will be posted in <#${channel_id}>`,
        },
      },
    );
    delete modalView.submit;
    return { response_action: "update", view: modalView };
  })
  .addViewClosedHandler("openai-qa", ({ view }) => {
    console.log(`view_closed handler called: ${JSON.stringify(view)}`);
    return { completed: true };
  });

// --------------------------
// Internal

interface Block {
  type: string;
  block_id?: string;
  element?: {
    type: string;
    action_id: string;
    text?: { type: "plain_text" | "mrkdwn"; text: string };
    initial_conversation?: string;
  };
  text?: { type: "plain_text" | "mrkdwn"; text: string };
  label?: { type: "plain_text"; text: string; emoji?: boolean };
}

interface Modal {
  type: "modal";
  callback_id: string;
  title: { type: "plain_text"; text: string };
  submit?: { type: "plain_text"; text: string };
  notify_on_close: true;
  blocks: Block[];
}

function buildNewModalView(): Modal {
  return {
    "type": "modal",
    "callback_id": "openai-qa",
    "title": { "type": "plain_text", "text": "Ask OpenAI" },
    "submit": { "type": "plain_text", "text": "Ask OpenAI" },
    "blocks": [],
    "notify_on_close": true,
  };
}

async function findTrigger(
  client: SlackAPIClient,
  workflowCallbackId: string,
  channelId: string,
) {
  // Check the existing triggers for this workflow
  const allTriggers = await client.workflows.triggers.list({ is_owner: true });
  let triggerToUpdate = undefined;
  // find the trigger to update
  if (allTriggers.triggers) {
    for (const trigger of allTriggers.triggers) {
      if (
        trigger.workflow.callback_id === workflowCallbackId &&
        trigger.event_type === "slack#/events/message_metadata_posted" &&
        (trigger.channel_ids as string[]).includes(channelId)
      ) {
        triggerToUpdate = trigger;
      }
    }
  }
  return triggerToUpdate;
}

const triggerInputs = {
  user_id: { value: "{{data.user_id}}" },
  channel_id: { value: "{{data.channel_id}}" },
  thread_ts: { value: "{{data.message_ts}}" },
  question: { value: "{{data.metadata.event_payload.question}}" },
};

async function createTrigger(
  client: SlackAPIClient,
  workflowCallbackId: string,
  channelId: string,
) {
  // deno-lint-ignore no-explicit-any
  const channel_ids = [channelId] as any;
  const creation = await client.workflows.triggers.create({
    type: "event",
    name: `message_metadata_posted for ${channelId}`,
    workflow: `#/workflows/${workflowCallbackId}`,
    event: {
      event_type: "slack#/events/message_metadata_posted",
      metadata_event_type: QuestionEvent.definition.name,
      channel_ids,
    },
    inputs: triggerInputs,
  });
  if (creation.error) {
    return `Failed to create a trigger! (response: ${
      JSON.stringify(creation)
    })`;
  }
  console.log(`A new trigger created: ${JSON.stringify(creation)}`);
}
