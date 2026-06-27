import express from 'express';
import crypto from 'node:crypto';
import db from '../db/index.js';
import { generateCrafting } from '../seed/crafting.js';
import { RARITY_RANK } from '../seed/pricing.js';

const router = express.Router();

const JSON_FIELDS = ['properties', 'crafting_materials'];

function rowToItem(row) {
  if (!row) return null;
  const out = { ...row };
  for (const f of JSON_FIELDS) {
    try { out[f] = JSON.parse(row[f] ?? 'null'); } catch { out[f] = null; }
  }
  out.attunement = !!row.attunement;
  return out;
}

const SORT_COLUMNS = {
  rarity_asc: 'rarity_rank ASC, name ASC',
  rarity_desc: 'rarity_rank DESC, name ASC',
  name_asc: 'name ASC',
  name_desc: 'name DESC',
  cost_asc: 'cost_gp ASC',
  cost_desc: 'cost_gp DESC',
};

router.get('/', (req, res) => {
  const { search, category, rarity, source, sort, page = '1', pageSize = '24' } = req.query;
  const where = [];
  const params = {};

  if (search) {
    where.push('(name LIKE @search OR description LIKE @search)');
    params.search = `%${search}%`;
  }
  if (category) {
    where.push('category = @category');
    params.category = category;
  }
  if (rarity) {
    where.push('rarity = @rarity');
    params.rarity = rarity;
  }
  if (source) {
    where.push('source = @source');
    params.source = source;
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const orderSql = SORT_COLUMNS[sort] || SORT_COLUMNS.rarity_desc;
  const limit = Math.min(100, Math.max(1, Number(pageSize) || 24));
  const offset = (Math.max(1, Number(page) || 1) - 1) * limit;

  const total = db.prepare(`SELECT COUNT(*) c FROM items ${whereSql}`).get(params).c;
  const rows = db.prepare(`SELECT * FROM items ${whereSql} ORDER BY ${orderSql} LIMIT ${limit} OFFSET ${offset}`).all(params);

  res.json({ total, page: Number(page) || 1, pageSize: limit, results: rows.map(rowToItem) });
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Oggetto non trovato' });
  res.json(rowToItem(row));
});

function itemFromBody(body) {
  const rarity = body.rarity || 'common';
  let craftingMaterials = body.crafting_materials;
  let craftingProcedure = body.crafting_procedure;
  if (!craftingMaterials || !craftingProcedure) {
    const generated = generateCrafting(body.category, rarity, body.name);
    craftingMaterials = craftingMaterials || generated.crafting_materials;
    craftingProcedure = craftingProcedure || generated.crafting_procedure;
  }
  return {
    name: body.name,
    category: body.category || 'Wondrous Items',
    rarity,
    rarity_rank: RARITY_RANK[rarity] ?? 0,
    cost_gp: Number(body.cost_gp) || 0,
    attunement: body.attunement ? 1 : 0,
    weight: body.weight != null ? Number(body.weight) : null,
    description: body.description || '',
    properties: JSON.stringify(body.properties || {}),
    crafting_materials: JSON.stringify(craftingMaterials),
    crafting_procedure: craftingProcedure,
    image_url: body.image_url || null,
  };
}

router.post('/', (req, res) => {
  if (!req.body?.name) return res.status(400).json({ error: 'Il nome è obbligatorio' });
  const id = `hb-${crypto.randomUUID()}`;
  const data = itemFromBody(req.body);
  db.prepare(`
    INSERT INTO items (
      id, source, name, category, rarity, rarity_rank, cost_gp, attunement, weight,
      description, properties, crafting_materials, crafting_procedure, image_url
    ) VALUES (
      @id, 'homebrew', @name, @category, @rarity, @rarity_rank, @cost_gp, @attunement, @weight,
      @description, @properties, @crafting_materials, @crafting_procedure, @image_url
    )
  `).run({ id, ...data });
  res.status(201).json(rowToItem(db.prepare('SELECT * FROM items WHERE id = ?').get(id)));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Oggetto non trovato' });
  if (existing.source !== 'homebrew') return res.status(403).json({ error: 'Solo gli oggetti homebrew possono essere modificati' });
  const data = itemFromBody({ ...existing, ...req.body, properties: req.body.properties ?? JSON.parse(existing.properties || '{}') });
  db.prepare(`
    UPDATE items SET name=@name, category=@category, rarity=@rarity, rarity_rank=@rarity_rank,
      cost_gp=@cost_gp, attunement=@attunement, weight=@weight, description=@description,
      properties=@properties, crafting_materials=@crafting_materials, crafting_procedure=@crafting_procedure,
      image_url=@image_url
    WHERE id=@id
  `).run({ id: req.params.id, ...data });
  res.json(rowToItem(db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id)));
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Oggetto non trovato' });
  if (existing.source !== 'homebrew') return res.status(403).json({ error: 'Solo gli oggetti homebrew possono essere eliminati' });
  db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export default router;
export { rowToItem };
