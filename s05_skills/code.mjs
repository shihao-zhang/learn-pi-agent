import { readFile } from "node:fs/promises";

const skillUrl = new URL("../.pi/skills/repo-review/SKILL.md", import.meta.url);
const text = await readFile(skillUrl, "utf8");

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: markdown };
  const frontmatter = {};
  for (const line of match[1].split("\n")) {
    const [key, ...rest] = line.split(":");
    frontmatter[key.trim()] = rest.join(":").trim();
  }
  return { frontmatter, body: match[2].trim() };
}

const skill = parseFrontmatter(text);

console.log("skill loaded:");
console.log(skill.frontmatter);
console.log("body preview:");
console.log(skill.body.split("\n").slice(0, 4).join("\n"));
