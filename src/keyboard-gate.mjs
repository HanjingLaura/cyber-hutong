// Pure helpers for when Phaser may capture WASD / arrows vs when the DOM needs them.

/** Focus is in a field that needs character or caret input. */
export function isTypingTarget(el) {
  if (!el || typeof el !== 'object') return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return typeof el.closest === 'function' && !!el.closest('[contenteditable=""],[contenteditable="true"]');
}

/**
 * Whether Phaser keyboard + movement capture should be active.
 * Only when the game surface is focused, the local tab may control, and no typing UI is open.
 */
export function shouldEnableGameKeyboard({
  activeElement,
  world,
  canvas,
  dialogOpen,
  controller,
  userHasRole,
  connected,
}) {
  if (dialogOpen) return false;
  if (isTypingTarget(activeElement)) return false;
  if (![world, canvas].includes(activeElement)) return false;
  if (!controller) return false;
  if (userHasRole && !connected) return false;
  return true;
}
