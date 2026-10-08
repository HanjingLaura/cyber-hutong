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
  // Pose comes from PartyKit; the held item is server-authoritative when the server knows this player.
  const server = new Map(ssePlayers.map(p => [p.role, p]));
  for (const p of partyPlayers) { const s = server.get(p.role); map.set(p.role, s && !(s as Player & { offline?: boolean }).offline ? { ...p, hand: s.hand } : p); }
  return [...map.values()];
}

export class PartyPresence {
  private socket: PartySocket | null = null;
  private players = new Map<Role, Player>();
  connected = false;
  enabled = false;
  private lastMove = '';
  private closed = false;
  private generation = 0;
  private connecting: Promise<void> | null = null;
  private controller = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

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

  async connect(force = false) {
    const host = partyHost();
    if (!host || this.closed) return;
    if (!force && this.connecting) return this.connecting;
    if (!force && this.socket && this.socket.readyState !== this.socket.CLOSED) return;
    this.disconnectSocket();
    const generation = this.generation;
    const current = () => !this.closed && generation === this.generation;
    const attempt = (async () => {
    try {
      let ticket = await this.request<{ ticket: string; room: string; expires: number }>('party-ticket', { client: this.clientId });
      if (!current()) return;
      let issuedAt = Date.now();
      const socket = new PartySocket({
        host,
        room: ticket.room || DEFAULT_ROOM,
        id: this.clientId,
        maxRetries: 12,
      });
      this.socket = socket;
      socket.addEventListener('open', async () => {
        if (!current()) return;
        // PartySocket auto-reconnects with the same options; tickets live 60s, so a reconnect
        // must fetch a fresh one or the room rejects the hello and presence silently stops.
        if (Date.now() - issuedAt > 40_000) {
          try { ticket = await this.request('party-ticket', { client: this.clientId }); issuedAt = Date.now(); }
          catch { if (current()) { this.connected = false; this.onChange(); socket.close(); } return; }
        }
        if (!current()) return;
        const character = this.bridge.state();
        this.connected = false;
        this.controller = false;
        this.lastMove = '';
        socket.send(JSON.stringify({
          type: 'hello',
          ticket: ticket.ticket,
          character: character || undefined,
        }));
        this.onChange();
      });
      socket.addEventListener('message', (event) => { if (current()) this.receive(String(event.data)); });
      socket.addEventListener('close', () => {
        if (!current()) return;
        this.connected = false;
        this.controller = false;
        this.onChange();
      });
      socket.addEventListener('error', () => {
        if (!current()) return;
        this.connected = false;
        this.controller = false;
        this.onChange();
      });
    } catch (e) {
      if (!current()) return;
      this.connected = false;
      this.notice((e as Error).message || 'PartyKit 连接失败');
      this.onChange();
    }
    })();
    this.connecting = attempt;
    try { await attempt; }
    finally { if (current()) this.connecting = null; }
  }

  private receive(raw: string) {
    let data: any;
    try { data = JSON.parse(raw); } catch { return; }
    if (data.type === 'reject') {
      // Retry with a fresh ticket instead of staying silently disconnected.
      this.connected = false; this.controller = false; this.onChange();
      this.disconnectSocket();
      if (!this.closed) this.retryTimer = setTimeout(() => { this.retryTimer = null; if (!this.closed && !this.connected) void this.connect(); }, 2000);
      return;
    }
    if (data.type === 'state') {
      this.players.clear();
      for (const p of data.players || []) this.players.set(p.role, p);
      this.controller = data.you?.controller === true;
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
    if (data.type === 'control') { this.controller = data.controller === true; this.onChange(); }
  }

  /** Push local pose to PartyKit. Returns true when a message was sent. */
  publish(state: Player | null, force = false) {
    if (!this.connected || !this.socket || this.socket.readyState !== this.socket.OPEN || !state) return false;
    if (!this.controller || !this.bridge.controller) return false;
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
    if (this.connected) return;
    await this.connect();
  }

  private disconnectSocket() {
    this.generation++;
    this.connecting = null;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    if (this.socket) {
      const socket = this.socket;
      this.socket = null;
      socket.close();
    }
    this.connected = false;
    this.controller = false;
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
