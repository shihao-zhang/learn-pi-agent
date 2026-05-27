const rules = [
  {
    name: "block-env-write",
    match: (call) => call.name === "write" && call.input.path.endsWith(".env"),
    decision: "block",
    reason: "credential files are protected",
  },
  {
    name: "ask-dangerous-bash",
    match: (call) => call.name === "bash" && /\brm\s+-rf\b|\bsudo\b/.test(call.input.command),
    decision: "ask",
    reason: "destructive or privileged shell command",
  },
];

function decide(call) {
  const rule = rules.find((candidate) => candidate.match(call));
  return rule ?? { decision: "allow", reason: "no matching restriction" };
}

const calls = [
  { name: "write", input: { path: "notes.md" } },
  { name: "write", input: { path: ".env" } },
  { name: "bash", input: { command: "sudo npm install -g something" } },
];

for (const call of calls) {
  const decision = decide(call);
  console.log(`${call.name}: ${decision.decision} (${decision.reason})`);
}
