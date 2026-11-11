/** Human-readable size, e.g. 1536 -> "1.5 KB". */
export function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let i = 0;
  // Roll over when one-decimal rounding would print "1024.0".
  while (
    (n >= 1024 || (i > 0 && n.toFixed(1) === '1024.0')) &&
    i < units.length - 1
  ) {
    n /= 1024;
    i++;
  }
  return `${i === 0 ? n : n.toFixed(1)} ${units[i]}`;
}
