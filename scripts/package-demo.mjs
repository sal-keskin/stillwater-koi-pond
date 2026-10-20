import { readFile, writeFile } from 'node:fs/promises';

const directory = new URL('../dist/', import.meta.url);
let html = await readFile(new URL('index.html', directory), 'utf8');
for (const match of html.matchAll(/<script type="module" crossorigin src="([^"]+)"><\/script>/g)) {
  const source = await readFile(new URL(match[1].replace(/^\//, ''), directory), 'utf8');
  html = html.replace(match[0], () => `<script type="module">${source.replace(/<\/script/gi, '<\\/script')}</script>`);
}
for (const match of html.matchAll(/<link rel="stylesheet" crossorigin href="([^"]+)">/g)) {
  const source = await readFile(new URL(match[1].replace(/^\//, ''), directory), 'utf8');
  html = html.replace(match[0], () => `<style>${source}</style>`);
}
const favicon = await readFile(new URL('favicon.svg', directory), 'utf8');
html = html.replace('href="/favicon.svg"', `href="data:image/svg+xml,${encodeURIComponent(favicon)}"`);
await writeFile(new URL('standalone.html', directory), html);
console.log('Created dist/standalone.html — opens directly, no server required.');
