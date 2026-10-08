import { Server, routePartykitRequest } from 'partyserver';
import HutongParty from './hutong.ts';
import { PARTY_ROOM_ID } from '../shared/party-room.mjs';

// Keep the existing Durable Object class/binding, and share the PartyKit protocol.
export class Hutong extends Server {
  static options = { hibernate: false };
  party = null;

  onStart() {
    const server = this;
    this.party = new HutongParty({
      get id() { return server.name; },
      env: this.env,
      getConnections: () => this.getConnections(),
      getConnection: id => this.getConnection(id),
    });
  }

  onConnect(connection) { return this.party.onConnect(connection); }
  onMessage(connection, message) { return this.party.onMessage(message, connection); }
  onClose(connection) { return this.party.onClose(connection); }
  onError(connection) { return this.party.onError(connection); }
  onRequest() { return this.party.onRequest(); }
}

export function routeRequest(request) {
  const url = new URL(request.url);
  // PartySocket defaults to "main"; existing Cloudflare clients also use "hutong".
  if (url.pathname.startsWith('/parties/main/')) {
    url.pathname = url.pathname.replace('/parties/main/', '/parties/hutong/');
    return new Request(url, request);
  }
  return request;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/' || url.pathname === '/health') {
      return Response.json({ ok: true, service: 'cyber-hutong-party', room: PARTY_ROOM_ID, party: 'hutong' });
    }
    const origins = String(env.PARTY_CORS_ORIGINS || 'https://hanjing-laura.vercel.app,https://cyber-hutong.vercel.app,http://127.0.0.1:5173,http://localhost:5173').split(',').map(s => s.trim());
    const origin = request.headers.get('Origin');
    const cors = origin && (origins.includes(origin) || origins.includes('*')) ? {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Credentials': 'true',
    } : false;
    return await routePartykitRequest(routeRequest(request), env, { cors }) || new Response('Not Found', { status: 404 });
  },
};
