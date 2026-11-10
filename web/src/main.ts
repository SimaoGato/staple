import './style.css';
import { mount } from './router';
import { runDemo } from './worker/client';

// Test hook until real tools land (EPIC-03); no UI uses it.
declare global {
  interface Window {
    staple: { runDemo: typeof runDemo };
  }
}
window.staple = { runDemo };

mount(document.getElementById('app')!);
