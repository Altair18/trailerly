import type { OutputSpecId } from "@/lib/specs/outputs";
import type { OutputStatus, PackStatus, RuleResultValue } from "@/types/db";

export interface PayableOutput {
  spec: OutputSpecId;
  status: OutputStatus;
  rules_status: RuleResultValue | null;
}

/**
 * Why this pack can't be paid for yet, or null when it can. Payment buys the full-size render of the drafts the
 * user has seen, so every draft must exist and none may break a store rule.
 */
export function checkoutProblem(status: PackStatus, outputs: PayableOutput[], specs: OutputSpecId[]): string | null {
  if (status !== "draft") return "This pack is already paid for.";
  const byId = new Map(outputs.map((o) => [o.spec, o]));
  if (specs.some((s) => byId.get(s)?.status !== "ready")) return "Wait for every draft to finish first.";
  if (specs.some((s) => byId.get(s)?.rules_status === "block")) return "A draft breaks an App Store rule. Fix it before paying.";
  return null;
}

/** Pack status once the final run ends: ready when every file rendered, failed when any is missing. */
export function finalStatus(specs: OutputSpecId[], rendered: OutputSpecId[]): PackStatus {
  return specs.every((s) => rendered.includes(s)) ? "ready" : "failed";
}

/** Stages of a paid pack the drafts page shows while the full-size files render. */
export const finalsBusy = (status: PackStatus) => status === "paid" || status === "rendering";
