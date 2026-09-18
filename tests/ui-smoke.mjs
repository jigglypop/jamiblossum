import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9339;
const child = spawn(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${port}`, '--user-data-dir=C:/Temp/jamiblossom-ui-smoke', 'http://127.0.0.1:5180/'], { stdio: 'ignore' });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let target;
for (let attempt = 0; attempt < 50; attempt++) {
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((item) => item.url.includes('127.0.0.1:5180')); if (target) break; } catch {}
  await wait(100);
}
if (!target) { child.kill(); throw new Error('Chrome DevTools target unavailable'); }

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let id = 0;
const pending = new Map();
socket.onmessage = ({ data }) => { const message = JSON.parse(data); if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); } };
const command = (method, params = {}) => new Promise((resolve) => { const messageId = ++id; pending.set(messageId, resolve); socket.send(JSON.stringify({ id: messageId, method, params })); });
const evaluate = async (expression) => (await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.result.value;

await command('Page.enable');
await command('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1200, deviceScaleFactor: 1, mobile: false });
await evaluate(`location.reload()`);
await wait(3000);
const metrics = await evaluate(`(async()=>{ await document.fonts.ready; return { tabs:[...document.querySelectorAll('.tabs button')].map(x=>x.textContent), font:getComputedStyle(document.body).fontFamily, fontReady:document.fonts.check('16px Pretendard'), bodyFits:document.documentElement.scrollWidth<=innerWidth, ganjiCells:document.querySelectorAll('.manse-table .ganji-large').length, currentDaYun:document.querySelectorAll('.dayun.current').length, engineInitializations:document.body.dataset.engineInitializations, errors:[] }; })()`);
if (metrics.tabs.join('|') !== '만세력|자미두수' || !metrics.fontReady || !metrics.font.includes('Pretendard') || metrics.ganjiCells !== 8 || metrics.currentDaYun !== 1 || metrics.engineInitializations !== '1') throw new Error(`UI metrics failed: ${JSON.stringify(metrics)}`);
const latencies = [];
for (const value of ['01:30','03:30','05:30','07:30','09:30']) {
  const before = await evaluate(`document.querySelector('.manse-table').textContent`);
  const started = Date.now();
  await evaluate(`(()=>{const input=document.querySelector('input[name=time]');input.value=${JSON.stringify(value)};input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  for (let attempt=0; attempt<100; attempt++) { if (await evaluate(`document.querySelector('.status').classList.contains('ready') && document.querySelector('.manse-table').textContent !== ${JSON.stringify(before)}`)) break; await wait(20); }
  latencies.push(Date.now()-started);
}
await evaluate(`document.querySelectorAll('.tabs button')[1].click()`);
await wait(300);
await wait(100);
const ziwei = await evaluate(`(()=>{const grid=document.querySelector('.palace-grid');const gr=grid.getBoundingClientRect();const cards=[...document.querySelectorAll('.palace-card.related')].map(x=>x.getBoundingClientRect());const circles=[...document.querySelectorAll('.relation-endpoint')].map(x=>({x:gr.left+Number(x.getAttribute('cx')),y:gr.top+Number(x.getAttribute('cy'))}));const snap=v=>[0,.5,1].some(a=>Math.abs(v-a)<=.02);const onBorders=circles.every(p=>cards.some(r=>{const nx=(p.x-r.left)/r.width,ny=(p.y-r.top)/r.height;return snap(nx)&&snap(ny)&&(Math.min(Math.abs(p.x-r.left),Math.abs(p.x-r.right),Math.abs(p.y-r.top),Math.abs(p.y-r.bottom))<=2)}));return { palaces:document.querySelectorAll('.palace-card').length, starGroups:document.querySelectorAll('.star-group').length, related:cards.length, currentDecadal:document.querySelectorAll('.palace-card.current-decadal').length, relation:document.querySelector('.relation-detail')?.textContent, labels:document.body.innerText.includes('래인궁'), polygon:document.querySelectorAll('.relation-lines polygon').length, opposite:document.querySelectorAll('.relation-lines line').length, endpoints:circles.length,onBorders,stroke:getComputedStyle(document.querySelector('.trine-line')).strokeWidth };})()`);
if (ziwei.palaces !== 12 || ziwei.starGroups < 24 || ziwei.related !== 4 || ziwei.currentDecadal !== 1 || !ziwei.relation || ziwei.polygon !== 1 || ziwei.opposite !== 1 || ziwei.endpoints !== 4 || !ziwei.onBorders || Number.parseFloat(ziwei.stroke) < 2) throw new Error(`Ziwei metrics failed: ${JSON.stringify(ziwei)}`);
const exportCheck = await evaluate(`(()=>{document.querySelectorAll('.export-actions button')[1].click();const q=document.querySelector('.export-dialog textarea:not(.export-preview)');q.value='현재 흐름을 근거와 함께 설명해 주세요.';q.dispatchEvent(new Event('input',{bubbles:true}));const text=document.querySelector('.export-preview').value;const result={open:document.querySelector('.export-dialog').open,length:text.length,palaces:(text.match(/^\\[[^\\]]+\\]/gm)||[]).length,hasSurrounded:text.includes('삼방사정 본궁'),hasFlows:text.includes('=== 운한 ==='),hasQuestion:text.includes(q.value),hasCorrection:text.includes('30분')};document.querySelector('.export-dialog').close();return result;})()`);
if (!exportCheck.open || exportCheck.length < 7000 || exportCheck.palaces < 12 || !exportCheck.hasSurrounded || !exportCheck.hasFlows || !exportCheck.hasQuestion || !exportCheck.hasCorrection) throw new Error(`Export failed: ${JSON.stringify(exportCheck)}`);

await mkdir('artifacts', { recursive: true });
const desktop = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
await writeFile('artifacts/ziwei-desktop.png', Buffer.from(desktop.result.data, 'base64'));
await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await evaluate(`location.hash=''; location.reload()`); await wait(2500);
const mobile = await evaluate(`({ bodyFits:document.documentElement.scrollWidth<=innerWidth, width:innerWidth, tabs:document.querySelectorAll('.tabs button').length })`);
if (!mobile.bodyFits || mobile.width !== 390 || mobile.tabs !== 2) throw new Error(`Mobile metrics failed: ${JSON.stringify(mobile)}`);
const mobileShot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
await writeFile('artifacts/mobile-verified.png', Buffer.from(mobileShot.result.data, 'base64'));
latencies.sort((a,b)=>a-b); const latency = { samples:latencies, median:latencies[Math.floor(latencies.length/2)], p95:latencies[Math.ceil(latencies.length*.95)-1] };
console.log(JSON.stringify({ metrics, ziwei, mobile, latency }));
socket.close(); child.kill();
