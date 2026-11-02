import sharp from 'sharp';
import {readFileSync} from 'node:fs';
const icon=readFileSync('public/favicon.svg');
for(const size of [192,512])await sharp(icon).resize(size,size).png().toFile('public/pwa/mora-'+size+'.png');
const maskable=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#782f3e"/><path d="M17 43V25h6v3c4-5 10-5 14 0 6-6 13-3 13 5v10h-6V33c0-5-7-5-7 0v10h-6V33c0-5-8-5-8 0v10z" fill="#f6f1e9"/></svg>');
await sharp(maskable).resize(512,512).png().toFile('public/pwa/mora-maskable-512.png');
