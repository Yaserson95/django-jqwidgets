// Временный: выполняется ли inline-лоадер и внедряет ли он скрипты в jsdom
import { JSDOM, VirtualConsole } from 'jsdom';

const vc = new VirtualConsole();
vc.forwardTo(console);
const dom = await JSDOM.fromURL('http://127.0.0.1:8765/custom-options/', {
  pretendToBeVisual: true,
  runScripts: 'dangerously',
  resources: 'usable',
  virtualConsole: vc,
  beforeParse(w) {
    const rf = globalThis.fetch;
    w.fetch = (i, n) => rf(new URL(String(i), w.location.href), n);
    if (!w.matchMedia) w.matchMedia = () => ({ matches: false, media: '', addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } });
  },
});
const w = dom.window;
await new Promise((r) => setTimeout(r, 500));
console.log('LOADED flag:', w.__JQXWIDGETS_LOADED__);
console.log('script tags:', [...w.document.querySelectorAll('script')].map((s) => s.src || 'inline').join(' | '));
await new Promise((r) => setTimeout(r, 4000));
console.log('--- через 4.5с ---');
console.log('script tags:', [...w.document.querySelectorAll('script')].map((s) => s.src || 'inline').join(' | '));
console.log('Zone:', typeof w.Zone, '| jqx:', typeof w.jqx, '| jqx-grid определён:', !!w.customElements.get('jqx-grid'));
process.exit(0);
