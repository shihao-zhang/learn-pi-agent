import { Type } from "typebox";
// Pi extension and SDK examples use the Pi-supported bare `typebox` specifier.
// In a standalone npm project, use the package name recommended by the Pi docs
// or your local bundler setup.
// Snapshot note: this file mirrors the Pi SDK shape checked against official docs
// on 2026-05-28. It is a reference file and is not type-checked by this repo.
import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  defineTool,
  ModelRegistry,
  SessionManager,
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

const authStorage = AuthStorage.create();
const modelRegistry = ModelRegistry.create(authStorage);

const resourceLoader = new DefaultResourceLoader({
  cwd: process.cwd(),
});
await resourceLoader.reload();

const { session } = await createAgentSession({
  cwd: process.cwd(),
  authStorage,
  modelRegistry,
  sessionManager: SessionManager.inMemory(),
  resourceLoader,
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
