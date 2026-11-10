import './style.css';
import { mount } from './router';
import { initTheme } from './theme';
import { runCompress, runDemo } from './worker/client';

// Test hook until real tools land (EPIC-03); only in the e2e build (`vite build --mode e2e`).
declare global {
  interface Window {
    staple: { runDemo: typeof runDemo; runCompress: typeof runCompress };
  }
}
if (import.meta.env.MODE === 'e2e') window.staple = { runDemo, runCompress };

initTheme();
mount(document.getElementById('app')!);
