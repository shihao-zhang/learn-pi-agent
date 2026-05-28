import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const lessonDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(lessonDir, "..");
const repoSkillPath = path.join(repoRoot, ".pi/skills/repo-review/SKILL.md");
const repoSkillText = await readFile(repoSkillPath, "utf8");

const virtualFiles = new Map([
  [repoSkillPath, repoSkillText],
  [
    "/Users/demo/.pi/agent/skills/pdf-tools/SKILL.md",
    `
---
name: pdf-tools
description: Extracts text, tables, and forms from PDF files. Use when user asks to read, merge, split, inspect, or fill PDFs.
license: MIT
compatibility: Requires a local PDF parser in production.
---

# PDF Tools

## Workflow

1. Inspect the PDF task: extract, merge, split, summarize, or fill.
2. Read only the pages or references needed for the current task.
3. Use scripts only after checking file paths and permissions.
4. Return a concise summary plus generated file paths.

## Resources

- See references/pdf-operations.md for edge cases.
- Use scripts/pdf-inspect.mjs for local inspection in production.
`.trim(),
  ],
  [
    "/Users/demo/.pi/agent/skills/pdf-tools/references/pdf-operations.md",
    "Long PDF operation notes would live here and load only when referenced.",
  ],
  [
    "/Users/demo/.pi/agent/skills/pdf-tools/scripts/pdf-inspect.mjs",
    "console.log('inspect a PDF in a real skill');",
  ],
  [
    "/Users/demo/.pi/agent/skills/quick-note.md",
    `
---
name: quick-note
description: Writes a concise Chinese decision note. Use when user asks for a one page summary, product memo, or tradeoff note.
license: MIT
---

# Quick Note

## Output

- Decision
- Context
- Options
- Recommendation
`.trim(),
  ],
  [
    "/Users/demo/.agents/skills/meeting-summary/SKILL.md",
    `
---
name: meeting-summary
description: Summarizes meeting notes into decisions, risks, and follow ups. Use when user provides meeting transcript or notes.
license: MIT
---

# Meeting Summary

## Workflow

1. Identify decisions first.
2. Separate confirmed facts from guesses.
3. Extract owners and dates when present.
`.trim(),
  ],
  [
    path.join(repoRoot, ".agents/skills/product-spec/SKILL.md"),
    `
---
name: product-spec
description: Turns interviews, notes, and product ideas into Chinese PRD drafts. Use when asked to write requirements, clarify scope, or create acceptance criteria.
license: MIT
metadata: owner=product-platform
---

# Product Spec

## Workflow

1. Restate the user problem in plain Chinese.
2. Separate goal, non-goal, user story, and acceptance criteria.
3. Surface tradeoffs instead of hiding uncertainty.
4. Keep the draft readable for AI product managers.

## References

- Read references/prd-template.md only when a full PRD shape is needed.
`.trim(),
  ],
  [
    path.join(repoRoot, ".agents/skills/product-spec/references/prd-template.md"),
    "A long PRD template would be loaded only after the product-spec skill asks for it.",
  ],
  [
    path.join(repoRoot, "node_modules/acme-pi-skills/skills/repo-review/SKILL.md"),
    `
---
name: repo-review
description: A package version of repo review. It loses to the project skill because the project skill is discovered first.
license: MIT
---

# Package Repo Review

This duplicate exists to demonstrate name collision diagnostics.
`.trim(),
  ],
  [
    "/custom/skills/risky-migration/SKILL.md",
    `
---
name: risky-migration
description: Runs a risky migration checklist. Use only when user explicitly calls slash skill risky-migration.
license: MIT
disable-model-invocation: true
allowed-tools: read bash
---

# Risky Migration

## Workflow

1. Ask for explicit human confirmation.
2. Snapshot current state.
3. Run dry-run checks before any write.
4. Stop on the first unexpected result.
`.trim(),
  ],
]);

const skillRoots = [
  {
    label: "global Pi skills",
    path: "/Users/demo/.pi/agent/skills",
    allowRootMarkdown: true,
  },
  {
    label: "global .agents skills",
    path: "/Users/demo/.agents/skills",
    allowRootMarkdown: false,
  },
  {
    label: "project .pi skills",
    path: path.join(repoRoot, ".pi/skills"),
    allowRootMarkdown: true,
  },
  {
    label: "project .agents skills",
    path: path.join(repoRoot, ".agents/skills"),
    allowRootMarkdown: false,
  },
  {
    label: "package acme-pi-skills",
    path: path.join(repoRoot, "node_modules/acme-pi-skills/skills"),
    allowRootMarkdown: false,
  },
  {
    label: "settings skills",
    path: "/custom/skills",
    allowRootMarkdown: false,
  },
];

