// Template pronti per /setup. Stesso formato dei piani (vedi plan.js).

const info = (extra = []) => ({
  name: '📌 INFO',
  channels: [
    { name: '📜regole', type: 'text', topic: 'Leggi le regole prima di partecipare' },
    { name: '📢annunci', type: 'announcement', topic: 'Novità e aggiornamenti del server' },
    { name: '👋benvenuto', type: 'text', topic: 'Diamo il benvenuto ai nuovi membri' },
    ...extra,
  ],
});
const staff = { name: '🛡️ STAFF', private: true, allowRoles: ['Admin', 'Moderatore'], channels: [{ name: 'staff-chat', type: 'text' }, { name: 'log', type: 'text' }, { name: 'Staff Vocale', type: 'voice' }] };
const staffRoles = [
  { name: 'Admin', color: '#e74c3c', hoist: true, permissions: ['ManageChannels', 'ManageRoles', 'ManageMessages', 'KickMembers', 'BanMembers', 'ModerateMembers', 'ViewAuditLog', 'MentionEveryone'] },
  { name: 'Moderatore', color: '#3498db', hoist: true, permissions: ['ManageMessages', 'ManageThreads', 'ModerateMembers', 'KickMembers', 'ViewAuditLog', 'MuteMembers', 'MoveMembers'] },
];

export const TEMPLATES = {
  community: {
    label: '🌍 Community generica',
    plan: {
      roles: [...staffRoles, { name: 'Membro attivo', color: '#2ecc71', hoist: true }, { name: 'Membro', color: '#95a5a6' }],
      categories: [
        info([{ name: '🎭ruoli', type: 'text', topic: 'Scegli i tuoi ruoli' }]),
        { name: '💬 GENERALE', channels: [{ name: 'chat-generale', type: 'text' }, { name: 'presentazioni', type: 'text', topic: 'Presentati alla community!' }, { name: 'meme', type: 'text' }, { name: 'media', type: 'text', topic: 'Foto, video e clip' }, { name: 'idee-e-suggerimenti', type: 'forum', topic: 'Proponi idee per il server' }] },
        { name: '🔊 VOCALI', channels: [{ name: 'Lounge', type: 'voice' }, { name: 'Chiacchiere', type: 'voice' }, { name: 'AFK', type: 'voice' }] },
        staff,
      ],
    },
  },
  gaming: {
    label: '🎮 Gaming',
    plan: {
      roles: [...staffRoles, { name: 'Streamer', color: '#9b59b6', hoist: true }, { name: 'Giocatore', color: '#1abc9c' }, { name: 'LFG', color: '#f1c40f' }],
      categories: [
        info([{ name: '🎉eventi', type: 'text', topic: 'Tornei e serate di gioco' }]),
        { name: '💬 CHAT', channels: [{ name: 'generale', type: 'text' }, { name: 'clip-e-screenshot', type: 'text' }, { name: 'cerco-gruppo', type: 'text', topic: 'Cerca compagni di squadra (LFG)' }, { name: 'guide-e-build', type: 'forum' }] },
        { name: '🎮 GIOCHI', channels: [{ name: 'minecraft', type: 'text' }, { name: 'fortnite', type: 'text' }, { name: 'valorant', type: 'text' }, { name: 'altri-giochi', type: 'text' }] },
        { name: '🔊 VOCALI', channels: [{ name: 'Squadra 1', type: 'voice' }, { name: 'Squadra 2', type: 'voice' }, { name: 'Squadra 3', type: 'voice' }, { name: 'Live', type: 'stage' }] },
        staff,
      ],
    },
  },
  studio: {
    label: '📚 Studio / Scuola',
    plan: {
      roles: [...staffRoles, { name: 'Tutor', color: '#e67e22', hoist: true }, { name: 'Studente', color: '#3498db' }],
      categories: [
        info([{ name: '📅calendario', type: 'text', topic: 'Scadenze, esami, verifiche' }]),
        { name: '📖 MATERIE', channels: [{ name: 'matematica', type: 'text' }, { name: 'italiano', type: 'text' }, { name: 'inglese', type: 'text' }, { name: 'informatica', type: 'text' }, { name: 'domande', type: 'forum', topic: 'Fai una domanda, qualcuno ti risponde' }] },
        { name: '📂 RISORSE', channels: [{ name: 'appunti', type: 'text' }, { name: 'link-utili', type: 'text' }] },
        { name: '🔊 AULE STUDIO', channels: [{ name: 'Studio silenzioso', type: 'voice' }, { name: 'Studio di gruppo', type: 'voice' }, { name: 'Lezione', type: 'stage' }] },
        staff,
      ],
    },
  },
  progetti: {
    label: '💻 Team / Progetti software',
    plan: {
      roles: [...staffRoles, { name: 'Sviluppatore', color: '#2ecc71', hoist: true }, { name: 'Designer', color: '#e91e63', hoist: true }, { name: 'Tester', color: '#f39c12' }],
      categories: [
        info([{ name: '🗺️roadmap', type: 'text', topic: 'Obiettivi e milestone' }]),
        { name: '🛠️ SVILUPPO', channels: [{ name: 'generale-dev', type: 'text' }, { name: 'frontend', type: 'text' }, { name: 'backend', type: 'text' }, { name: 'bug-report', type: 'forum', topic: 'Un post per ogni bug: passi, atteso, ottenuto' }, { name: 'idee', type: 'forum' }, { name: 'github-feed', type: 'text', topic: 'Webhook di GitHub' }] },
        { name: '🎨 DESIGN', channels: [{ name: 'ui-ux', type: 'text' }, { name: 'asset', type: 'text' }] },
        { name: '🔊 MEETING', channels: [{ name: 'Daily', type: 'voice' }, { name: 'Pair programming', type: 'voice' }] },
        staff,
      ],
    },
  },
  dnd: {
    label: '🐉 D&D / Gioco di ruolo',
    plan: {
      roles: [...staffRoles, { name: 'Dungeon Master', color: '#8e44ad', hoist: true }, { name: 'Avventuriero', color: '#d35400', hoist: true }, { name: 'Spettatore', color: '#7f8c8d' }],
      categories: [
        info([{ name: '📅sessioni', type: 'text', topic: 'Date e orari delle prossime sessioni' }]),
        { name: '🍺 LA TAVERNA', channels: [{ name: 'taverna', type: 'text', topic: 'Chiacchiere fuori dal gioco' }, { name: 'schede-personaggio', type: 'forum', topic: 'Un post per ogni personaggio' }, { name: 'lore-e-mappe', type: 'text' }, { name: 'tiri-di-dado', type: 'text' }] },
        { name: '⚔️ CAMPAGNA', channels: [{ name: 'gioco', type: 'text', topic: 'Solo in-character' }, { name: 'diario-di-bordo', type: 'text', topic: 'Riassunti delle sessioni' }, { name: 'Tavolo da gioco', type: 'voice' }] },
        { name: '🎲 MASTER', private: true, allowRoles: ['Dungeon Master'], channels: [{ name: 'appunti-master', type: 'text' }, { name: 'png-e-mostri', type: 'text' }] },
        staff,
      ],
    },
  },
};
