import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

process.env.MORA_DATA_DIR=mkdtempSync(path.join(os.tmpdir(),'mora-copy-'));
process.env.MORA_DEMO_MODE='true';
process.env.MORA_ADMIN_PASSWORD=randomUUID();
const {getContent,saveContent,db}=await import('../src/server/store.mjs');
try{
  const initial=getContent();
  const row=()=>db().prepare('SELECT version,payload FROM content WHERE id=1').get();
  assert.equal(Object.hasOwn(JSON.parse(row().payload).copy,'hero2Line1'),false);
  assert.equal(getContent().version,initial.version,'Leer los mensajes nuevos no modifica los datos existentes');
  assert.equal(getContent().copy.hero2Line1,'Un color');
  const description='Un diseño con color y pequeños detalles para elegir con tranquilidad. '.repeat(4).trim();
  saveContent({...initial,copy:{...initial.copy,hero2Line1:'Tu color',hero2Description:description,hero3Accent:'tu estilo'}});
  const saved=getContent();
  assert.equal(saved.copy.hero2Line1,'Tu color');
  assert.equal(saved.copy.hero2Description,description);
  assert.equal(saved.copy.hero3Accent,'tu estilo');
  const legacy=structuredClone(saved);
  for(const key of Object.keys(legacy.copy))if(/^hero[23]/.test(key))delete legacy.copy[key];
  saveContent(legacy);
  const after=getContent();
  assert.equal(after.copy.hero2Description,description,'Un editor anterior conserva los textos nuevos');
  assert.equal(after.copy.hero3Accent,'tu estilo');
  assert.deepEqual(after.collection,initial.collection);
  assert.deepEqual(after.booking,initial.booking);
  assert.throws(()=>saveContent(saved),{status:409},'Se mantiene el control de versiones');
  console.log('PASS: mensajes editables, descripciones largas, datos antiguos compatibles y control de versiones sin modificar galería ni agenda.');
}finally{db().close();}
