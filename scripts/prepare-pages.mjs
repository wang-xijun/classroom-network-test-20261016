import {mkdir,copyFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
await mkdir(resolve(root,'docs'),{recursive:true});
for (const name of await readdir(resolve(root,'public'))) await copyFile(resolve(root,'public',name),resolve(root,'docs',name));
console.log('GitHub Pages static files updated from public/');
