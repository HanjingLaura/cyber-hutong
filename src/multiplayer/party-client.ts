import PartySocket from 'partysocket';
import type { MultiplayerBridge } from './bridge';
import type { Player, Role } from './types';

export type PartyRequest = <T = any>(path: string, input?: unknown) => Promise<T>;

const DEFAULT_ROOM = 'hutong-main';

function partyHost(): string | null {
  const fromEnv = (import.meta as any).env?.VITE_PARTYKIT_HOST as string | undefined;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim().replace(/^https?:\/\//, '');
  return null;
}

/** Merge PartyKit live poses with SSE offline agents. PartyKit wins for live roles. */
export function mergePartyPlayers(partyPlayers: Player[], ssePlayers: Player[], selfRole?: Role | null): Player[] {
  const map = new Map<string, Player>();
  for (const p of ssePlayers) {
    if ((p as Player & { offline?: boolean }).offline || p.role === selfRole) map.set(p.role, p);
  }
  for (const p of partyPlayers) map.set(p.role, p);
  return [...map.values()];
}

export class PartyPresence {
  private socket: PartySocket | null = null;
  private players = new Map<Role, Player>();
  connected = false;
  enabled = false;
  private helloAt = 0;
  private lastMove = '';
  private closed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private connecting = false;

  constructor(
    private bridge: MultiplayerBridge,
    private clientId: string,
    private request: PartyRequest,
    private onChange: () => void,
    private notice: (message: string) => void,
  ) {
    this.enabled = !!partyHost();
  }

  host() {
    return partyHost();
  }

  list(): Player[] {
    return [...this.players.values()];
  }

  online(): { role: Role; scene: string }[] {
    return this.list().map(p => ({ role: p.role, scene: p.scene }));
  }

  async connect() {
    const host = partyHost();
    if (!host || this.closed || this.connecting) return;
    this.connecting = true;
    this.clearReconnect();
    this.disconnectSocket();
    try {
      const ticket = await this.request<{ ticket: string; room: string; expires: number }>('party-ticket', { client: this.clientId });
      if (this.closed) return;
      const character = this.bridge.state();
      this.socket = new PartySocket({
        host,
        room: ticket.room || DEFAULT_ROOM,
        id: this.clientId,
        // Keep trying under flaky mobile / high-latency links (8 concurrent clients).
        maxRetries: 24,
        startClosed: false,
      });
      this.socket.addEventListener('open', () => {
        this.connected = true;
        this.reconnectAttempt = 0;
        this.helloAt = Date.now();
        this.socket?.send(JSON.stringify({
          type: 'hello',
          ticket: ticket.ticket,
          character: character || undefined,
        }));
        this.onChange();
      });
      this.socket.addEventListener('message', (event) => this.receive(String(event.data)));
      this.socket.addEventListener('close', () => {
        this.connected = false;
        this.onChange();
        this.scheduleReconnect();
      });
      this.socket.addEventListener('error', () => {
        this.connected = false;
        this.onChange();
      });
    } catch (e) {
      this.connected = false;
      this.notice((e as Error).message || 'PartyKit 连接失败');
      this.onChange();
      this.scheduleReconnect();
    } finally {
      this.connecting = false;
    }
  }

  private clearReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.closed || !this.enabled || this.reconnectTimer) return;
    const delay = Math.min(15_000, 800 * Math.pow(1.6, this.reconnectAttempt++));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
  }

  private receive(raw: string) {
    let data: any;
    try { data = JSON.parse(raw); } catch { return; }
    if (data.type === 'reject') {
      this.notice(data.reason || '联机房间拒绝连接');
      return;
    }
    if (data.type === 'state') {
      this.players.clear();
      for (const p of data.players || []) this.players.set(p.role, p);
      this.connected = true;
      this.onChange();
      return;
    }
    if (data.type === 'presence') {
      if (data.event === 'leave' && data.player?.role) this.players.delete(data.player.role);
      else if (data.player?.role) this.players.set(data.player.role, data.player);
      this.onChange();
      return;
    }
    if (data.type === 'control') this.onChange();
  }

  /** Push local pose to PartyKit. Returns true when a message was sent. */
  publish(state: Player | null, force = false) {
    if (!this.socket || this.socket.readyState !== this.socket.OPEN || !state) return false;
    if (!this.bridge.controller) return false;
    const signature = JSON.stringify([state.scene, state.x, state.y, state.facing, state.moving, state.seat, state.hand, state.activity]);
    if (!force && signature === this.lastMove) return false;
    this.lastMove = signature;
    this.socket.send(JSON.stringify({
      type: 'move',
      scene: state.scene,
      x: state.x,
      y: state.y,
      facing: state.facing,
      moving: state.moving,
      seat: state.seat,
      hand: state.hand,
      activity: state.activity,
      revision: state.revision,
    }));
    return true;
  }

  async refreshIfNeeded() {
    if (!this.enabled || this.closed) return;
    if (Date.now() - this.helloAt < 45_000 && this.connected) return;
    await this.connect();
  }

  private disconnectSocket() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.connected = false;
  }

  disconnect() {
    this.closed = true;
    this.clearReconnect();
    this.disconnectSocket();
    this.players.clear();
  }

  reopen() {
    this.closed = false;
    this.reconnectAttempt = 0;
  }
}
