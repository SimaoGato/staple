import './style.css';
import { mount } from './router';
import { runDemo } from './worker/client';

// Test hook until real tools land (EPIC-03); only in the e2e build (`vite build --mode e2e`).
declare global {
  interface Window {
    staple: { runDemo: typeof runDemo };
  }
}
if (import.meta.env.MODE === 'e2e') window.staple = { runDemo };

mount(document.getElementById('app')!);
