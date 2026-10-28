// Test pages contain synthetic users/data only. Small previews allow visual CI review.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from '../application/node_modules/sharp/lib/index.js';
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    const name = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(name));
    else if (entry.name.endsWith('.png')) files.push(name);
  }
  return files;
}
for (const file of (await walk('validation-browser-artifacts')).slice(0, 4)) {
  const bytes = await sharp(await readFile(file)).resize({ width: 700, height: 1400, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 65 }).toBuffer();
  console.log(`PCC_UI_PREVIEW:${path.basename(file)}:${bytes.toString('base64')}`);
}
