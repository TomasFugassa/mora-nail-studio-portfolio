import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
process.env.MORA_DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'mora-content-'));
process.env.MORA_DEMO_MODE = 'true';
process.env.MORA_ADMIN_PASSWORD = randomUUID();
const { getContent, saveContent, db } = await import('../src/server/store.mjs');
let content = getContent();
content.studio.intro = 'Prueba de contenido editable.';
content.studio.services[0].tags.push('Prueba editable');
content.collection.photos.push({
  ...content.collection.photos[0],
  id: '11',
  title: 'Referencia temporal',
});
content = saveContent(content);
assert.equal(getContent().studio.intro, 'Prueba de contenido editable.');
assert.equal(getContent().collection.photos.length, 11);
content.collection.photos[0].image = '/src/assets/imagen-inexistente.png';
assert.throws(() => saveContent(content), { status: 400 });
assert.throws(() => saveContent(null), { status: 400 });
db().close();
console.log('PASS: contenido editable persistido e imágenes inexistentes rechazadas.');
