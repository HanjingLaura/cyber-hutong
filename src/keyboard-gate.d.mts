export function isTypingTarget(el: { tagName?: string; isContentEditable?: boolean; closest?: (selector: string) => Element | null } | null | undefined): boolean;
export function shouldEnableGameKeyboard(options: {
  activeElement: Element | null;
  world: Element | null;
  canvas: Element | null;
  dialogOpen: boolean;
  controller: boolean;
  userHasRole: boolean;
  connected: boolean;
}): boolean;
