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
    const offline = !!(p as Player & { offline?: boolean }).offline;
    // Never take an offline (autonomy) copy of yourself: you are live in this tab.
    if (p.role === selfRole ? !offline : offline) map.set(p.role, p);
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
    if (!host || this.closed) return;
    this.disconnectSocket();
    try {
      let ticket = await this.request<{ ticket: string; room: string; expires: number }>('party-ticket', { client: this.clientId });
      let issuedAt = Date.now();
      this.socket = new PartySocket({
        host,
        room: ticket.room || DEFAULT_ROOM,
        id: this.clientId,
        maxRetries: 12,
      });
      this.socket.addEventListener('open', async () => {
        // PartySocket auto-reconnects with the same options; tickets live 60s, so a reconnect
        // must fetch a fresh one or the room rejects the hello and presence silently stops.
        if (Date.now() - issuedAt > 40_000) {
          try { ticket = await this.request('party-ticket', { client: this.clientId }); issuedAt = Date.now(); }
          catch { this.connected = false; this.onChange(); return; }
        }
        const character = this.bridge.state();
        this.connected = true;
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
      });
      this.socket.addEventListener('error', () => {
        this.connected = false;
        this.onChange();
      });
    } catch (e) {
      this.connected = false;
      this.notice((e as Error).message || 'PartyKit 连接失败');
      this.onChange();
    }
  }

  private receive(raw: string) {
    let data: any;
    try { data = JSON.parse(raw); } catch { return; }
    if (data.type === 'reject') {
      // Retry with a fresh ticket instead of staying silently disconnected.
      this.connected = false; this.onChange();
      if (!this.closed) setTimeout(() => { if (!this.closed && !this.connected) void this.connect(); }, 2000);
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
    this.disconnectSocket();
    this.players.clear();
  }

  reopen() {
    this.closed = false;
  }
}
