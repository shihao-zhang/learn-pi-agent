import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Teaching-only minimal guardrail.
// This is not a production shell sandbox or complete permission system.
// Keep it conservative because real Pi can load project extensions.
export default function protectDangerous(pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return;

    const command = String(event.input.command ?? "");
    const dangerous = /\brm\s+-rf\b|\bsudo\b|>\s*\.env\b/.test(command);
    if (!dangerous) return;

    if (!ctx.ui?.confirm) {
      return {
        block: true,
        reason: "Blocked dangerous command; confirmation UI is unavailable",
      };
    }

    const ok = await ctx.ui.confirm(
      "Dangerous command",
      `Teaching sample only. This extension is not a shell sandbox.\n\nAllow this command?\n\n${command}`,
    );

    if (!ok) {
      return { block: true, reason: "Blocked by protect-dangerous extension" };
    }
  });
}
