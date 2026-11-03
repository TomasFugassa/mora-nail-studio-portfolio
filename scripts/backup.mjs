import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import path from 'node:path';
if(process.env.MORA_DATABASE_DRIVER==='postgres'||process.env.NETLIFY==='true')throw Error('Este comando es para SQLite local. La copia de Postgres se gestiona desde Netlify Database.');
const directory = path.resolve(process.env.MORA_DATA_DIR || process.env.BERE_DATA_DIR || '.bere-data');
mkdirSync(path.join(directory, 'backups'), { recursive: true });
const filename = path.join(
  directory,
  'backups',
  new Date().toISOString().replace(/[:.]/g, '-') + '.sqlite',
);
const database = new DatabaseSync(path.join(directory, 'bere.sqlite'), { readOnly: true });
database.exec("VACUUM INTO '" + filename.replaceAll("'", "''") + "'");
database.close();
chmodSync(filename, 0o600);
console.log('Copia privada creada: ' + filename);
