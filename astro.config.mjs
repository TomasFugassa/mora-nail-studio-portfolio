import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import { networkInterfaces } from 'node:os';
const allowedDomains = [
  { hostname: '127.0.0.1', protocol: 'http' },
  { hostname: 'localhost', protocol: 'http' },
];
if(process.env.MORA_LAN==='1'){
  const port=process.env.MORA_LAN_PORT||'4324';
  const addresses=Object.values(networkInterfaces()).flat().filter(address=>address&&!address.internal&&address.family==='IPv4'&&/^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(address.address));
  for(const address of addresses)allowedDomains.push({hostname:address.address,protocol:'http',port});
}
if (process.env.BERE_SITE_ORIGIN) {
  const origin = new URL(process.env.BERE_SITE_ORIGIN);
  allowedDomains.push({
    hostname: origin.hostname,
    protocol: origin.protocol.slice(0, -1),
    port: origin.port,
  });
}
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone', bodySizeLimit: 7000000 }),
  security: { allowedDomains },
  vite: { cacheDir:process.env.MORA_LAN==='1'?'node_modules/.vite-mora-lan':'node_modules/.vite', build: { assetsInlineLimit: 0 } },
  devToolbar: { enabled: false },
  server: { host: '127.0.0.1', port: 4324 },
});