function isInside(root, filePath) {
  const relative = path.relative(root, filePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function parseFrontmatter(markdown) {
  const normalized = markdown.replace(/^\uFEFF/, "");
  const match = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: normalized.trim() };

  const frontmatter = {};
  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    frontmatter[key] = rawValue === "true" ? true : rawValue === "false" ? false : rawValue;
  }

  return { frontmatter, body: match[2].trim() };
}

function deriveNameFromPath(filePath) {
  if (path.basename(filePath) === "SKILL.md") {
    return path.basename(path.dirname(filePath));
  }
  return path.basename(filePath, ".md");
}

function validateSkill(frontmatter, filePath) {
  const warnings = [];
  const name = frontmatter.name ?? deriveNameFromPath(filePath);
  const description = frontmatter.description;

  if (!name) warnings.push("missing name");
  if (!description) warnings.push("missing description; skill will be skipped");
  if (name && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    warnings.push("name should use lowercase letters, numbers, and single hyphens");
  }
  if (name && name.length > 64) warnings.push("name is longer than 64 characters");
  if (description && description.length > 1024) warnings.push("description is longer than 1024 characters");

  return { name, description, warnings, valid: Boolean(name && description) };
}

function estimateTokens(text) {
  const cjkChars = text.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  const asciiWords = text.match(/[A-Za-z0-9_./:-]+/g)?.length ?? 0;
  const punctuation = text.match(/[^\sA-Za-z0-9_./:\-\u3400-\u9fff]/g)?.length ?? 0;
  return Math.ceil(cjkChars * 0.8 + asciiWords * 1.2 + punctuation * 0.4);
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function includesTrigger(text, word) {
  if (/^[a-z0-9]+$/.test(word)) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, "i").test(text);
  }
  return text.includes(word);
}

class MockResourceLoader {
  constructor({ files, roots }) {
    this.files = files;
    this.roots = roots;
    this.skills = [];
    this.diagnostics = [];
  }

  async reload() {
    const discovered = [];
    const byName = new Map();
    this.diagnostics = [];

    for (const root of this.roots) {
      const files = [...this.files.keys()]
        .filter((filePath) => isInside(root.path, filePath))
        .sort();

      for (const filePath of files) {
        const isSkillFile = path.basename(filePath) === "SKILL.md";
        const isRootMarkdown =
          root.allowRootMarkdown &&
          path.dirname(filePath) === root.path &&
          path.basename(filePath).endsWith(".md");

        if (!isSkillFile && !isRootMarkdown) continue;

        const parsed = parseFrontmatter(this.files.get(filePath));
        const validation = validateSkill(parsed.frontmatter, filePath);

        if (!validation.valid) {
          this.diagnostics.push({
            type: "skipped",
            filePath,
            reason: validation.warnings.join("; "),
          });
          continue;
        }

        const skill = {
          name: validation.name,
          description: validation.description,
          frontmatter: { ...parsed.frontmatter, name: validation.name },
          body: parsed.body,
          filePath,
          baseDir: isSkillFile ? path.dirname(filePath) : root.path,
          source: root.label,
          visible: parsed.frontmatter["disable-model-invocation"] !== true,
          warnings: validation.warnings,
        };

        if (byName.has(skill.name)) {
          this.diagnostics.push({
            type: "collision",
            name: skill.name,
            kept: byName.get(skill.name).filePath,
            skipped: skill.filePath,
          });
          continue;
        }

        byName.set(skill.name, skill);
        discovered.push(skill);
      }
    }

    this.skills = discovered;
    return this.skills;
  }

  getCatalogSkills() {
    return this.skills.filter((skill) => skill.visible);
  }

  buildSystemCatalog() {
    const entries = this.getCatalogSkills()
      .map((skill) => {
        return [
          `  <skill name="${escapeXml(skill.name)}" source="${escapeXml(skill.source)}">`,
          `    <description>${escapeXml(skill.description)}</description>`,
          "  </skill>",
        ].join("\n");
      })
      .join("\n");

    return `<skills>\n${entries}\n</skills>`;
  }

  listResources(skillName) {
    const skill = this.skills.find((candidate) => candidate.name === skillName);
    if (!skill) throw new Error(`Unknown skill: ${skillName}`);

    return [...this.files.keys()]
      .filter((filePath) => filePath !== skill.filePath && isInside(skill.baseDir, filePath))
      .map((filePath) => path.relative(skill.baseDir, filePath))
      .sort();
  }

  async loadSkill(skillName) {
    const skill = this.skills.find((candidate) => candidate.name === skillName);
    if (!skill) throw new Error(`Unknown skill: ${skillName}`);

    return {
      ...skill,
      fullText: this.files.get(skill.filePath),
      resources: this.listResources(skill.name),
      tokenEstimate: estimateTokens(this.files.get(skill.filePath)),
    };
  }

