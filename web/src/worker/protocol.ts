export type ErrorCode = 'empty_input' | 'too_large' | 'internal';

export const ERROR_CODES: readonly ErrorCode[] = [
  'empty_input',
  'too_large',
  'internal',
];

export type JobMessage = {
  type: 'job';
  id: number;
  op: 'demo';
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
export type ErrorMessage = {
  type: 'error';
  id: number;
  code: ErrorCode;
  message: string;
};

export type WorkerIn = JobMessage;
export type WorkerOut = ProgressMessage | ResultMessage | ErrorMessage;
