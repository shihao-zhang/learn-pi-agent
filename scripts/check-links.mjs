import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

async function exists(relativePath) {
  await access(path.join(root, relativePath));
}

const required = [
  "README-zh.md",
  "README.md",
  "docs/research-notes.md",
  ".pi/prompts/review.md",
  ".pi/skills/repo-review/SKILL.md",
  ".pi/extensions/protect-dangerous.ts",
];

for (const file of required) {
  await exists(file);
}

const lessonDirs = (await readdir(root))
  .filter((name) => /^s\d\d_/.test(name))
  .sort();

if (lessonDirs.length !== 14) {
  throw new Error(`Expected 14 lesson directories, found ${lessonDirs.length}.`);
}

for (const dir of lessonDirs) {
  await exists(`${dir}/README.md`);
  await exists(`${dir}/code.mjs`);
}

const readme = await readFile(path.join(root, "README-zh.md"), "utf8");
for (const dir of lessonDirs) {
  if (!readme.includes(`${dir}/README.md`)) {
    throw new Error(`README-zh.md does not link to ${dir}.`);
  }
}

async function listMarkdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFiles(fullPath)));
    } else if (entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }
  return files;
}

const markdownLinks = /\[[^\]]+\]\(([^)]+)\)/g;
let skippedExternalLinks = 0;

for (const file of await listMarkdownFiles(root)) {
  const content = await readFile(file, "utf8");
  for (const match of content.matchAll(markdownLinks)) {
    const target = match[1];
    if (
      target.startsWith("http://") ||
      target.startsWith("https://")
    ) {
      skippedExternalLinks += 1;
      continue;
    }

    if (
      target.startsWith("#") ||
      target.startsWith("mailto:")
    ) {
      continue;
    }

    const [targetPath] = target.split("#");
    if (!targetPath) continue;
    const resolved = path.resolve(path.dirname(file), targetPath);
    await access(resolved);
  }
}

console.log(
  `check-links: ${lessonDirs.length} lessons and core resources found; skipped ${skippedExternalLinks} external links`,
);
