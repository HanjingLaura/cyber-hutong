import type { Connection, ConnectionContext } from 'partyserver';
import { routePartykitRequest, Server } from 'partyserver';
import { verifyTicket } from '../shared/party-ticket.mjs';
import {
  PARTY_ROOM_ID,
  applyHello,
  applyLeave,
  applyMove,
  createRoomState,
  roomSnapshot,
} from '../shared/party-room.mjs';

type AuthState = { userId: string; role: string; controller: boolean };

type Env = {
  Hutong: DurableObjectNamespace;
  PARTY_AUTH_SECRET?: string;
  /** Browser origins allowed for WebSocket CORS (comma-separated). */
  PARTY_CORS_ORIGINS?: string;
};

/**
 * Presence room on the caller's own Cloudflare account (PartyServer).
 * Managed partykit.dev hits the shared-zone custom-domain limit, so we deploy
 * here with wrangler → *.workers.dev instead.
 */
export class Hutong extends Server {
  static options = { hibernate: false };
  private state = createRoomState();
  private helloTimers = new Map<string, ReturnType<typeof setTimeout>>();

  private secret() {
    return String(this.env.PARTY_AUTH_SECRET || '');
  }

  private send(conn: Connection, value: unknown) {
    conn.send(JSON.stringify(value));
  }

  private emit(value: unknown, except: string[] = []) {
    this.broadcast(JSON.stringify(value), except);
  }

  onConnect(conn: Connection, _ctx: ConnectionContext) {
    const timer = setTimeout(() => {
      if (!(conn.state as AuthState | undefined)?.userId) {
        this.send(conn, { type: 'reject', reason: '请先登录后发送 hello' });
        conn.close(4001, 'hello timeout');
      }
    }, 8000);
    this.helloTimers.set(conn.id, timer);
  }

  async onMessage(conn: Connection, message: string | ArrayBuffer | ArrayBufferView) {
    if (typeof message !== 'string') return;
    let data: any;
    try {
      data = JSON.parse(message);
    } catch {
      this.send(conn, { type: 'reject', reason: '消息格式无效' });
      return;
    }

    if (data?.type === 'ping') {
      this.send(conn, { type: 'pong', t: data.t ?? Date.now() });
      return;
    }

    if (data?.type === 'hello') {
      const claims = await verifyTicket(this.secret(), data.ticket);
      if (!claims) {
        this.send(conn, { type: 'reject', reason: '会话无效或已过期' });
        conn.close(4003, 'invalid ticket');
        return;
      }
      const timer = this.helloTimers.get(conn.id);
      if (timer) {
        clearTimeout(timer);
        this.helloTimers.delete(conn.id);
      }

      const result = applyHello(this.state, conn.id, claims, data.character || {});
      conn.setState({
        userId: result.you.userId,
        role: result.you.role,
        controller: result.you.controller,
      } satisfies AuthState);

      if (result.demoted) {
        const old = this.getConnection(result.demoted);
        if (old) {
          const prev = (old.state || {}) as AuthState;
          old.setState({ ...prev, controller: false });
          this.send(old, { type: 'control', controller: false });
        }
      }

      this.send(conn, { ...roomSnapshot(this.state), you: result.you });
      this.emit({ type: 'presence', event: 'join', player: result.player }, [conn.id]);
      return;
    }

    const link = conn.state as AuthState | undefined;
    if (!link?.userId) {
      this.send(conn, { type: 'reject', reason: '请先 hello' });
      return;
    }

    if (data?.type === 'move') {
      const result = applyMove(this.state, conn.id, data);
      if (!result.ok) {
        this.send(conn, { type: 'reject', reason: result.reason });
        return;
      }
      this.emit({ type: 'presence', event: 'update', player: result.player }, [conn.id]);
      return;
    }

    this.send(conn, { type: 'reject', reason: '未知消息' });
  }

  onClose(conn: Connection) {
    const timer = this.helloTimers.get(conn.id);
    if (timer) {
      clearTimeout(timer);
      this.helloTimers.delete(conn.id);
    }
    const result = applyLeave(this.state, conn.id);
    if (result.takeover) {
      const next = this.getConnection(result.takeover);
      if (next) {
        const prev = (next.state || {}) as AuthState;
        next.setState({ ...prev, controller: true });
        this.send(next, { type: 'control', controller: true });
      }
    }
    if (result.left) {
      this.emit({ type: 'presence', event: 'leave', player: { role: result.left.role } });
    } else if (result.player) {
      this.emit({ type: 'presence', event: 'update', player: result.player });
    }
  }

  onError(conn: Connection) {
    this.onClose(conn);
  }

  onRequest() {
    return new Response(
      JSON.stringify({
        ok: true,
        room: this.name || PARTY_ROOM_ID,
        players: roomSnapshot(this.state).players.length,
      }),
      { headers: { 'content-type': 'application/json' } },
    );
  }
}

function corsHeaders(env: Env, request: Request): Record<string, string> | true {
  const allowed = String(env.PARTY_CORS_ORIGINS || 'https://hanjing-laura.vercel.app,https://cyber-hutong.vercel.app,http://127.0.0.1:5173,http://localhost:5173')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const origin = request.headers.get('Origin') || '';
  if (!origin) return true;
  if (allowed.includes(origin) || allowed.includes('*')) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Credentials': 'true',
    };
  }
  return true;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/' || url.pathname === '/health') {
      return Response.json({
        ok: true,
        service: 'cyber-hutong-party',
        room: PARTY_ROOM_ID,
        party: 'hutong',
      });
    }
    try {
      return (
        (await routePartykitRequest(request, env, { cors: corsHeaders(env, request) })) ||
        new Response('Not Found', { status: 404 })
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Response.json({ ok: false, error: message }, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
