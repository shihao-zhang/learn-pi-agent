const DEFAULT_MODEL = {
  provider: "anthropic",
  modelId: "claude-sonnet-4-6",
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function shortText(content) {
  if (typeof content === "string") return content;
  return JSON.stringify(content);
}

class SessionManager {
  constructor({ cwd = "/demo/project", id = "session_demo", parentSession = null } = {}) {
    this.header = {
      type: "session",
      version: 3,
      id,
      timestamp: "2026-05-28T00:00:00.000Z",
      cwd,
      ...(parentSession ? { parentSession } : {}),
    };
    this.entries = [];
    this.leafId = null;
    this.nextNumber = 1;
  }

  static fromJSONL(text) {
    const lines = text.trim().split("\n").filter(Boolean);
    const header = JSON.parse(lines[0]);
    const manager = new SessionManager({
      cwd: header.cwd,
      id: header.id,
      parentSession: header.parentSession ?? null,
    });

    manager.header = header;
    manager.entries = lines.slice(1).map((line) => JSON.parse(line));
    manager.leafId = manager.entries.at(-1)?.id ?? null;
    manager.nextNumber = manager.entries.length + 1;
    return manager;
  }

  appendMessage(role, content, extra = {}) {
    return this.appendEntry({
      type: "message",
      message: {
        role,
        content,
        timestamp: this.nextTimestamp(),
        ...extra,
      },
    });
  }

  appendModelChange(provider, modelId) {
    return this.appendEntry({
      type: "model_change",
      provider,
      modelId,
    });
  }

  appendBranchSummary(fromId, summary) {
    return this.appendEntry({
      type: "branch_summary",
      fromId,
      summary,
    });
  }

  appendEntry(partial) {
    const entry = {
      ...partial,
      id: this.nextId(),
      parentId: this.leafId,
      timestamp: this.nextTimestamp(),
    };
    this.entries.push(entry);
    this.leafId = entry.id;
    return entry.id;
  }

  branch(entryId) {
    if (entryId !== null && !this.getEntry(entryId)) {
      throw new Error(`Cannot branch: unknown entry ${entryId}`);
    }
    this.leafId = entryId;
  }

  cloneActiveBranch({ id = "session_clone" } = {}) {
    const branch = this.getBranch();
    const cloned = new SessionManager({
      cwd: this.header.cwd,
      id,
      parentSession: `${this.header.id}.jsonl`,
    });
    const idMap = new Map([[null, null]]);

    for (const entry of branch) {
      const newEntry = clone(entry);
      newEntry.id = cloned.nextId();
      newEntry.parentId = idMap.get(entry.parentId) ?? null;
      newEntry.timestamp = cloned.nextTimestamp();
      idMap.set(entry.id, newEntry.id);
      cloned.entries.push(newEntry);
      cloned.leafId = newEntry.id;
    }

    return cloned;
  }

  buildContext(fromId = this.leafId) {
    const branch = this.getBranch(fromId);
    let model = { ...DEFAULT_MODEL };
    const messages = [];

    for (const entry of branch) {
      if (entry.type === "model_change") {
        model = {
          provider: entry.provider,
          modelId: entry.modelId,
        };
      }

      if (entry.type === "branch_summary") {
        messages.push({
          role: "branchSummary",
          content: `Left branch ${entry.fromId}: ${entry.summary}`,
        });
      }

      if (entry.type === "message") {
        messages.push({
          role: entry.message.role,
          content: entry.message.content,
        });
      }
    }

    return {
      leafId: fromId,
      model,
      messages,
    };
  }

  getBranch(fromId = this.leafId) {
    const byId = new Map(this.entries.map((entry) => [entry.id, entry]));
    const branch = [];
    let currentId = fromId;

    while (currentId) {
      const entry = byId.get(currentId);
      if (!entry) throw new Error(`Broken session tree: missing ${currentId}`);
      branch.push(entry);
      currentId = entry.parentId;
    }

    return branch.reverse();
  }

  getEntry(id) {
    return this.entries.find((entry) => entry.id === id);
  }

  getChildren(parentId) {
    return this.entries.filter((entry) => entry.parentId === parentId);
  }

  printTree(parentId = null, depth = 0) {
    for (const entry of this.getChildren(parentId)) {
      const active = entry.id === this.leafId ? " <- leaf" : "";
      console.log(`${"  ".repeat(depth)}- ${entry.id} ${this.entryLabel(entry)}${active}`);
      this.printTree(entry.id, depth + 1);
    }
  }

  printContext() {
    const context = this.buildContext();
    console.log(`leaf: ${context.leafId}`);
    console.log(`model: ${context.model.provider}/${context.model.modelId}`);
    for (const message of context.messages) {
      console.log(`${message.role}: ${shortText(message.content)}`);
    }
  }

  toJSONL() {
    return [this.header, ...this.entries].map((entry) => JSON.stringify(entry)).join("\n");
  }

  entryLabel(entry) {
    if (entry.type === "message") {
      return `${entry.message.role}: ${shortText(entry.message.content)}`;
    }
    if (entry.type === "model_change") {
      return `model_change: ${entry.provider}/${entry.modelId}`;
    }
    if (entry.type === "branch_summary") {
      return `branch_summary from ${entry.fromId}`;
    }
    return entry.type;
  }

  nextId() {
    return `e${String(this.nextNumber++).padStart(3, "0")}`;
  }

  nextTimestamp() {
    const millis = Date.UTC(2026, 4, 28, 0, 0, this.nextNumber);
    return new Date(millis).toISOString();
  }
}

const session = new SessionManager();

const root = session.appendMessage("user", "请把支付模块重构得更清楚。");
session.appendMessage("assistant", "我先走方案 A：直接拆分 service。");
const failedLeaf = session.appendMessage("assistant", "方案 A 跑通一半，但测试暴露边界条件问题。");

session.branch(root);
session.appendBranchSummary(failedLeaf, "方案 A 修改过多，留下的有用信息是边界条件需要先建测试。");
session.appendModelChange("openai", "gpt-5-codex");
session.appendMessage("user", "改走方案 B：先补测试，再做小步重构。");
session.appendMessage("assistant", "方案 B 更稳：先固定行为，再移动实现。");

console.log("== session tree ==");
session.printTree();

console.log("\n== reconstructed context for active leaf ==");
session.printContext();

console.log("\n== cloned active branch tree ==");
const cloned = session.cloneActiveBranch({ id: "session_clone_b" });
cloned.printTree();

console.log("\n== JSONL ==");
console.log(session.toJSONL());

console.log("\n== resume from JSONL ==");
const resumed = SessionManager.fromJSONL(session.toJSONL());
resumed.printContext();
