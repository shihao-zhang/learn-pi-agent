import { Type } from "typebox";
// Pi extension and SDK examples use the Pi-supported bare `typebox` specifier.
// In a standalone npm project, use the package name recommended by the Pi docs
// or your local bundler setup.
//
// Snapshot note (Pi commit dbb9911a, 2026-05-30): this is a teaching reference,
// not a runnable, type-checked program. The names used below are evidence-backed
// against .evidence/pi-evidence.json: the async factory `createAgentSession(options)`
// returns `{ session, ... }`; ALL of its options are optional (cwd, authStorage,
// modelRegistry, resourceLoader, sessionManager, tools, customTools, ...), and when
// no resourceLoader is supplied it constructs a DefaultResourceLoader internally.
// We deliberately rely on those defaults instead of hand-constructing AuthStorage /
// ModelRegistry / SessionManager, because their exact factory shapes
// (e.g. createModelRegistry / buildModelRegistry, SessionManager factories,
// DefaultResourceLoader's required `agentDir`) are intentionally out of scope here —
// see .evidence for the verified signatures before wiring them in production.
import {
  createAgentSession,
  defineTool,
} from "@earendil-works/pi-coding-agent";

const lookupProductSpec = defineTool({
  name: "lookup_product_spec",
  label: "Lookup Product Spec",
  description: "Return a product requirement summary by document id.",
  parameters: Type.Object({
    documentId: Type.String({ description: "Internal product document id" }),
  }),
  async execute(_toolCallId, params) {
    return {
      content: [
        {
          type: "text",
          text: `Spec ${params.documentId}: demo summary from product system.`,
        },
      ],
      details: {},
    };
  },
});

// Minimal evidence-backed construction: every option is optional. With no
// resourceLoader supplied, createAgentSession builds a DefaultResourceLoader and
// awaits reload() for us. In production you would inject authStorage / modelRegistry
// / sessionManager built from the real factories (see .evidence) to control auth,
// providers and session persistence.
const { session } = await createAgentSession({
  cwd: process.cwd(),
  tools: ["read", "bash", "lookup_product_spec"],
  customTools: [lookupProductSpec],
});

const unsubscribe = session.subscribe((event) => {
  if (
    event.type === "message_update" &&
    event.assistantMessageEvent.type === "text_delta"
  ) {
    process.stdout.write(event.assistantMessageEvent.delta);
  }

  if (event.type === "tool_execution_start") {
    console.log(`Tool started: ${event.toolName}`);
  }

  if (event.type === "tool_execution_end") {
    console.log(`Tool ended: ${event.toolName}, error=${event.isError}`);
  }
});

await session.prompt("Read PRD-42 and propose implementation risks.");

unsubscribe();
session.dispose();
