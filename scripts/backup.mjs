import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import path from 'node:path';
const directory = path.resolve(process.env.MORA_DATA_DIR || '.mora-data');
mkdirSync(path.join(directory, 'backups'), { recursive: true });
const filename = path.join(
  directory,
  'backups',
  new Date().toISOString().replace(/[:.]/g, '-') + '.sqlite',
);
const database = new DatabaseSync(path.join(directory, 'mora.sqlite'), { readOnly: true });
database.exec("VACUUM INTO '" + filename.replaceAll("'", "''") + "'");
database.close();
chmodSync(filename, 0o600);
console.log('Copia privada creada: ' + filename);
