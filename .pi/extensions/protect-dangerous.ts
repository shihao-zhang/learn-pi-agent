import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function protectDangerous(pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return;

    const command = String(event.input.command ?? "");
    const dangerous = /\brm\s+-rf\b|\bsudo\b|>\s*\.env\b/.test(command);
    if (!dangerous) return;

    const ok = await ctx.ui.confirm(
      "Dangerous command",
      `Allow this command?\n\n${command}`,
    );

    if (!ok) {
      return { block: true, reason: "Blocked by protect-dangerous extension" };
    }
  });
}
