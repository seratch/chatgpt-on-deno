import { Manifest } from "deno-slack-sdk/mod.ts";
import Ask from "./workflows/ask.ts";
import Answer from "./workflows/answer.ts";
import QuestionEvent from "./events/question.ts";

export default Manifest({
  name: "Ask OpenAI",
  description: "OpenAI-based Q&A App",
  icon: "assets/openai.png",
  workflows: [Ask, Answer],
  events: [QuestionEvent],
  outgoingDomains: ["api.openai.com"],
  botScopes: [
    "commands",
    "chat:write",
    "chat:write.public",
    "metadata.message:read",
    "triggers:read",
    "triggers:write",
  ],
});
