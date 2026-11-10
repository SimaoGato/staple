export const TOOLS = [
  { id: 'compress', path: '/compress' },
  { id: 'merge', path: '/merge' },
  { id: 'split', path: '/split' },
  { id: 'convert', path: '/convert' },
  { id: 'resize', path: '/resize' },
] as const;

export type ToolId = (typeof TOOLS)[number]['id'];
