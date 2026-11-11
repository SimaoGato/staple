/** Overall batch progress (0-100) while job `i` of `n` is at `p` percent. */
export const overall = (i: number, n: number, p: number): number =>
  Math.floor((i * 100 + p) / n);

/** Progress never goes backwards. */
export const monotonic = (prev: number, next: number): number =>
  Math.max(prev, next);

/** A finished job counts as fully done, so a job without progress still advances the bar. */
export const finished = (i: number, n: number): number =>
  Math.floor(((i + 1) * 100) / n);
