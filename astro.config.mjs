import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
const allowedDomains = [
  { hostname: '127.0.0.1', protocol: 'http' },
  { hostname: 'localhost', protocol: 'http' },
];
if (process.env.MORA_SITE_ORIGIN) {
  const origin = new URL(process.env.MORA_SITE_ORIGIN);
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
  vite: { build: { assetsInlineLimit: 0 } },
  devToolbar: { enabled: false },
  server: { host: '127.0.0.1', port: 4324 },
});

