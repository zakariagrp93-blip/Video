// Renders the app logo (original mascot mark) to PNG icons. ICO is assembled by scripts/make-ico.py.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 64 64">
<rect x="0" y="0" width="64" height="64" rx="14" fill="#FFD60A"/>
<path d="M32 14c-11 0-17 10-17 20 0 9 7 16 17 16s17-7 17-16c0-10-6-20-17-20z" fill="#F7F7F9" stroke="#0B0B0D" stroke-width="3"/>
<path d="M32 14c0-4 1-6 0-8" stroke="#1E8F40" stroke-width="3" stroke-linecap="round"/>
<path d="M32 9c-3-4-7-4-8-2 2 2 5 3 8 2zM32 8c2-4 6-4 7-2-2 2-5 3-7 2z" fill="#32D74B" stroke="#0B0B0D" stroke-width="1.5"/>
<ellipse cx="26" cy="31" rx="3" ry="4.5" fill="#0B0B0D"/><ellipse cx="38" cy="31" rx="3" ry="4.5" fill="#0B0B0D"/>
<path d="M27 40q5 4 10 0" stroke="#0B0B0D" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>`;
fs.mkdirSync('assets', { recursive: true });
fs.writeFileSync('assets/icon.svg', svg);
const browser = await chromium.launch({ executablePath: process.env.FVS_BROWSER || undefined });
const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
await page.screenshot({ path: 'assets/icon.png', omitBackground: true, clip: { x: 0, y: 0, width: 512, height: 512 } });
await browser.close();
console.log('assets/icon.png written');
