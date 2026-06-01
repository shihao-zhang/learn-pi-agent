# Learn Pi Agent — Minimal Coding Agent Harness Engineering

> Learning Pi is not chasing a new agent buzzword — it is learning a more disciplined harness design: placing a capable model inside a transparent, extensible, and recoverable terminal environment.

[English](README.md) | [中文](README-zh.md)

## One-Line Position

Pi is a minimal terminal coding agent harness. Its core idea is not "encode intelligence into flowcharts" but to give a model that already has coding agency a clear working environment: a small set of tools, observable context, hot-reloadable extensions, persistent sessions, and an embeddable runtime.

Verified facts as of **2026-05-30** (Pi monorepo commit `dbb9911a`):

- Official repository: [earendil-works/pi-mono](https://github.com/earendil-works/pi-mono)
- Official docs: [pi.dev/docs/latest](https://pi.dev/docs/latest)
- npm package: `@earendil-works/pi-coding-agent@0.78.0` (the old `@mariozechner/*` scope entered a transition period from `0.74.0`)
- Default tools: `read`, `write`, `edit`, `bash`; `grep`, `find`, `ls` are opt-in built-in read-only tools
- Extension surface: context files, prompt templates, skills, TypeScript extensions, packages, and SDK / RPC / JSON event stream integrations

First-hand evidence is in [`.evidence/pi-evidence.json`](.evidence/pi-evidence.json) and [`.evidence/traces/`](.evidence/traces/). All `file:line` references in chapter READMEs are anchored to commit `dbb9911a`.

## Why This Project

The reference project `learn-claude-code` achieves a high level of completeness: it is not a "link dump" but a complex agent harness broken into a progressive curriculum, with each chapter covering concepts, code, and boundary declarations.

This repository follows the same product philosophy, but targets Pi instead:

- `learn-claude-code` is best for understanding the complete mechanics of a mature coding harness.
- `learn-pi-agent` is best for understanding the trade-offs of a "minimal, transparent, self-extensible" harness.
- They are not substitutes: one dissects a full system; the other studies the smallest extensible kernel.

## Pi Core Philosophy

```text
Pi = minimal terminal harness
   + unified multi-provider LLM API
   + agent loop
   + session storage
   + resource loader
   + TypeScript extensions
   + skills / prompts / context files
   + optional SDK / RPC embedding
```

In plain terms:

```text
The model decides what to do next.
The harness lets the model see the environment, call tools,
leave a record, and respect boundaries.
Pi's distinctive property: it makes as few decisions for the model as possible.
```

## The Pi Harness Pattern

```text
User prompt
   |
   v
messages[] + system prompt + resources
   |
   v
LLM response
   |
   +-- no tool call --> return text
   |
   +-- tool call ----> permission / extension hooks
                      |
                      v
              execute read/write/edit/bash
                      |
                      v
              append tool_result
                      |
                      v
                   loop
```

Pi's "minimalism" is not the absence of engineering — it is concentrating engineering at a few key points:

- **Few tools**: the model gets four common tools by default.
- **Short prompts**: minimal use of giant system prompts to "write the model's personality".
- **Transparent context**: `AGENTS.md`, skills, and prompts are all human-readable and editable.
- **Side-mounted extensions**: complex capabilities attach via extension / package without polluting the main loop.
- **Traceable sessions**: the session tree preserves branches and history, enabling rollback and review.

## Three-Layer Architecture

Pi is a monorepo with three cleanly separated layers (verified per-package against commit `dbb9911a`):

```text
┌─────────────────────────────────────────────────────────────┐
│  L3  pi-coding-agent  (packages/coding-agent)                │
│      Human-facing CLI product: tools / skills / prompts /    │
│      extensions / packages / compaction / sessions / TUI /   │
│      RPC / JSON event stream                                  │
├─────────────────────────────────────────────────────────────┤
│  L2  pi-agent-core    (packages/agent)                       │
│      Harness runtime:                                         │
│        · bare agent loop   (agent-loop.ts)                    │
│        · AgentHarness orchestration (harness/agent-harness.ts)│
│          (orchestration only; internals not yet in .evidence)│
├─────────────────────────────────────────────────────────────┤
│  L1  pi-ai            (packages/ai)                           │
│      Unified multi-provider LLM API: 30+ providers / OAuth / │
│      compatibility flags                                      │
└─────────────────────────────────────────────────────────────┘
```

| Layer | Package | Responsibility | Not responsible for |
|---|---|---|---|
| **L1 pi-ai** | `packages/ai` | Normalize wire protocols, auth, and model compat flags across providers into a single API | Knows nothing about "tools", "sessions", or "skills" |
| **L2 pi-agent-core** | `packages/agent` | Run the agent loop; `AgentHarness` (`harness/agent-harness.ts`) adds an orchestration layer on top — its internals (turn/queue/durable-state handling) were **not** extracted into `.evidence` this pass, so treat field-level claims as unverified | Does not implement `read`/`bash`; does not manage TUI |
| **L3 pi-coding-agent** | `packages/coding-agent` | Wraps L2 into a usable terminal coding agent: built-in tools, resource discovery, extensions, permission gate, compaction, session UI | Does not reimplement the loop; loop lives in L2 |

> Where your task lands determines which chapters and code you should read:
> - Switching model / adding provider → L1 (s08)
> - Understanding why automation stops / how steer queues work → L2 (s01 + AgentHarness)
> - Adding tools / writing extensions / controlling permissions / packaging → L3 (s02, s05, s06, s09, s11)

## 14-Chapter Progressive Curriculum

> Goal: from a minimal loop, to a teaching harness that can explain Pi's real product architecture.

> Start with [00 Mechanism Map](00_map/README.md) — it explains Pi's three-layer architecture, four cross-cutting threads, and three reader paths. **Chapter numbers are order; the mechanism map is structure.**

| Chapter | Topic | One-line summary |
|---|---|---|
| [00](00_map/README.md) | Mechanism Map | Three-layer architecture + cross-cutting threads + three reader paths (read first) |
| [s01](s01_agent_loop/README.md) | Agent Loop | One loop + four tools: Pi's minimal beating heart |
| [s02](s02_tool_dispatch/README.md) | Tool Dispatch | Add tools by changing the registry, not the loop |
| [s03](s03_context_files/README.md) | Context Files | `AGENTS.md` is the entry point for project knowledge, not an omnipotent prompt |
| [s04](s04_prompt_templates/README.md) | Prompt Templates | Reusable tasks written as `/command` to reduce repetitive input |
| [s05](s05_skills/README.md) | Skills | Expose the catalog first; load the full workflow only when needed |
| [s06](s06_extensions/README.md) | Extensions | TypeScript extensions attach hooks, tools, and commands to the harness |
| [s07](s07_sessions/README.md) | Sessions | Session tree makes branching, rollback, and review a product capability |
| [s08](s08_models/README.md) | Models | Multi-provider complexity lies in message and state compatibility, not API naming |
| [s09](s09_permissions/README.md) | Permissions | Even a minimal toolset needs clear boundaries |
| [s10](s10_sdk_embed/README.md) | SDK Embed | Pi as an embeddable runtime engine inside your own application |
| [s11](s11_packages/README.md) | Pi Packages | Package and distribute prompts, skills, extensions, and themes |
| [s12](s12_comprehensive/README.md) | Comprehensive | All mechanisms assembled back into one explainable harness |
| [s13](s13_compaction/README.md) | Compaction | Context economics: replacing old messages with structured summaries |
| [s14](s14_observability/README.md) | Observability | Turning agent progress into a trace tree, with default redaction |

## How to Read Each Chapter

Every chapter follows the same learning rhythm to avoid presenting isolated concepts:

1. Read "Problem this chapter solves" to confirm why the mechanism exists.
2. Read "Why the previous chapter was insufficient" to understand the progression between chapters.
3. Read "Mechanism breakdown" and diagrams to place abstract concepts inside the harness execution chain.
4. Run `code.mjs`, then read "Code walkthrough" to see how the teaching mock expresses the mechanism.
5. Read "Corresponding real Pi" and "Teaching simplifications vs. production differences" to separate official facts, teaching analogies, and this repository's simplifications.

This approach deliberately separates "product mechanics" from "code implementation": product managers can focus on problems, diagrams, and boundaries; engineering readers can drill into mock code and real Pi documentation.

## Three Reader Paths

You do not need to read s01 through s14 in order. Choose one path by role:

### Path A: AI Product Manager / Requirements Stakeholder

You need **correct mental models** to avoid being led astray by wrong assumptions. Focus on "Problem this chapter solves", diagrams, and "Teaching simplifications vs. production differences" in each chapter; skip `code.mjs`.

```text
00 this page (three layers + cross-cutting threads)
 → s01 agent loop (concepts only: model proposes actions, harness executes, why it stops)
 → s05 skills (progressive disclosure: many capabilities, loaded on demand)
 → cross-cutting thread 2: token economics / compaction (why context must be conserved)
 → s09 permissions (key point: Pi has no allow/ask/block triad — only one block gate)
 → s12 comprehensive (how all mechanisms return to one architecture diagram)
```

**Most important counter-intuitive facts**: Pi has no "permission system"; `max_turns` is not a Pi concept; skills cannot guarantee execution. Carry these when writing requirements, and you will not ask engineering to build things Pi does not provide.

### Path B: Agent Platform / Harness Designer

You need **runtime control plane**: state, queues, interception points, recoverability, observability.

```text
00 this page
 → s01 + L2 AgentHarness orchestration (phase / turn snapshot / save point / queue)
 → s06 extensions (events: observational vs. control/mutation; tool_call can block, tool_result can be rewritten)
 → s09 permissions (where the deterministic gate lives)
 → cross-cutting thread 4: observability (trace design, redaction boundaries)
 → session-format / durable (recoverable state tree)
```

**Most important takeaway**: Pi leaves "policy" to the caller (stop boundary, permissions, compaction are all customizable via hooks/extensions); the core stays small. When designing a platform, think carefully about what belongs in the core vs. what should be an extension.

### Path C: Engineering Reader / Developer Integrating Pi

Full chapters + `code.mjs` + drilling into `.evidence/` file:line references.

```text
Read s01 → s14 in order. Each chapter:
  1. Read "Mechanism breakdown" to build structure
  2. Run code.mjs to see how the teaching mock expresses the mechanism
  3. Read "Corresponding real Pi" file:line and cross-check against pi-mono source
  4. Read "Factual verification checklist" to know what will expire
Before integrating real Pi: prioritize the official SDK / Extensions / Packages / Sessions docs + .evidence/.
```

**Most valuable resource**: `.evidence/pi-evidence.json` is the upstream for all `file:line` references; this repository is a concept map, not an API reference — treat source code as authoritative for signatures.

## Chapter Learning Map

| Stage | Chapters | Capabilities you will build |
|---|---|---|
| Minimal runtime | s01–s02 | Understand agent loop, tool calls, tool registry, and why tool interfaces are more stable than prompt tricks |
| Context injection | s03–s05 | Distinguish persistent rules, reusable prompts, and on-demand skills; understand progressive disclosure |
| Behavior extension | s06 | Know when a TypeScript extension is needed and why extensions are both powerful and risky |
| State and models | s07–s08 | Understand session tree, branching, model switching, and the product complexity of multi-provider adapters |
| Boundary control | s09 | Treat permissions as a harness gate, not a "please be careful" in a prompt |
| Productionization | s10–s12 | Understand SDK embedding, package distribution, and how to assemble prior mechanisms into a complete harness |
| Advanced topics | s13–s14 | Context economics (compaction) and observability (trace tree with redaction) |

## Quick Start

Teaching demos in this repository do not require a real LLM and do not need Pi installed. Run from the repository root:

```bash
npm run check
node s01_agent_loop/code.mjs
node s12_comprehensive/code.mjs
```

To experience real Pi:

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
cd /path/to/project
pi
```

`--ignore-scripts` reduces lifecycle script risk when globally installing a third-party package. If the official installation instructions change, the latest official docs take precedence.

Pi-native resource samples are already included in this repository:

```text
.pi/
  prompts/review.md
  skills/repo-review/SKILL.md
  extensions/protect-dangerous.ts
```

Inside a real Pi session, edit these files then run `/reload` to trigger resource re-discovery.

Note: `.pi/extensions/protect-dangerous.ts` is a minimal teaching example — it is not a production shell sandbox or a complete permission system. Before using any third-party or local extension in a real project, review the source code and its behavior in non-interactive mode.

## Project Structure

```text
learn-pi-agent/
  README.md                 # English guide (this file)
  README-zh.md              # Chinese guide
  00_map/
    README.md               # Mechanism map: three-layer architecture + reader paths
  s01_agent_loop/           # Each chapter covers one independent topic
    README.md
    code.mjs
  s02_tool_dispatch/ ... s14_observability/
  .pi/                      # Project-level Pi-native resource samples
    prompts/
    skills/
    extensions/
  .evidence/
    pi-evidence.json        # First-hand evidence: file:line anchored to dbb9911a
    traces/                 # Verifiable trace artifacts
  docs/
    research-notes.md       # Source verification and reading order
  scripts/
    check-links.mjs         # Lightweight self-check
```

## Scope Declaration

This repository is an educational project. It is not official Pi documentation and makes no claims about any Pi internal implementation details.

To keep the learning path clear, example code applies three categories of simplification:

- `s01`–`s09` use local mocks to demonstrate harness mechanics without issuing LLM requests.
- Prompts, skills, and extensions under `.pi/` are Pi-native resource samples but are not executed against real Pi during `npm run check`.
- `s10`–`s11` provide local mock demos and include reference files for when real Pi dependencies are needed.

The trade-off is explicit: understand harness design first, then connect real dependencies. This minimizes learning overhead and is particularly suited to product managers, platform architects, and anyone who wants to understand agent product mechanics.

## Sources

Core sources are in [docs/research-notes.md](docs/research-notes.md). Priority order: official docs > official repository > official announcements > third-party teardowns > community examples.

This repository was bootstrapped from the attachment `pi-agent-harness-学习指南.md`, but all perishable facts — especially package names and repository migration — have been re-verified against first-hand sources.

**Fact baseline**: Pi monorepo commit `dbb9911a` (2026-05-30), npm `@earendil-works/pi-coding-agent@0.78.0`, canonical repository name `earendil-works/pi-mono`.

## License

MIT
