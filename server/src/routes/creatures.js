import express from 'express';
import crypto from 'node:crypto';
import db from '../db/index.js';

const router = express.Router();

const JSON_FIELDS = [
  'ac_detail', 'speed', 'saving_throws', 'skills', 'damage_vulnerabilities',
  'damage_resistances', 'damage_immunities', 'condition_immunities', 'senses',
  'traits', 'actions', 'legendary_actions', 'reactions', 'environments',
];

function rowToCreature(row) {
  if (!row) return null;
  const out = { ...row };
  for (const f of JSON_FIELDS) {
    try { out[f] = JSON.parse(row[f] ?? 'null'); } catch { out[f] = null; }
  }
  return out;
}

const SORT_COLUMNS = {
  cr_asc: 'cr ASC, name ASC',
  cr_desc: 'cr DESC, name ASC',
  name_asc: 'name ASC',
  name_desc: 'name DESC',
  hp_asc: 'hp ASC',
  hp_desc: 'hp DESC',
};

router.get('/', (req, res) => {
  const { search, type, environment, source, sizes, crMin, crMax, sort, page = '1', pageSize = '24' } = req.query;
  const where = [];
  const params = {};

  if (search) {
    where.push('(name LIKE @search OR description LIKE @search)');
    params.search = `%${search}%`;
  }
  if (type) {
    where.push('type = @type');
    params.type = type;
  }
  if (source) {
    where.push('source = @source');
    params.source = source;
  }
  if (environment) {
    where.push('environments LIKE @environment');
    params.environment = `%"${environment}"%`;
  }
  if (crMin !== undefined && crMin !== '') {
    where.push('cr >= @crMin');
    params.crMin = Number(crMin);
  }
  if (crMax !== undefined && crMax !== '') {
    where.push('cr <= @crMax');
    params.crMax = Number(crMax);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const orderSql = SORT_COLUMNS[sort] || SORT_COLUMNS.cr_asc;
  const limit = Math.min(100, Math.max(1, Number(pageSize) || 24));
  const offset = (Math.max(1, Number(page) || 1) - 1) * limit;

  const total = db.prepare(`SELECT COUNT(*) c FROM creatures ${whereSql}`).get(params).c;
  const rows = db.prepare(`SELECT * FROM creatures ${whereSql} ORDER BY ${orderSql} LIMIT ${limit} OFFSET ${offset}`).all(params);

  res.json({ total, page: Number(page) || 1, pageSize: limit, results: rows.map(rowToCreature) });
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM creatures WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Creatura non trovata' });
  res.json(rowToCreature(row));
});

function creatureFromBody(body) {
  return {
    name: body.name,
    size: body.size || 'Media',
    type: body.type || 'humanoid',
    subtype: body.subtype || null,
    alignment: body.alignment || 'neutrale',
    ac: Number(body.ac) || 10,
    ac_detail: JSON.stringify(body.ac_detail || []),
    hp: Number(body.hp) || 1,
    hit_dice: body.hit_dice || '',
    speed: JSON.stringify(body.speed || { walk: '30 ft.' }),
    str: Number(body.str) || 10, dex: Number(body.dex) || 10, con: Number(body.con) || 10,
    intl: Number(body.intl) || 10, wis: Number(body.wis) || 10, cha: Number(body.cha) || 10,
    saving_throws: JSON.stringify(body.saving_throws || {}),
    skills: JSON.stringify(body.skills || {}),
    damage_vulnerabilities: JSON.stringify(body.damage_vulnerabilities || []),
    damage_resistances: JSON.stringify(body.damage_resistances || []),
    damage_immunities: JSON.stringify(body.damage_immunities || []),
    condition_immunities: JSON.stringify(body.condition_immunities || []),
    senses: JSON.stringify(body.senses || {}),
    languages: body.languages || '',
    cr: Number(body.cr) || 0,
    xp: Number(body.xp) || 0,
    proficiency_bonus: Number(body.proficiency_bonus) || 2,
    traits: JSON.stringify(body.traits || []),
    actions: JSON.stringify(body.actions || []),
    legendary_actions: JSON.stringify(body.legendary_actions || []),
    reactions: JSON.stringify(body.reactions || []),
    environments: JSON.stringify(body.environments || []),
    image_url: body.image_url || null,
    description: body.description || '',
  };
}

router.post('/', (req, res) => {
  if (!req.body?.name) return res.status(400).json({ error: 'Il nome è obbligatorio' });
  const id = `hb-${crypto.randomUUID()}`;
  const data = creatureFromBody(req.body);
  db.prepare(`
    INSERT INTO creatures (
      id, source, name, size, type, subtype, alignment, ac, ac_detail, hp, hit_dice, speed,
      str, dex, con, intl, wis, cha, saving_throws, skills, damage_vulnerabilities,
      damage_resistances, damage_immunities, condition_immunities, senses, languages,
      cr, xp, proficiency_bonus, traits, actions, legendary_actions, reactions,
      environments, image_url, description
    ) VALUES (
      @id, 'homebrew', @name, @size, @type, @subtype, @alignment, @ac, @ac_detail, @hp, @hit_dice, @speed,
      @str, @dex, @con, @intl, @wis, @cha, @saving_throws, @skills, @damage_vulnerabilities,
      @damage_resistances, @damage_immunities, @condition_immunities, @senses, @languages,
      @cr, @xp, @proficiency_bonus, @traits, @actions, @legendary_actions, @reactions,
      @environments, @image_url, @description
    )
  `).run({ id, ...data });
  res.status(201).json(rowToCreature(db.prepare('SELECT * FROM creatures WHERE id = ?').get(id)));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM creatures WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Creatura non trovata' });
  if (existing.source !== 'homebrew') return res.status(403).json({ error: 'Solo le creature homebrew possono essere modificate' });
  const data = creatureFromBody({ ...existing, ...req.body });
  db.prepare(`
    UPDATE creatures SET name=@name, size=@size, type=@type, subtype=@subtype, alignment=@alignment,
      ac=@ac, ac_detail=@ac_detail, hp=@hp, hit_dice=@hit_dice, speed=@speed, str=@str, dex=@dex,
      con=@con, intl=@intl, wis=@wis, cha=@cha, saving_throws=@saving_throws, skills=@skills,
      damage_vulnerabilities=@damage_vulnerabilities, damage_resistances=@damage_resistances,
      damage_immunities=@damage_immunities, condition_immunities=@condition_immunities,
      senses=@senses, languages=@languages, cr=@cr, xp=@xp, proficiency_bonus=@proficiency_bonus,
      traits=@traits, actions=@actions, legendary_actions=@legendary_actions, reactions=@reactions,
      environments=@environments, image_url=@image_url, description=@description
    WHERE id=@id
  `).run({ id: req.params.id, ...data });
  res.json(rowToCreature(db.prepare('SELECT * FROM creatures WHERE id = ?').get(req.params.id)));
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM creatures WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Creatura non trovata' });
  if (existing.source !== 'homebrew') return res.status(403).json({ error: 'Solo le creature homebrew possono essere eliminate' });
  db.prepare('DELETE FROM creatures WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export default router;
export { rowToCreature };
