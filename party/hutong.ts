import type * as Party from 'partykit/server';
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

export default class HutongParty implements Party.Server {
  readonly options = { hibernate: false };
  private state = createRoomState();
  private helloTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(readonly room: Party.Room) {}

  private secret() {
    return String(this.room.env.PARTY_AUTH_SECRET || '');
  }

  private send(conn: Party.Connection, value: unknown) {
    conn.send(JSON.stringify(value));
  }

  private broadcast(value: unknown, except: string[] = []) {
    const message = JSON.stringify(value);
    const excluded = new Set(except);
    for (const conn of this.room.getConnections()) {
      if ((conn.state as AuthState | undefined)?.userId && !excluded.has(conn.id)) conn.send(message);
    }
  }

  onConnect(conn: Party.Connection) {
    const timer = setTimeout(() => {
      if (!(conn.state as AuthState | undefined)?.userId) {
        this.send(conn, { type: 'reject', reason: '请先登录后发送 hello' });
        conn.close(4001, 'hello timeout');
      }
    }, 8000);
    this.helloTimers.set(conn.id, timer);
  }

  async onMessage(message: string | ArrayBuffer, sender: Party.Connection) {
    if (typeof message !== 'string') return;
    let data: any;
    try {
      data = JSON.parse(message);
    } catch {
      this.send(sender, { type: 'reject', reason: '消息格式无效' });
      return;
    }

    if (data?.type === 'ping') {
      this.send(sender, { type: 'pong', t: data.t ?? Date.now() });
      return;
    }

    if (data?.type === 'hello') {
      const claims = await verifyTicket(this.secret(), data.ticket);
      if (!claims) {
        this.send(sender, { type: 'reject', reason: '会话无效或已过期' });
        sender.close(4003, 'invalid ticket');
        return;
      }
      const timer = this.helloTimers.get(sender.id);
      if (timer) {
        clearTimeout(timer);
        this.helloTimers.delete(sender.id);
      }

      const result = applyHello(this.state, sender.id, claims, data.character || {});
      sender.setState({
        userId: result.you.userId,
        role: result.you.role,
        controller: result.you.controller,
      } satisfies AuthState);

      if (result.demoted) {
        const old = this.room.getConnection(result.demoted);
        if (old) {
          const prev = (old.state || {}) as AuthState;
          old.setState({ ...prev, controller: false });
          this.send(old, { type: 'control', controller: false });
        }
      }

      this.send(sender, { ...roomSnapshot(this.state), you: result.you });
      this.broadcast({ type: 'presence', event: 'join', player: result.player }, [sender.id]);
      return;
    }

    const link = sender.state as AuthState | undefined;
    if (!link?.userId) {
      this.send(sender, { type: 'reject', reason: '请先 hello' });
      return;
    }

    if (data?.type === 'move') {
      const result = applyMove(this.state, sender.id, data);
      if (!result.ok) {
        this.send(sender, { type: 'reject', reason: result.reason });
        return;
      }
      this.broadcast({ type: 'presence', event: 'update', player: result.player }, [sender.id]);
      return;
    }

    this.send(sender, { type: 'reject', reason: '未知消息' });
  }

  onClose(conn: Party.Connection) {
    const timer = this.helloTimers.get(conn.id);
    if (timer) {
      clearTimeout(timer);
      this.helloTimers.delete(conn.id);
    }
    const result = applyLeave(this.state, conn.id);
    if (result.takeover) {
      const next = this.room.getConnection(result.takeover);
      if (next) {
        const prev = (next.state || {}) as AuthState;
        next.setState({ ...prev, controller: true });
        this.send(next, { type: 'control', controller: true });
      }
    }
    if (result.left) {
      this.broadcast({ type: 'presence', event: 'leave', player: { role: result.left.role } });
    } else if (result.player) {
      this.broadcast({ type: 'presence', event: 'update', player: result.player });
    }
  }

  onError(conn: Party.Connection) {
    this.onClose(conn);
  }

  onRequest() {
    return new Response(
      JSON.stringify({
        ok: true,
        room: this.room.id || PARTY_ROOM_ID,
        players: roomSnapshot(this.state).players.length,
      }),
      { headers: { 'content-type': 'application/json' } },
    );
  }
}

HutongParty satisfies Party.Worker;
