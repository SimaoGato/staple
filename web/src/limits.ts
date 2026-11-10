export type LimitResult = { ok: true } | { ok: false; reason: string };

/** The only place file size and count are checked. v1 has no caps (PRD D-7); Phase 2 adds them here. */
/* eslint-disable @typescript-eslint/no-unused-vars -- v1 ignores the arguments; Phase 2 caps use them */
export function checkAdd(
  _existing: readonly { size: number }[],
  _incoming: readonly { size: number }[],
): LimitResult {
  return { ok: true };
}