  suggestSkills(userText) {
    const explicit = userText.match(/\/skill:([a-z0-9-]+)/);
    if (explicit) return [explicit[1]];

    const text = userText.toLowerCase();
    const rules = [
      { name: "repo-review", words: ["review", "pr", "diff", "检查", "审查"] },
      { name: "pdf-tools", words: ["pdf", "表格", "合并", "拆分"] },
      { name: "product-spec", words: ["prd", "需求", "访谈", "验收"] },
      { name: "meeting-summary", words: ["meeting", "会议", "纪要", "待办"] },
      { name: "quick-note", words: ["memo", "备忘", "总结", "取舍"] },
    ];

    return rules
      .filter((rule) => rule.words.some((word) => includesTrigger(text, word)))
      .map((rule) => rule.name)
      .filter((name) => this.skills.some((skill) => skill.name === name && skill.visible));
  }
}

function printDiscovered(loader) {
  console.log("== discovered skills ==");
  for (const skill of loader.skills) {
    const visibility = skill.visible ? "catalog-visible" : "slash-only";
    console.log(`- ${skill.name} (${visibility})`);
    console.log(`  source: ${skill.source}`);
    console.log(`  file: ${skill.filePath}`);
    console.log(`  description: ${skill.description}`);
  }
  console.log();
}

function printDiagnostics(loader) {
  console.log("== diagnostics ==");
  if (loader.diagnostics.length === 0) {
    console.log("no warnings");
    console.log();
    return;
  }

  for (const item of loader.diagnostics) {
    if (item.type === "collision") {
      console.log(`- collision: ${item.name}`);
      console.log(`  kept: ${item.kept}`);
      console.log(`  skipped: ${item.skipped}`);
    } else {
      console.log(`- ${item.type}: ${item.filePath}`);
      console.log(`  reason: ${item.reason}`);
    }
  }
  console.log();
}

function printCatalog(loader) {
  const catalog = loader.buildSystemCatalog();
  console.log("== system catalog ==");
  console.log(catalog);
  console.log(`catalog tokens: about ${estimateTokens(catalog)}`);
  console.log();
}

function printTriggerSimulation(loader) {
  const prompts = [
    "帮我严查这个 PR diff，重点看测试和安全风险",
    "把这些用户访谈整理成 PRD 和验收标准",
    "请合并这几个 PDF，并抽取第一页表格",
    "/skill:risky-migration run dry check only",
  ];

  console.log("== trigger simulation ==");
  for (const prompt of prompts) {
    const suggestions = loader.suggestSkills(prompt);
    console.log(`user: ${prompt}`);
    console.log(`suggested: ${suggestions.length > 0 ? suggestions.join(", ") : "none"}`);
  }
  console.log();
}

async function printLoadedSkill(loader, skillName) {
  const loaded = await loader.loadSkill(skillName);
  console.log(`== loadSkill("${skillName}") ==`);
  console.log(`source: ${loaded.source}`);
  console.log(`full SKILL.md tokens: about ${loaded.tokenEstimate}`);
  console.log(`resources listed, not loaded: ${loaded.resources.length > 0 ? loaded.resources.join(", ") : "none"}`);
  console.log("body preview:");
  console.log(loaded.body.split("\n").slice(0, 8).join("\n"));
  console.log();
}

async function printDisclosureCost(loader, activatedSkillName) {
  const catalogTokens = estimateTokens(loader.buildSystemCatalog());
  const visibleSkills = loader.getCatalogSkills();
  let fullVisibleTokens = 0;

  for (const skill of visibleSkills) {
    const loaded = await loader.loadSkill(skill.name);
    fullVisibleTokens += loaded.tokenEstimate;
  }

  const activated = await loader.loadSkill(activatedSkillName);

  console.log("== progressive disclosure cost ==");
  console.log(`visible skills in catalog: ${visibleSkills.length}`);
  console.log(`catalog only: about ${catalogTokens} tokens`);
  console.log(`if every visible SKILL.md were loaded: about ${fullVisibleTokens} tokens`);
  console.log(`activated ${activatedSkillName}: about ${activated.tokenEstimate} tokens`);
  console.log(`saved before activation: about ${fullVisibleTokens - catalogTokens} tokens`);
}

const loader = new MockResourceLoader({
  files: virtualFiles,
  roots: skillRoots,
});

await loader.reload();

printDiscovered(loader);
printDiagnostics(loader);
printCatalog(loader);
printTriggerSimulation(loader);
await printLoadedSkill(loader, "product-spec");
await printLoadedSkill(loader, "risky-migration");
await printDisclosureCost(loader, "product-spec");
