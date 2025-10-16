import * as db from '../server/db.js';

async function listGuilds() {
    const guilds = await db.getKV('guilds') || {};
    console.log('Available guilds:');
    Object.values(guilds).forEach(g => console.log(g.name));
}

listGuilds().catch(console.error);
