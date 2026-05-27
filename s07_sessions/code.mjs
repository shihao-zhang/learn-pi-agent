const entries = [
  { id: "root", parentId: null, text: "Start task" },
  { id: "a", parentId: "root", text: "Try direct implementation" },
  { id: "b", parentId: "a", text: "Tests fail" },
  { id: "c", parentId: "a", text: "Fork and simplify design" },
  { id: "d", parentId: "c", text: "Tests pass" },
];

function childrenOf(parentId) {
  return entries.filter((entry) => entry.parentId === parentId);
}

function printTree(parentId = null, depth = 0) {
  for (const entry of childrenOf(parentId)) {
    console.log(`${"  ".repeat(depth)}- ${entry.id}: ${entry.text}`);
    printTree(entry.id, depth + 1);
  }
}

printTree();
