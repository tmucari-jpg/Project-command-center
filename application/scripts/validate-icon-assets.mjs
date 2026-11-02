import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PNG } from 'pngjs';
import sharp from 'sharp';
const root = process.cwd();
const official = fs.readFileSync(path.join(root, 'public/brand/pcc-logo-official.png'));
if (crypto.createHash('sha256').update(official).digest('hex') !== 'ea2b23e35befdb4fc2620518ed8bb9e63f16e0a0268c40970d6e22881732433a') throw new Error('Official PCC logo changed.');
for (const [file, size, width] of [['icon-192.png',192,168],['icon-512.png',512,448],['icon-maskable-512.png',512,360],['apple-touch-icon.png',192,168]]) {
  const bytes = fs.readFileSync(path.join(root, 'public/icons', file));
  const png = PNG.sync.read(bytes, { checkCRC: true });
  if (png.width !== size || png.height !== size) throw new Error(`Wrong PNG dimensions: ${file}`);
  const image = await sharp(official).resize({width}).png().toBuffer();
  const expected = await sharp({ create: {width:size,height:size,channels:4,background:'#f8f6f0'} }).composite([{ input:image,gravity:'centre' }]).raw().toBuffer();
  if (!Buffer.from(png.data).equals(expected)) throw new Error(`PNG is not derived from the official logo: ${file}`);
}
for (const file of ['pcc-app-icon-v2.svg','pcc-app-icon-maskable-v2.svg']) {
  if (!fs.readFileSync(path.join(root,'public/icons',file),'utf8').includes(official.toString('base64'))) throw new Error('SVG official logo mismatch');
}
const android = fs.readFileSync(path.join(root,'../android-apk/app/src/main/res/drawable/pcc_icon.png'));
PNG.sync.read(android, { checkCRC: true });
if (!android.equals(fs.readFileSync(path.join(root,'public/icons/icon-maskable-512.png')))) throw new Error('Android icon mismatch');
console.log('PCC icon assets: OK (CRC, full decode, dimensions, official source, Android parity).');
