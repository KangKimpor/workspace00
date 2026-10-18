import { readFile, writeFile, mkdir } from 'node:fs/promises';
import sharp from 'sharp';

// Web-only exports. Native branding remains paused with the desktop applications.
const master = await readFile('brand/svg/workspace-mark.svg', 'utf8');
const inner = `<g fill="none">${master.replace(/<svg[^>]*>|<\/svg>|<title>.*?<\/title>/g, '').trim()}</g>`;
const icon = rounded => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="${rounded ? 24 : 0}" fill="#353936"/><g color="#faf9f6" transform="translate(10 10) scale(.8)">${inner}</g></svg>`;
const rounded = icon(true), fullBleed = icon(false);
for (const directory of ['apps/web/public', 'brand/exports', 'packages/ui/src']) await mkdir(directory, { recursive: true });
for (const name of ['mark', 'mark-bold', 'mark-mono']) await writeFile(`brand/svg/${name}.svg`, master);
await writeFile('brand/svg/icon.svg', rounded);
await writeFile('brand/svg/icon-fullbleed.svg', fullBleed);
await writeFile('brand/svg/lockup.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 100"><g color="#353936">${inner}</g><text x="110" y="63" font-family="system-ui, sans-serif" font-size="40" font-weight="600" letter-spacing="-1" fill="#353936">Kimpor Workspace</text></svg>`);
const paths = [...master.matchAll(/<path d="([^"]+)"/g)].map(match => match[1]);
await writeFile('packages/ui/src/BrandMark.tsx', `// Generated from brand/svg/workspace-mark.svg by pnpm brand:build.\nconst strokes = ${JSON.stringify(paths, null, 2)};\nexport function BrandMark({ size = 24 }: { size?: number }) {\n  return <svg viewBox="0 0 100 100" width={size} height={size} fill="none" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">{strokes.map((d, index) => <path key={index} d={d}/>)}</g></svg>;\n}\n`);
await writeFile('apps/web/public/favicon.svg', master.replace('</svg>', '<style>svg{color:#353936}@media(prefers-color-scheme:dark){svg{color:#e9e9e5}}</style></svg>'));
async function png(svg, size, file) { await sharp(Buffer.from(svg)).resize(size, size).png().toFile(file); }
for (const [name, size] of [['apple-touch-icon', 180], ['icon-maskable', 512]]) await png(fullBleed, size, `apps/web/public/${name}.png`);
for (const size of [192, 512]) await png(rounded, size, `apps/web/public/icon-${size}.png`);
const solid = master.replaceAll('currentColor', '#353936');
await png(solid, 32, 'apps/web/public/favicon-32.png');
await png(rounded, 1024, 'brand/exports/icon-1024.png');
const images = [];
for (const size of [16, 32, 48]) images.push(await sharp(Buffer.from(solid)).resize(size, size).png().toBuffer());
const header = Buffer.alloc(6 + images.length * 16); header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
let offset = header.length;
images.forEach((data, index) => { const at = 6 + index * 16, size = [16, 32, 48][index]; header[at] = size; header[at + 1] = size; header.writeUInt16LE(1, at + 4); header.writeUInt16LE(32, at + 6); header.writeUInt32LE(data.length, at + 8); header.writeUInt32LE(offset, at + 12); offset += data.length; });
await writeFile('apps/web/public/favicon.ico', Buffer.concat([header, ...images]));
for (const [name, width, height] of [['og', 1200, 630], ['github-social', 1280, 640]]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#faf9f6"/><svg x="64" y="110" width="220" height="220" viewBox="0 0 100 100" color="#353936">${inner}</svg><text x="340" y="275" font-family="sans-serif" font-size="64" font-weight="600" fill="#292929">Kimpor Workspace</text><text x="345" y="340" font-family="sans-serif" font-size="28" fill="#646464">A quieter place for everything.</text></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(`brand/exports/${name}.png`);
}
await sharp('brand/exports/og.png').toFile('apps/web/public/og.png');
console.log('Workspace mark exported: vectors, React, favicons, Apple touch, PWA and social images.');
