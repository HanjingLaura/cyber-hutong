/** Framework-independent contracts. Implementations belong on the server. */
export type MemberId = 'suki' | 'franco' | 'sid' | 'jilly' | 'laura' | 'kay' | 'cora' | 'amber';
export type SceneId = 'hutong' | 'hawaii' | 'rest_area' | 'restroom' | 'elevator'
  | 'concert' | 'popmart' | 'gym' | 'mixian';
export interface Point { x: number; y: number }
export interface SceneConfig {
  id: SceneId;
  background: string;
  logicalSize: { width: 1280; height: 720 };
  walkable: Point[][];
  obstacles: Point[][];
  targets: Record<string, Point>;
  exits: Array<{ area: Point[]; destination: SceneId; spawn: Point }>;
  seats: Array<{ id: string; owner: MemberId; anchor: Point; scale: number; pose: string }>;
  foregroundLayers: Array<{ asset: string; depth: number }>;
}
export interface Session { memberId: MemberId; expiresAt: number }
export interface AuthService {
  register(input: { name: string; claimCode: string; password: string }): Promise<void>;
  login(input: { name: string; password: string }): Promise<{ token: string; session: Session }>;
  authenticate(token: string): Promise<Session | null>;
  logout(token: string): Promise<void>;
  requestReset(name: string): Promise<void>;
  resetPassword(input: { name: string; code: string; password: string }): Promise<void>;
}
export type PlayerIntent =
  | { type: 'move'; target: Point }
  | { type: 'interact'; targetId: string }
  | { type: 'respond'; eventId: string; accept: boolean }
  | { type: 'set_mode'; mode: 'manual' | 'auto' };
// Actor identity comes from authenticated session, never from this payload.
export interface ClientMessage { sequence: number; leaseId: string; intent: PlayerIntent }
export interface OutboxEntry { id: string; payload: unknown }
export interface WorldRepository {
  load(): Promise<{ version: number; snapshot: unknown } | null>;
  /** One DB transaction: compare version, save snapshot, insert commands.
   * Conflict throws. Never save state separately from its commands. */
  commit(input: { expectedVersion: number; snapshot: unknown; commands: OutboxEntry[] }): Promise<number>;
  pendingCommands(limit: number): Promise<OutboxEntry[]>;
  acknowledgeCommand(id: string): Promise<void>;
}
