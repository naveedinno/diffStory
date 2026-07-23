#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const [iconsetPath, outputPath] = process.argv.slice(2);

if (!iconsetPath || !outputPath) {
  console.error('Usage: node scripts/build-icns.mjs <iconset-directory> <output.icns>');
  process.exit(1);
}

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const iconEntries = [
  ['ic11', 'icon_16x16@2x.png', 32],
  ['ic12', 'icon_32x32@2x.png', 64],
  ['ic07', 'icon_128x128.png', 128],
  ['ic13', 'icon_128x128@2x.png', 256],
  ['ic08', 'icon_256x256.png', 256],
  ['ic14', 'icon_256x256@2x.png', 512],
  ['ic09', 'icon_512x512.png', 512],
  ['ic10', 'icon_512x512@2x.png', 1024],
];

function pngPayload(fileName, expectedSize) {
  const filePath = path.join(iconsetPath, fileName);
  const payload = fs.readFileSync(filePath);
  if (
    payload.length < 24
    || !payload.subarray(0, pngSignature.length).equals(pngSignature)
    || payload.readUInt32BE(16) !== expectedSize
    || payload.readUInt32BE(20) !== expectedSize
  ) {
    throw new Error(`${fileName} must be a ${expectedSize}x${expectedSize} PNG`);
  }
  return payload;
}

const entries = iconEntries.map(([type, fileName, expectedSize]) => {
  const payload = pngPayload(fileName, expectedSize);
  const header = Buffer.alloc(8);
  header.write(type, 0, 'ascii');
  header.writeUInt32BE(payload.length + header.length, 4);
  return Buffer.concat([header, payload]);
});

const fileLength = 8 + entries.reduce((sum, entry) => sum + entry.length, 0);
const fileHeader = Buffer.alloc(8);
fileHeader.write('icns', 0, 'ascii');
fileHeader.writeUInt32BE(fileLength, 4);
fs.writeFileSync(outputPath, Buffer.concat([fileHeader, ...entries]));
