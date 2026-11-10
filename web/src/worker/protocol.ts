export type ErrorCode =
  | 'empty_input'
  | 'too_large'
  | 'internal'
  | 'not_pdf'
  | 'truncated'
  | 'parse'
  | 'image';

export const ERROR_CODES: readonly ErrorCode[] = [
  'empty_input',
  'too_large',
  'internal',
  'not_pdf',
  'truncated',
  'parse',
  'image',
];

export type JobMessage = {
  type: 'job';
  id: number;
  op: 'demo' | 'compress';
  input: ArrayBuffer;
};

export type ProgressMessage = {
  type: 'progress';
  id: number;
  percent: number;
};
export type ResultMessage = {
  type: 'result';
  id: number;
  byteCount: number;
  checksum: number;
};
export type CompressedMessage = {
  type: 'compressed';
  id: number;
  output: ArrayBuffer;
};
export type ErrorMessage = {
  type: 'error';
  id: number;
  code: ErrorCode;
  message: string;
};

export type WorkerIn = JobMessage;
export type WorkerOut =
  ProgressMessage | ResultMessage | CompressedMessage | ErrorMessage;
