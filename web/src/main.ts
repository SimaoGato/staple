import './style.css';
import { mount } from './router';
import { initTheme } from './theme';
import { runCompress, runDemo, runPdfium } from './worker/client';

// Test hook until real tools land (EPIC-03); only in the e2e build (`vite build --mode e2e`).
declare global {
  interface Window {
    staple: {
      runDemo: typeof runDemo;
      runCompress: typeof runCompress;
      pdfiumRenderPage: typeof runPdfium;
    };
  }
}
if (import.meta.env.MODE === 'e2e')
  window.staple = {
    runDemo,
    runCompress,
    pdfiumRenderPage: runPdfium,
  };

initTheme();
mount(document.getElementById('app')!);
