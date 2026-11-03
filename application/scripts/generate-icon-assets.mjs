import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
const root = process.cwd();
const logo = fs.readFileSync(path.join(root, 'public/brand/pcc-logo-official.png'));
const b64 = logo.toString('base64');
fs.writeFileSync(path.join(root, 'public/brand/pcc-logo-transparent.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 550 182"><image width="550" height="182" href="data:image/png;base64,${b64}"/></svg>`);
for (const [name, width] of [['pcc-app-icon-v2.svg', 448], ['pcc-app-icon-maskable-v2.svg', 360]]) {
  const height = width * 182 / 550;
  fs.writeFileSync(path.join(root, 'public/icons', name), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#f8f6f0"/><image x="${(512-width)/2}" y="${(512-height)/2}" width="${width}" height="${height}" href="data:image/png;base64,${b64}"/></svg>`);
}
for (const [name, size, width] of [['icon-192.png',192,168], ['icon-512.png',512,448], ['icon-maskable-512.png',512,360], ['apple-touch-icon.png',192,168]]) {
  const image = await sharp(logo).resize({ width }).png().toBuffer();
  const output = await sharp({ create: { width: size, height: size, channels: 4, background: '#f8f6f0' } }).composite([{ input: image, gravity: 'centre' }]).png().toBuffer();
  fs.writeFileSync(path.join(root, 'public/icons', name), output);
}
// Android adaptive/round icons use the safe-zone version of exactly the same official asset.
fs.copyFileSync(path.join(root, 'public/icons/icon-maskable-512.png'), path.join(root, '../android-apk/app/src/main/res/drawable/pcc_icon.png'));
console.log('PCC: official logo scaled proportionally; PNG and SVG assets regenerated.');
