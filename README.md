# Ask OpenAI in Slack

**Ask OpenAI** is a simple Q&A application that runs on
[Slack's next-generation platform](https://api.slack.com/future). With this app,
anyone in your Slack workspace can instantly ask a question and receive an
answer from OpenAI inside Slack :rocket:

## How It Works

A Slack user can start a workflow by clicking a link trigger button. And then,
the user can submit a simple question text on the popup modal. OpenAPI's answer
will be posted in the message's thread later (OpenAI may require a few seconds
to generate an answer).

<img src="https://user-images.githubusercontent.com/19658/218029310-baa2f606-2a6a-4257-aa9b-831e4e50a911.gif" width=600>

## Run The App

To run this app on your local machine, all you need to do are to download this
app, set OpenAI's API key, run the app, and then share a generated link trigger
URL in your Slack workspace.

```bash
slack create ask-openai-in-slack -t seratch/ask-openai-in-slack
cd ./ask-openai-in-slack
echo "OPENAI_API_KEY=sk-..." > .env
slack run
```

When you deploy the app, the only difference is to use `slack env add` command:

```bash
slack create ask-openai-in-slack -t seratch/ask-openai-in-slack
cd ./ask-openai-in-slack
slack deploy
slack env add OPENAI_API_KEY sk-...
```

## The License

The MIT License
