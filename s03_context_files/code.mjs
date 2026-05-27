const discovered = [
  {
    source: "~/.pi/agent/AGENTS.md",
    content: "- Prefer concise answers.\n- Ask before destructive actions.",
  },
  {
    source: "/repo/AGENTS.md",
    content: "- Run npm run check after edits.\n- Keep teaching examples dependency-free.",
  },
  {
    source: "/repo/product/AGENTS.md",
    content: "- Explain tradeoffs for product managers.",
  },
];

function assembleContext(files) {
  return files
    .map((file) => `# ${file.source}\n${file.content.trim()}`)
    .join("\n\n");
}

console.log(assembleContext(discovered));
