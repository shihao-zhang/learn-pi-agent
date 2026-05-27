import { Type } from "typebox";
import {
  AuthStorage,
  createAgentSession,
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

const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  authStorage,
  modelRegistry,
  customTools: [lookupProductSpec],
});

await session.sendUserMessage("Read PRD-42 and propose implementation risks.");
