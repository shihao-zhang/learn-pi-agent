import path from "node:path";
import { readFile } from "node:fs/promises";

const CORE_PEERS = [
  "@earendil-works/pi-ai",
  "@earendil-works/pi-agent-core",
  "@earendil-works/pi-coding-agent",
  "@earendil-works/pi-tui",
  "typebox",
];

const RESOURCE_KINDS = ["prompts", "skills", "extensions", "themes"];

const manifestUrl = new URL("./package.example.json", import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseNpmSource(spec) {
  const raw = spec.slice("npm:".length);
  const marker = raw.startsWith("@") ? raw.indexOf("@", 1) : raw.indexOf("@");
  const name = marker === -1 ? raw : raw.slice(0, marker);
  const version = marker === -1 ? undefined : raw.slice(marker + 1);

  assert(name.length > 0, `Invalid npm package source: ${spec}`);
  return {
    type: "npm",
    id: name,
    ref: version,
    pinned: Boolean(version),
    normalized: version ? `npm:${name}@${version}` : `npm:${name}`,
  };
}

function parseGitSource(spec) {
  const raw = spec.startsWith("git:") ? spec.slice("git:".length) : spec;
  const marker = raw.lastIndexOf("@");
  const hasRef = marker > 0 && !raw.slice(marker + 1).includes("/");
  const repo = hasRef ? raw.slice(0, marker) : raw;
  const ref = hasRef ? raw.slice(marker + 1) : undefined;

  assert(repo.length > 0, `Invalid git package source: ${spec}`);
  return {
    type: "git",
    id: repo.replace(/^https?:\/\//, ""),
    ref,
    pinned: Boolean(ref),
    normalized: ref ? `git:${repo}@${ref}` : `git:${repo}`,
  };
}

function parseLocalSource(spec, settingsDir = process.cwd()) {
  const absolute = path.isAbsolute(spec) ? spec : path.resolve(settingsDir, spec);
  return {
    type: "local",
    id: absolute,
    pinned: true,
    normalized: absolute,
  };
}

function normalizePackageSource(entry, settingsDir = process.cwd()) {
  const source = typeof entry === "string" ? entry : entry?.source;
  assert(typeof source === "string" && source.trim().length > 0, "Package source must be a non-empty string.");

  const spec = source.trim();
  const parsed = spec.startsWith("npm:")
    ? parseNpmSource(spec)
    : spec.startsWith("git:") || spec.startsWith("https://") || spec.startsWith("http://")
      ? parseGitSource(spec)
      : parseLocalSource(spec, settingsDir);

  const warnings = [];
  if (parsed.type === "npm" && !parsed.pinned) {
    warnings.push("npm package is not version-pinned; updates may change behavior.");
  }
  if (parsed.type === "git" && !parsed.pinned) {
    warnings.push("git package is not ref-pinned; review updates before production use.");
  }
  if (parsed.type === "local") {
    warnings.push("local package source is mutable and depends on the current filesystem.");
  }

  return { ...parsed, filters: typeof entry === "object" ? Object.keys(entry).filter((key) => key !== "source") : [], warnings };
}

function inspectManifest(pkg) {
  const warnings = [];
  const pi = pkg.pi ?? {};

  assert(pkg.name, "package.json must include a package name.");
  assert(pkg.version, "package.json must include a package version.");
  if (!pkg.keywords?.includes("pi-package")) {
    warnings.push('keywords should include "pi-package" for Pi package discovery.');
  }

  const resources = Object.fromEntries(
    RESOURCE_KINDS.map((kind) => {
      const entries = pi[kind];
      if (entries === undefined) return [kind, 0];
      assert(Array.isArray(entries), `pi.${kind} must be an array.`);

      for (const value of entries) {
        assert(typeof value === "string" && value.trim().length > 0, `pi.${kind} contains an empty resource path.`);
        assert(!path.isAbsolute(value), `pi.${kind} path should be relative to the package root: ${value}`);
      }

      return [kind, entries.length];
    }),
  );

  assert(Object.values(resources).some((count) => count > 0), "Pi package must declare at least one resource path.");

  if (resources.extensions > 0) {
    if (!pkg.peerDependencies?.["@earendil-works/pi-coding-agent"]) {
      warnings.push("extensions should peer-depend on @earendil-works/pi-coding-agent.");
    } else if (pkg.peerDependencies["@earendil-works/pi-coding-agent"] !== "*") {
      warnings.push('extensions should normally peer-depend on @earendil-works/pi-coding-agent with range "*".');
    }
  }

  for (const coreName of CORE_PEERS) {
    if (pkg.dependencies?.[coreName]) {
      warnings.push(`${coreName} should be a peerDependency, not bundled in dependencies.`);
    }
    if (pkg.peerDependencies?.[coreName] && pkg.peerDependencies[coreName] !== "*") {
      warnings.push(`${coreName} peerDependency should normally use "*".`);
    }
  }

  if (resources.extensions > 0) {
    warnings.push("extensions execute code with the user's system permissions; review source before installing.");
  }
  if (pkg.scripts?.preinstall || pkg.scripts?.postinstall || pkg.scripts?.prepare) {
    warnings.push("lifecycle scripts can execute during package installation; audit them carefully.");
  }

  return { resources, warnings };
}

const packageSources = [
  "npm:@example/pi-product-workflows@0.1.0",
  "git:github.com/acme/pi-product-workflows@v1.0.0",
  "./s11_packages",
  {
    source: "npm:@example/pi-product-workflows",
    extensions: ["extensions/*.ts", "!extensions/legacy.ts"],
    skills: [],
  },
];

const inspection = inspectManifest(manifest);
const normalizedSources = packageSources.map((source) => normalizePackageSource(source));
const sourceWarnings = normalizedSources.flatMap((source) => source.warnings.map((warning) => `${source.normalized}: ${warning}`));

console.log(JSON.stringify({
  package: manifest.name,
  resources: inspection.resources,
  normalizedSources,
  warnings: [...inspection.warnings, ...sourceWarnings],
}, null, 2));
