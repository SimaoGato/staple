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

// Spike, e2e build only: render pages with PDFium.
export type PdfiumJobMessage = {
  type: 'pdfium';
  id: number;
  input: ArrayBuffer;
  index: number;
  dpi: number;
  all: boolean;
};
export type PdfiumResultMessage = {
  type: 'pdfium-result';
  id: number;
  pageCount: number;
  width: number;
  height: number;
  nonBlank: boolean;
  /** Load (fetch + compile + init) time, 0 when already loaded. */
  loadMs: number;
  openMs: number;
  /** Render + RGBA extraction per page (one entry, or all pages). */
  pageMs: number[];
};

export type WorkerIn = JobMessage | PdfiumJobMessage;
export type WorkerOut =
  | ProgressMessage
  | ResultMessage
  | CompressedMessage
  | ErrorMessage
  | PdfiumResultMessage;
