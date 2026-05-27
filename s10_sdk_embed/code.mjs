function createAgentSession({ customTools = [] } = {}) {
  const tools = new Map(customTools.map((tool) => [tool.name, tool]));
  const messages = [];

  return {
    async sendUserMessage(content) {
      messages.push({ role: "user", content });
      const tool = tools.get("lookup_product_spec");
      const result = tool
        ? await tool.execute({ documentId: "PRD-42" })
        : "no custom tool";
      messages.push({ role: "tool", name: "lookup_product_spec", content: result });
      messages.push({ role: "assistant", content: "I found the spec and can reason over it." });
      return messages;
    },
  };
}

const session = createAgentSession({
  customTools: [
    {
      name: "lookup_product_spec",
      async execute({ documentId }) {
        return `Spec ${documentId}: users need a clear learning path.`;
      },
    },
  ],
});

console.log(await session.sendUserMessage("Read PRD-42 and propose risks."));
