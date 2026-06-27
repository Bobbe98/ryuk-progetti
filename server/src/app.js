import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db from './db/index.js';
import creaturesRouter from './routes/creatures.js';
import itemsRouter from './routes/items.js';
import encountersRouter from './routes/encounters.js';
import shopsRouter from './routes/shops.js';
import metaRouter from './routes/meta.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Auto-seed on first run if the database is empty.
const creatureCount = db.prepare('SELECT COUNT(*) c FROM creatures').get().c;
if (creatureCount === 0) {
  console.log('Database vuoto: avvio seed automatico dei dati SRD...');
  await import('./seed/seedDb.js');
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.use('/api/creatures', creaturesRouter);
app.use('/api/items', itemsRouter);
app.use('/api/encounters', encountersRouter);
app.use('/api/shops', shopsRouter);
app.use('/api/meta', metaRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/(.*)/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server in ascolto su http://localhost:${PORT}`));
