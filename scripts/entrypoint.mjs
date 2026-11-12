import {migrate} from '../server/database.mjs';
import {appOrigin} from '../server/security.mjs';
appOrigin();migrate();
console.log('Büroplan: Datenbank bereit.');
await import('../server.js');
