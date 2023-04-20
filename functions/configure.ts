import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { SlackAPIClient } from "deno-slack-api/types.ts";

export const def = DefineFunction({
  callback_id: "configure",
  title: "Manage an app_mentioned event trigger",
  source_file: "functions/configure.ts",
  input_parameters: {
    properties: {
      interactivityPointer: { type: Schema.types.string },
      quickReplyWorkflowId: { type: Schema.types.string },
      discussWorkflowId: { type: Schema.types.string },
    },
    required: [
      "interactivityPointer",
      "quickReplyWorkflowId",
      "discussWorkflowId",
    ],
  },
  output_parameters: {
    properties: {},
    required: [],
  },
});

export default SlackFunction(def, async ({ inputs, client, env }) => {
  const debugMode = isDebugMode(env);
  // ---------------------------
  // Open a modal for configuring the channel list
  // ---------------------------
  const triggerToUpdate = await findTriggerToUpdate(
    client,
    "app_mentioned",
    inputs.quickReplyWorkflowId,
    debugMode,
  );
  if (debugMode) {
    console.log(`triggerToUpdate: ${JSON.stringify(triggerToUpdate)}`);
  }

  const channelIds = triggerToUpdate?.channel_ids != undefined
    ? triggerToUpdate.channel_ids
    : [];

  // Open the modal to configure the channel list to enable this workflow
  const response = await client.views.open({
    interactivity_pointer: inputs.interactivityPointer,
    view: buildModalView(channelIds),
  });
  if (!response.ok) {
    if (debugMode) {
      console.log(`views.open response: ${JSON.stringify(response)}`);
    }
    const error =
      `Failed to open a modal in the configurator workflow. Contact the app maintainers with the following information - (error: ${response.error})`;
    return { error };
  }
  return {
    // Set this to continue the interaction with this user
    completed: false,
  };
})
  // ---------------------------
  // view_submission handler
  // ---------------------------
  .addViewSubmissionHandler(
    ["configure-workflow"],
    async ({ view, inputs, client, env }) => {
      const debugMode = isDebugMode(env);
      const channelIds = view.state.values.block.channels.selected_channels;

      let modalMessage =
        "*You're all set!*\n\nThis ChatGPT is now available for the channels :white_check_mark:";
      try {
        const appMentionedTriggerToUpdate = await findTriggerToUpdate(
          client,
          "app_mentioned",
          inputs.quickReplyWorkflowId,
          debugMode,
        );
        // If the trigger already exists, we update it.
        // Otherwise, we create a new one.
        await createOrUpdateAppMentionedTrigger(
          client,
          inputs.quickReplyWorkflowId,
          channelIds,
          appMentionedTriggerToUpdate,
        );
        const messageTriggerToUpdate = await findTriggerToUpdate(
          client,
          "message_posted",
          inputs.discussWorkflowId,
          debugMode,
        );
        // If the trigger already exists, we update it.
        // Otherwise, we create a new one.
        await createOrUpdateMessageTrigger(
          client,
          inputs.discussWorkflowId,
          channelIds,
          messageTriggerToUpdate,
        );
        // This app's bot user joins all the channels
        // to perform API calls for the channels
        const error = await joinAllChannels(
          client,
          channelIds,
          debugMode,
        );
        if (error) {
          modalMessage = error;
        }
      } catch (e) {
        console.log(e);
        modalMessage = e;
      }
      // nothing to return if you want to close this modal
      return buildModalUpdateResponse(modalMessage);
    },
  )
  // ---------------------------
  // view_closed handler
  // ---------------------------
  .addViewClosedHandler(
    ["configure-workflow"],
    ({ view }) => {
      console.log(`view_closed handler called: ${JSON.stringify(view)}`);
      return {
        outputs: {},
        completed: true,
      };
    },
  );

// ---------------------------
// Internal functions
// ---------------------------

function buildModalView(channelIds: string[]) {
  return {
    "type": "modal",
    "callback_id": "configure-workflow",
    "title": {
      "type": "plain_text",
      "text": "ChatGPT App",
    },
    "notify_on_close": true,
    "submit": {
      "type": "plain_text",
      "text": "Confirm",
    },
    "blocks": [
      {
        "type": "input",
        "block_id": "block",
        "element": {
          "type": "multi_channels_select",
          "placeholder": {
            "type": "plain_text",
            "text": "Select channels to add",
          },
          "initial_channels": channelIds,
          "action_id": "channels",
        },
        "label": {
          "type": "plain_text",
          "text": "Channels to enable ChatGPT",
        },
      },
    ],
  };
}

function buildModalUpdateResponse(modalMessage: string) {
  return {
    response_action: "update",
    view: {
      "type": "modal",
      "callback_id": "configure-workflow",
      "notify_on_close": true,
      "title": {
        "type": "plain_text",
        "text": "ChatGPT App",
      },
      "blocks": [
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": modalMessage,
          },
        },
      ],
    },
  };
}

// ------------------------------
// Common utiltities
// ------------------------------

export function isDebugMode(env: Record<string, string>) {
  if (env.DEBUG_MODE) {
    return env.DEBUG_MODE === "true";
  }
  return true;
}

