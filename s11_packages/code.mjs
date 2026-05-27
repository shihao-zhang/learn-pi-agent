import { readFile } from "node:fs/promises";

const manifestUrl = new URL("./package.example.json", import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));

const pi = manifest.pi ?? {};
const resourceKinds = ["prompts", "skills", "extensions", "themes"];
const declared = resourceKinds.filter((kind) => Array.isArray(pi[kind]));

if (declared.length === 0) {
  throw new Error("Pi package must declare at least one resource kind.");
}

if (!manifest.peerDependencies?.["@earendil-works/pi-coding-agent"]) {
  throw new Error("Expected @earendil-works/pi-coding-agent in peerDependencies.");
}

console.log({
  package: manifest.name,
  resources: Object.fromEntries(declared.map((kind) => [kind, pi[kind].length])),
});
