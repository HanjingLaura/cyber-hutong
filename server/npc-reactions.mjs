// Six bounded rows, replicated with the other game tables. An action may land
// on a different Vercel instance from the owner's or observers' SSE streams.
export function createNpcReactions(db) {
  db.exec('CREATE TABLE IF NOT EXISTS npc_reactions(npc TEXT PRIMARY KEY,expires INTEGER NOT NULL,reaction TEXT NOT NULL)');
  const all = db.prepare('SELECT reaction FROM npc_reactions WHERE expires>?');
  const one = db.prepare('SELECT reaction FROM npc_reactions WHERE npc=? AND expires>?');
  const put = db.prepare('INSERT INTO npc_reactions VALUES(?,?,?) ON CONFLICT(npc) DO UPDATE SET expires=excluded.expires,reaction=excluded.reaction');
  return {
    values() { return all.all(Date.now()).map(row => JSON.parse(row.reaction)); },
    get(npc) { const row = one.get(npc, Date.now()); return row ? JSON.parse(row.reaction) : undefined; },
    set(npc, reaction) { put.run(npc, reaction.expires, JSON.stringify(reaction)); },
  };
}