export async function findTriggerToUpdate(
  client: SlackAPIClient,
  eventType: string,
  workflowCallbackId: string,
  debugMode: boolean,
) {
  // Check the existing triggers for this workflow
  const allTriggers = await client.workflows.triggers.list({ is_owner: true });
  let triggerToUpdate = undefined;

  // find the trigger to update
  if (allTriggers.triggers) {
    for (const trigger of allTriggers.triggers) {
      if (
        trigger.workflow.callback_id === workflowCallbackId &&
        trigger.event_type === `slack#/events/${eventType}`
      ) {
        triggerToUpdate = trigger;
      }
    }
  }
  if (debugMode) {
    console.log(`The trigger to update: ${JSON.stringify(triggerToUpdate)}`);
  }
  return triggerToUpdate;
}

// ------------------------------
// app_mentioned events
// ------------------------------

const appMentionedTriggerInputs = {
  channel_id: { value: "{{data.channel_id}}" },
  user_id: { value: "{{data.user_id}}" },
  message_ts: { value: "{{data.message_ts}}" },
  text: { value: "{{data.text}}" },
};

export async function createOrUpdateAppMentionedTrigger(
  client: SlackAPIClient,
  workflowCallbackId: string,
  channelIds: string[],
  triggerToUpdate?: Record<string, string>,
) {
  // deno-lint-ignore no-explicit-any
  const channel_ids = channelIds as any;

  if (triggerToUpdate === undefined) {
    // Create a new trigger
    const creation = await client.workflows.triggers.create({
      type: "event",
      name: "app_mentioned event trigger",
      workflow: `#/workflows/${workflowCallbackId}`,
      event: {
        event_type: "slack#/events/app_mentioned",
        channel_ids,
      },
      inputs: appMentionedTriggerInputs,
    });
    if (creation.error) {
      throw new Error(
        `Failed to create a trigger! (response: ${JSON.stringify(creation)})`,
      );
    }
    console.log(`A new trigger created: ${JSON.stringify(creation)}`);
  } else {
    // Update the existing trigger
    const update = await client.workflows.triggers.update({
      trigger_id: triggerToUpdate.id,
      type: "event",
      name: "app_mentioned event trigger",
      workflow: `#/workflows/${workflowCallbackId}`,
      event: {
        event_type: "slack#/events/app_mentioned",
        channel_ids,
      },
      inputs: appMentionedTriggerInputs,
    });
    if (update.error) {
      throw new Error(
        `Failed to update a trigger! (response: ${JSON.stringify(update)})`,
      );
    }
    console.log(`The trigger updated: ${JSON.stringify(update)}`);
  }
}
// ------------------------------
// joining channels
// ------------------------------

export async function joinAllChannels(
  client: SlackAPIClient,
  channelIds: string[],
  debugMode: boolean,
) {
  const futures = channelIds.map((c) => joinChannel(client, c, debugMode));
  const results = (await Promise.all(futures)).filter((r) => r !== undefined);
  if (results.length > 0) {
    return results[0];
  }
  return undefined;
}

async function joinChannel(
  client: SlackAPIClient,
  channel_id: string,
  debugMode: boolean,
) {
  const response = await client.conversations.join({ channel: channel_id });
  if (debugMode) {
    console.log(`conversations.join API result: ${JSON.stringify(response)}`);
  }
  if (response.error) {
    const error = `Failed to join <#${channel_id}> due to ${response.error}`;
    console.log(error);
    return error;
  }
}

// ------------------------------
// message_posted events
// ------------------------------

const messageTriggerInputs = {
  channel_id: { value: "{{data.channel_id}}" },
  user_id: { value: "{{data.user_id}}" },
  message_ts: { value: "{{data.message_ts}}" },
  thread_ts: { value: "{{data.thread_ts}}" },
  text: { value: "{{data.text}}" },
};

export async function createOrUpdateMessageTrigger(
  client: SlackAPIClient,
  workflowCallbackId: string,
  channelIds: string[],
  triggerToUpdate?: Record<string, string>,
) {
  // deno-lint-ignore no-explicit-any
  const channel_ids = channelIds as any;

  if (triggerToUpdate === undefined) {
    // Create a new trigger
    const creation = await client.workflows.triggers.create({
      type: "event",
      name: "message_posted event trigger",
      workflow: `#/workflows/${workflowCallbackId}`,
      event: {
        event_type: "slack#/events/message_posted",
        channel_ids,
        filter: { version: 1, root: { statement: "1 == 1" } },
      },
      inputs: messageTriggerInputs,
    });
    if (creation.error) {
      throw new Error(
        `Failed to create a trigger! (response: ${JSON.stringify(creation)})`,
      );
    }
    console.log(`A new trigger created: ${JSON.stringify(creation)}`);
  } else {
    // Update the existing trigger
    const update = await client.workflows.triggers.update({
      trigger_id: triggerToUpdate.id,
      type: "event",
      name: "message_posted event trigger",
      workflow: `#/workflows/${workflowCallbackId}`,
      event: {
        event_type: "slack#/events/message_posted",
        channel_ids,
        filter: { version: 1, root: { statement: "1 == 1" } },
      },
      inputs: messageTriggerInputs,
    });
    if (update.error) {
      throw new Error(
        `Failed to update a trigger! (response: ${JSON.stringify(update)})`,
      );
    }
    console.log(`The trigger updated: ${JSON.stringify(update)}`);
  }
}
