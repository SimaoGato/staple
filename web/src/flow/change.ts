export type SizeChange = {
  kind: 'smaller' | 'larger' | 'same';
  percent: number;
};

/** Size change vs the input, whole percent; null when there is no usable input size. */
export function sizeChange(
  inputSize: number,
  outputSize: number,
): SizeChange | null {
  if (!Number.isFinite(inputSize) || inputSize <= 0) return null;
  const percent = Math.round(
    (Math.abs(outputSize - inputSize) / inputSize) * 100,
  );
  if (percent === 0) return { kind: 'same', percent };
  return { kind: outputSize < inputSize ? 'smaller' : 'larger', percent };
}
