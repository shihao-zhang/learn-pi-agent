const promptDirectories = [
  "/Users/demo/.pi/agent/prompts",
  "/repo/.pi/prompts",
  "/repo/node_modules/pi-workflows/prompts",
];

const mockFiles = new Map([
  [
    "/Users/demo/.pi/agent/prompts/brief.md",
    `
Summarize $1 for an AI product manager.

Keep it short. Extra context: ${"$ARGUMENTS"}
`.trim(),
  ],
  [
    "/repo/.pi/prompts/review.md",
    `
---
description: Review a target with product and engineering judgment
argument-hint: "<target> [focus...]"
---

Review $1.

Primary focus: ${"${@:2:1}"}
Other focus: ${"${@:3}"}

Check:
- correctness and behavioral regressions
- missing tests or weak verification
- safety and permission boundaries

All arguments: ${"$@"}
All arguments alias: ${"$ARGUMENTS"}
`.trim(),
  ],
  [
    "/repo/node_modules/pi-workflows/prompts/component.md",
    `
---
description: Draft a small component implementation plan
argument-hint: "<name> [features...]"
---

Create a component named $1.

Features: ${"${@:2}"}
Original request: ${"$@"}
`.trim(),
  ],
  [
    "/repo/.pi/prompts/nested/ignored.md",
    "This file is ignored in the mock because prompts discovery is non-recursive.",
  ],
]);

function dirname(filePath) {
  return filePath.split("/").slice(0, -1).join("/");
}

function basename(filePath) {
  return filePath.split("/").at(-1);
}

function unquote(value) {
  const trimmed = value.trim();
  const quote = trimmed[0];
  if ((quote === `"` || quote === `'`) && trimmed.endsWith(quote)) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseFrontmatter(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  if (lines[0]?.trim() !== "---") {
    return { data: {}, body: markdown.trim() };
  }

  const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (end === -1) {
    return {
      data: {},
      body: markdown.trim(),
      diagnostics: ["opening frontmatter marker has no closing marker"],
    };
  }

  const data = {};
  const diagnostics = [];
  for (const line of lines.slice(1, end)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!match) {
      diagnostics.push(`ignored unsupported frontmatter line: ${trimmed}`);
      continue;
    }

    data[match[1]] = unquote(match[2]);
  }

  return {
    data,
    body: lines.slice(end + 1).join("\n").trim(),
    diagnostics,
  };
}

function firstNonEmptyLine(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
}

function commandNameFromPath(filePath) {
  return basename(filePath).replace(/\.md$/, "");
}

function discoverPromptTemplates(files) {
  const templates = [];
  const ignored = [];

  for (const [filePath, content] of files) {
    if (!filePath.endsWith(".md")) continue;

    const parent = dirname(filePath);
    if (!promptDirectories.includes(parent)) {
      ignored.push({
        path: filePath,
        reason: "not a direct child of a configured prompts directory",
      });
      continue;
    }

    const parsed = parseFrontmatter(content);
    templates.push({
      name: commandNameFromPath(filePath),
      source: filePath,
      description: parsed.data.description ?? firstNonEmptyLine(parsed.body) ?? "",
      argumentHint: parsed.data["argument-hint"] ?? "",
      body: parsed.body,
      diagnostics: parsed.diagnostics ?? [],
    });
  }

  return {
    templates: templates.sort((left, right) => left.name.localeCompare(right.name)),
    ignored,
  };
}

function splitCommandLine(input) {
  const tokens = [];
  let current = "";
  let quote = "";
  let escaped = false;
  let tokenStarted = false;

  for (const char of input.trim()) {
    if (escaped) {
      current += char;
      escaped = false;
      tokenStarted = true;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      tokenStarted = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = "";
      } else {
        current += char;
      }
      tokenStarted = true;
      continue;
    }

    if (char === `"` || char === `'`) {
      quote = char;
      tokenStarted = true;
      continue;
    }

    if (/\s/.test(char)) {
      if (tokenStarted) {
        tokens.push(current);
        current = "";
        tokenStarted = false;
      }
      continue;
    }

    current += char;
    tokenStarted = true;
  }

  if (escaped) current += "\\";
  if (quote) throw new Error(`Unclosed quote: ${quote}`);
  if (tokenStarted) tokens.push(current);
  return tokens;
}

function parseSlashCommand(input) {
  if (!input.startsWith("/")) {
    throw new Error(`Slash command must start with "/": ${input}`);
  }

  const [rawName, ...args] = splitCommandLine(input.slice(1));
  if (!rawName) throw new Error("Slash command is missing a command name.");
  return { name: rawName, args };
}

function argsToText(args) {
  return args.join(" ");
}

function expandPromptTemplate(body, args) {
  return body
    .replace(/\$\{@:(\d+)(?::(\d+))?\}/g, (_, start, length) => {
      const startIndex = Number(start) - 1;
      if (startIndex < 0) return "";
      const count = length === undefined ? undefined : Number(length);
      const slice =
        count === undefined
          ? args.slice(startIndex)
          : args.slice(startIndex, startIndex + count);
      return argsToText(slice);
    })
    .replaceAll("$ARGUMENTS", argsToText(args))
    .replaceAll("$@", argsToText(args))
    .replace(/\$(\d+)/g, (_, index) => args[Number(index) - 1] ?? "");
}

function expandSlashCommand(input, templates) {
  const command = parseSlashCommand(input);
  const template = templates.find((item) => item.name === command.name);
  if (!template) throw new Error(`Unknown prompt template: /${command.name}`);

  return {
    command: `/${command.name}`,
    source: template.source,
    description: template.description,
    argumentHint: template.argumentHint,
    args: command.args,
    prompt: expandPromptTemplate(template.body, command.args),
  };
}

function printTemplates(templates, ignored) {
  console.log("== discovered slash commands ==");
  for (const template of templates) {
    console.log(`/${template.name}`);
    console.log(`  source: ${template.source}`);
    console.log(`  description: ${template.description}`);
    if (template.argumentHint) console.log(`  argument-hint: ${template.argumentHint}`);
    for (const diagnostic of template.diagnostics) {
      console.log(`  diagnostic: ${diagnostic}`);
    }
  }
  console.log();

  console.log("== ignored files ==");
  for (const item of ignored) {
    console.log(`- ${item.path}`);
    console.log(`  reason: ${item.reason}`);
  }
  console.log();
}

function printAutocomplete(templates) {
  console.log("== autocomplete view ==");
  for (const template of templates) {
    const hint = template.argumentHint ? ` ${template.argumentHint}` : "";
    console.log(`→ ${template.name}${hint} — ${template.description}`);
  }
  console.log();
}

function printExpansion(result) {
  console.log(`== expanded prompt: ${result.command} ==`);
  console.log(`source: ${result.source}`);
  console.log(`args: ${JSON.stringify(result.args)}`);
  console.log();
  console.log(result.prompt);
  console.log();
}

const { templates, ignored } = discoverPromptTemplates(mockFiles);

printTemplates(templates, ignored);
printAutocomplete(templates);

const review = expandSlashCommand(
  `/review "the staged diff" "safety issues" "missing tests"`,
  templates,
);
printExpansion(review);

const component = expandSlashCommand(
  `/component Button accessibility mobile polish`,
  templates,
);
printExpansion(component);

console.log("== template vs skill boundary ==");
console.log("- This demo expands text only.");
console.log("- If the workflow needs scripts, references, assets, or multi-step loading, use a skill.");
