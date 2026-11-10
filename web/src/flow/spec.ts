/** What a tool accepts. Empty `accept` and `mimes` mean any file. */
export type ToolSpec = {
  accept: string[]; // extensions with dot, e.g. '.pdf'
  mimes: string[];
  multiple: boolean;
};

/** True when the extension (case-insensitive) or the MIME type matches; an empty MIME relies on the extension. */
export function isAccepted(
  file: { name: string; type: string },
  spec: ToolSpec,
): boolean {
  if (spec.accept.length === 0 && spec.mimes.length === 0) return true;
  const name = file.name.toLowerCase();
  return (
    spec.accept.some((ext) => name.endsWith(ext.toLowerCase())) ||
    spec.mimes.includes(file.type.toLowerCase())
  );
}
