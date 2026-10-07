export interface Stick { x: number; y: number; magnitude: number }
export interface Action { code: 'KeyE' | 'KeyF'; label: string }
export function stickVector(dx: number, dy: number, radius: number, deadZone?: number): Stick;
export function knobOffset(dx: number, dy: number, radius: number): { x: number; y: number };
export function stickKeys(v: Stick, threshold?: number): Set<string>;
export function contextActions(text: string | null | undefined): { primary: Action | null; secondary: Action | null };
export function isTouchDevice(env: { coarse: boolean; maxTouchPoints: number; finePointer: boolean }): boolean;
