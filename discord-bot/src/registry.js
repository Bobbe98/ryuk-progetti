import * as ai from './commands/ai.js';
import * as server from './commands/server.js';
import * as moderation from './commands/moderation.js';
import * as community from './commands/community.js';

const modules = [ai, server, moderation, community];

export const commands = new Map(modules.flatMap((m) => m.commands).map((c) => [c.data.name, c]));
export const buttons = Object.assign({}, ...modules.map((m) => m.buttons ?? {}));
