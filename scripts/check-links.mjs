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
const externalUrls = new Set();

for (const file of await listMarkdownFiles(root)) {
  const content = await readFile(file, "utf8");
  for (const match of content.matchAll(markdownLinks)) {
    const target = match[1];
    if (
      target.startsWith("http://") ||
      target.startsWith("https://")
    ) {
      skippedExternalLinks += 1;
      externalUrls.add(target.split("#")[0]);
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

// 真实运行 trace 资产存在性(P3 产出,作为第一手证据)
const traceAssets = [
  ".evidence/pi-evidence.json",
  ".evidence/traces/raw-json-trace.jsonl",
  ".evidence/traces/json-trace-readme.md",
  ".evidence/traces/pi-help.txt",
];
for (const asset of traceAssets) {
  await exists(asset);
}

// 可选:外链存活检查。默认跳过(CI/无网环境不应因外链失败而断)。
// 用 CHECK_LINKS_ONLINE=1 npm run check 开启。
let onlineReport = "";
if (process.env.CHECK_LINKS_ONLINE === "1") {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const run = promisify(execFile);
  const urls = [...externalUrls].sort();
  const dead = [];
  // 用 curl 而非 node fetch:某些站点(如 pi.dev)对 node fetch 的 TLS/HTTP2 握手不友好,
  // 但 curl 能正常访问。curl 更能反映链接对普通读者的真实可达性。
  for (const url of urls) {
    try {
      const { stdout } = await run(
        "curl",
        ["-sS", "-o", "/dev/null", "-w", "%{http_code}", "-L", "--max-time", "20", url],
        { timeout: 25000 },
      );
      const code = Number.parseInt(stdout.trim(), 10);
      if (!Number.isFinite(code) || code >= 400) dead.push(`${url} -> ${stdout.trim()}`);
    } catch (error) {
      dead.push(`${url} -> ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (dead.length > 0) {
    throw new Error(`Dead external links (${dead.length}):\n${dead.join("\n")}`);
  }
  onlineReport = `; verified ${urls.length} external links alive`;
}

console.log(
  `check-links: ${lessonDirs.length} lessons, trace assets, and core resources found; skipped ${skippedExternalLinks} external links${onlineReport}`,
);
