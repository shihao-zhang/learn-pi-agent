class EventBus {
  handlers = new Map();

  on(eventName, handler) {
    const handlers = this.handlers.get(eventName) ?? [];
    handlers.push(handler);
    this.handlers.set(eventName, handlers);
  }

  async emit(eventName, event) {
    for (const handler of this.handlers.get(eventName) ?? []) {
      const result = await handler(event);
      if (result?.block) return result;
    }
    return { block: false };
  }
}

const pi = new EventBus();

pi.on("tool_call", async (event) => {
  if (event.toolName === "bash" && event.input.command.includes("rm -rf")) {
    return { block: true, reason: "dangerous deletion requires approval" };
  }
});

for (const command of ["npm test", "rm -rf node_modules"]) {
  const decision = await pi.emit("tool_call", {
    toolName: "bash",
    input: { command },
  });
  console.log(`${command}: ${decision.block ? decision.reason : "allowed"}`);
}
