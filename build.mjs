import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { home, cabinet, favicon } from './src/pages.mjs';

const from = name => new URL(name,import.meta.url);
const manifest = JSON.parse(await readFile(from('./.openai/hosting.json'),'utf8'));
const content = await readFile(from('./src/content.mjs'),'utf8');
const api = await readFile(from('./src/api.mjs'),'utf8');
const staticAssets = {
  '/': ['text/html; charset=utf-8',home],
  '/cabinet': ['text/html; charset=utf-8',cabinet],
  '/site.css': ['text/css; charset=utf-8',await readFile(from('./src/site.css'),'utf8')],
  '/site.js': ['text/javascript; charset=utf-8',await readFile(from('./src/site.js'),'utf8')],
  '/favicon.svg': ['image/svg+xml',favicon],
};
const hero = (await readFile(from('./src/hero.jpg'))).toString('base64');
const source = content.replaceAll(/^export /gm,'')+
  api.replace(/^import[^\n]+\n/m,'').replaceAll(/^export /gm,'')+
  'const staticAssets='+JSON.stringify(staticAssets)+';\n'+
  'const hero=Uint8Array.from(atob('+JSON.stringify(hero)+'),c=>c.charCodeAt(0));\n'+
  await readFile(from('./src/worker.mjs'),'utf8');
await mkdir(from('./dist/server/'),{recursive:true});
await mkdir(from('./dist/.openai/'),{recursive:true});
await writeFile(from('./dist/server/index.js'),source);
await writeFile(from('./dist/.openai/hosting.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Worker built. Hero JPEG:',Math.ceil(hero.length*3/4/1024),'KiB.');
