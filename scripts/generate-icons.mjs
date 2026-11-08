#!/usr/bin/env node
/**
 * Renders MUSICED's icons from the logo mark (src/app/icon.svg) with headless
 * Chromium (Playwright), so every size is crisp and consistent:
 *
 *   src/app/favicon.ico          16/32/48 px (PNG-in-ICO), legacy browsers
 *   src/app/apple-icon.png       180 px, iOS home screen (opaque background)
 *   public/icons/icon-192.png    PWA / Android
 *   public/icons/icon-512.png    PWA / Android
 *   public/icons/maskable-512.png  PWA maskable (safe-zone padding)
 *   src/app/opengraph-image.png  1200×630 link preview (also used by X/Twitter)
 *
 * Usage: node scripts/generate-icons.mjs   (needs `npx playwright install chromium` once)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const mark = readFileSync("src/app/icon.svg", "utf8").replace(/<!--[\s\S]*?-->/g, "");
const BG = "#151719";

/** Mark on a square canvas. `scale` = mark size relative to the canvas. */
function squareHtml(size, { background = "transparent", scale = 1 } = {}) {
  const inner = Math.round(size * scale);
  return `<!doctype html><html><body style="margin:0;width:${size}px;height:${size}px;background:${background};display:grid;place-items:center">
    <div style="width:${inner}px;height:${inner}px">${mark.replace("<svg ", `<svg width="${inner}" height="${inner}" `)}</div>
  </body></html>`;
}

function ogHtml() {
  const grooves = Array.from({ length: 22 }, (_, i) =>
    `<circle cx="300" cy="300" r="${40 + i * 12}" fill="none" stroke="${i === 7 ? "rgba(163,230,53,.55)" : "rgba(255,255,255,.06)"}" stroke-width="1.5"/>`,
  ).join("");
  return `<!doctype html><html><head><style>
    body{margin:0;width:1200px;height:630px;background:${BG};color:#f5f5f5;font-family:'Segoe UI',system-ui,-apple-system,Helvetica,Arial,sans-serif;overflow:hidden;position:relative}
    .groove{position:absolute;right:-260px;top:-120px;width:900px;height:900px}
    .content{position:absolute;left:88px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;width:720px}
    .brand{display:flex;align-items:center;gap:18px;font-size:44px;font-weight:700;letter-spacing:-1.5px}
    .brand b{color:#a3e635}
    h1{font-size:76px;line-height:1.02;letter-spacing:-3px;margin:40px 0 0;font-weight:700}
    .tag{margin-top:34px;font:600 22px ui-monospace,Consolas,monospace;letter-spacing:6px;color:#a3e635;text-transform:uppercase}
  </style></head><body>
    <svg class="groove" viewBox="0 0 600 600">${grooves}<circle cx="300" cy="300" r="26" fill="#202428"/><circle cx="300" cy="300" r="7" fill="#a3e635"/></svg>
    <div class="content">
      <div class="brand"><div style="width:64px;height:64px">${mark.replace("<svg ", '<svg width="64" height="64" ')}</div><span>musiced<b>.</b></span></div>
      <h1>The social diary for people who live in albums.</h1>
      <div class="tag">Discover. Listen. Rate. Repeat.</div>
    </div>
  </body></html>`;
}

/** Pack PNG buffers into a single .ico (PNG-compressed entries, supported since Vista). */
function pngsToIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const { size, data } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += data.length;
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function render(html, width, height) {
  await page.setViewportSize({ width, height });
  await page.setContent(html);
  return page.screenshot({ type: "png", omitBackground: true, clip: { x: 0, y: 0, width, height } });
}

mkdirSync("public/icons", { recursive: true });

const icoImages = [];
for (const size of [16, 32, 48]) icoImages.push({ size, data: await render(squareHtml(size), size, size) });
writeFileSync("src/app/favicon.ico", pngsToIco(icoImages));

writeFileSync("src/app/apple-icon.png", await render(squareHtml(180, { background: BG, scale: 0.78 }), 180, 180));
writeFileSync("public/icons/icon-192.png", await render(squareHtml(192), 192, 192));
writeFileSync("public/icons/icon-512.png", await render(squareHtml(512), 512, 512));
// Maskable: launchers may crop to a circle/squircle covering ~80% — keep the mark inside the safe zone.
writeFileSync("public/icons/maskable-512.png", await render(squareHtml(512, { background: BG, scale: 0.62 }), 512, 512));
writeFileSync("src/app/opengraph-image.png", await render(ogHtml(), 1200, 630));

await browser.close();
console.log("Icons written: favicon.ico, apple-icon.png, public/icons/*, opengraph-image.png");
