import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
process.env.BERE_DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'bere-content-'));
process.env.BERE_DEMO_MODE = 'true';
process.env.BERE_ADMIN_PASSWORD = randomUUID();
const { getContent, saveContent, db } = await import('../src/server/store.mjs');
let content = await getContent();
content.studio.intro = 'Prueba de contenido editable.';
content.studio.services[0].tags.push('Prueba editable');
content.collection.photos.push({
    ...content.collection.photos[0],
    id: '11',
    title: 'Referencia temporal',
});
content = await saveContent(content);
assert.equal((await getContent()).studio.intro, 'Prueba de contenido editable.');
assert.equal((await getContent()).collection.photos.length, 11);
content.collection.photos[0].image = '/src/assets/imagen-inexistente.png';
await assert.rejects(async () => await saveContent(content), { status: 400 });
await assert.rejects(async () => await saveContent(null), { status: 400 });
await (await db()).close();
console.log('PASS: contenido editable persistido e imágenes inexistentes rechazadas.');
