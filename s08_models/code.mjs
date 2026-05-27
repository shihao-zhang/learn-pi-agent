const providers = {
  anthropic: {
    wire: "messages",
    toRequest: (messages) => ({ system: "You are concise.", messages }),
  },
  openai: {
    wire: "responses",
    toRequest: (messages) => ({
      input: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    }),
  },
};

const sessionMessages = [
  { role: "user", content: "Summarize this repo." },
  { role: "assistant", content: "I will inspect the files." },
];

for (const [name, provider] of Object.entries(providers)) {
  console.log(`${name} via ${provider.wire}:`);
  console.log(JSON.stringify(provider.toRequest(sessionMessages), null, 2));
}
