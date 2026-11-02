import {readFileSync} from 'node:fs';
import {getContent,saveContent,db} from '../src/server/store.mjs';
const defaults=JSON.parse(readFileSync('content/collection.json','utf8'));
const current=getContent();
const additions=defaults.photos.filter(photo=>!current.collection.photos.some(existing=>existing.id===photo.id));
if(additions.length){
  current.collection.photos.push(...additions);
  saveContent(current);
}
console.log(JSON.stringify({added:additions.map(photo=>photo.id),total:getContent().collection.photos.length}));
db().close();
