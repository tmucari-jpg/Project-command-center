// Display available synthetic UI screenshot paths without requiring optional image libraries.
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
async function walk(directory) {
  const entries=await readdir(directory,{withFileTypes:true}).catch(()=>[]);
  const files=[];
  for(const entry of entries){const name=path.join(directory,entry.name);if(entry.isDirectory())files.push(...await walk(name));else if(entry.name.endsWith('.png'))files.push(name);}
  return files;
}
for(const file of (await walk('validation-browser-artifacts')).slice(0,8)){
  const info=await stat(file);
  console.log('PCC_UI_PREVIEW_FILE:'+file+':'+info.size);
}
