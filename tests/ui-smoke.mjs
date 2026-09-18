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
const metrics = await evaluate(`(async()=>{ await document.fonts.ready; return { tabs:[...document.querySelectorAll('.tabs button')].map(x=>x.textContent), font:getComputedStyle(document.body).fontFamily, fontReady:document.fonts.check('16px Pretendard'), bodyFits:document.documentElement.scrollWidth<=innerWidth, pillars:document.querySelectorAll('.pillar').length, currentDaYun:document.querySelectorAll('.dayun.current').length, errors:[] }; })()`);
if (metrics.tabs.join('|') !== '만세력|자미두수' || !metrics.fontReady || !metrics.font.includes('Pretendard') || metrics.pillars !== 4 || metrics.currentDaYun !== 1) throw new Error(`UI metrics failed: ${JSON.stringify(metrics)}`);
await evaluate(`document.querySelectorAll('.tabs button')[1].click()`);
await wait(300);
const ziwei = await evaluate(`({ palaces:document.querySelectorAll('.palace-card').length, starGroups:document.querySelectorAll('.star-group').length, related:document.querySelectorAll('.palace-card.related').length, currentDecadal:document.querySelectorAll('.palace-card.current-decadal').length, relation:document.querySelector('.relation-detail')?.textContent, labels:document.body.innerText.includes('래인궁') })`);
if (ziwei.palaces !== 12 || ziwei.starGroups < 24 || ziwei.related !== 4 || ziwei.currentDecadal !== 1 || !ziwei.relation) throw new Error(`Ziwei metrics failed: ${JSON.stringify(ziwei)}`);

await mkdir('artifacts', { recursive: true });
const desktop = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
await writeFile('artifacts/ziwei-desktop.png', Buffer.from(desktop.result.data, 'base64'));
await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await evaluate(`location.hash=''; location.reload()`); await wait(2500);
const mobile = await evaluate(`({ bodyFits:document.documentElement.scrollWidth<=innerWidth, width:innerWidth, tabs:document.querySelectorAll('.tabs button').length })`);
if (!mobile.bodyFits || mobile.width !== 390 || mobile.tabs !== 2) throw new Error(`Mobile metrics failed: ${JSON.stringify(mobile)}`);
const mobileShot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
await writeFile('artifacts/mobile-verified.png', Buffer.from(mobileShot.result.data, 'base64'));
console.log(JSON.stringify({ metrics, ziwei, mobile }));
socket.close(); child.kill();
