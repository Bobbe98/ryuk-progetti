import express from 'express';
import db from '../db/index.js';

const router = express.Router();

function rowToSpell(row) {
  if (!row) return null;
  const out = { ...row };
  try { out.classes = JSON.parse(row.classes ?? '[]'); } catch { out.classes = []; }
  out.ritual = !!row.ritual;
  out.concentration = !!row.concentration;
  return out;
}

const SORT_COLUMNS = {
  level_asc: 'level ASC, name ASC',
  level_desc: 'level DESC, name ASC',
  name_asc: 'name ASC',
  name_desc: 'name DESC',
};

router.get('/', (req, res) => {
  const { search, level, school, klass, ritual, concentration, sort, page = '1', pageSize = '24' } = req.query;
  const where = [];
  const params = {};

  if (search) {
    where.push('(name LIKE @search OR description LIKE @search)');
    params.search = `%${search}%`;
  }
  if (level !== undefined && level !== '') {
    where.push('level = @level');
    params.level = Number(level);
  }
  if (school) {
    where.push('school = @school');
    params.school = school;
  }
  if (klass) {
    where.push('classes LIKE @klass');
    params.klass = `%"${klass}"%`;
  }
  if (ritual === '1') where.push('ritual = 1');
  if (concentration === '1') where.push('concentration = 1');

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const orderSql = SORT_COLUMNS[sort] || SORT_COLUMNS.level_asc;
  const limit = Math.min(100, Math.max(1, Number(pageSize) || 24));
  const offset = (Math.max(1, Number(page) || 1) - 1) * limit;

  const total = db.prepare(`SELECT COUNT(*) c FROM spells ${whereSql}`).get(params).c;
  const rows = db.prepare(`SELECT * FROM spells ${whereSql} ORDER BY ${orderSql} LIMIT ${limit} OFFSET ${offset}`).all(params);

  res.json({ total, page: Number(page) || 1, pageSize: limit, results: rows.map(rowToSpell) });
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM spells WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Incantesimo non trovato' });
  res.json(rowToSpell(row));
});

export default router;
export { rowToSpell };
