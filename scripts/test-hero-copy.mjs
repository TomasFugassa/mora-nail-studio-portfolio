import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
process.env.BERE_DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'mora-copy-'));
process.env.BERE_DEMO_MODE = 'true';
process.env.BERE_ADMIN_PASSWORD = randomUUID();
const { getContent, saveContent, db } = await import('../src/server/store.mjs');
try {
    const initial = await getContent();
    const row = async () => await (await db()).prepare('SELECT version,payload FROM content WHERE id=1').get();
    assert.equal(Object.hasOwn(JSON.parse((await row()).payload).copy, 'hero2Line1'), false);
    assert.equal((await getContent()).version, initial.version, 'Leer los mensajes nuevos no modifica los datos existentes');
    assert.equal((await getContent()).copy.hero2Line1, 'Un color');
    const description = 'Un diseño con color y pequeños detalles para elegir con tranquilidad. '.repeat(4).trim();
    await saveContent({ ...initial, copy: { ...initial.copy, hero2Line1: 'Tu color', hero2Description: description, hero3Accent: 'tu estilo' } });
    const saved = await getContent();
    assert.equal(saved.copy.hero2Line1, 'Tu color');
    assert.equal(saved.copy.hero2Description, description);
    assert.equal(saved.copy.hero3Accent, 'tu estilo');
    const legacy = structuredClone(saved);
    for (const key of Object.keys(legacy.copy))
        if (/^hero[23]/.test(key))
            delete legacy.copy[key];
    await saveContent(legacy);
    const after = await getContent();
    assert.equal(after.copy.hero2Description, description, 'Un editor anterior conserva los textos nuevos');
    assert.equal(after.copy.hero3Accent, 'tu estilo');
    assert.deepEqual(after.collection, initial.collection);
    assert.deepEqual(after.booking, initial.booking);
    await assert.rejects(async () => await saveContent(saved), { status: 409 }, 'Se mantiene el control de versiones');
    console.log('PASS: mensajes editables, descripciones largas, datos antiguos compatibles y control de versiones sin modificar galería ni agenda.');
}
finally {
    await (await db()).close();
}
