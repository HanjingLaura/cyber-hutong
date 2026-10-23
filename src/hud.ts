/** Top-left HUD: scene name and key prompts live in separate boxes on one vertical rail. */
let sceneAction = '';
let exitAvailable = false;

function renderAction() {
  const line = document.querySelector('#guide-action');
  if (line) line.textContent = exitAvailable ? 'E · 出门' : sceneAction;
}

export function markScene(label: string) {
  const mark = document.querySelector('#scene-mark');
  if (mark) mark.textContent = label;
  const caption = document.querySelector('#view-label');
  if (caption) caption.textContent = label;
}

export function setGuide(keys: string, action?: string) {
  const title = document.querySelector('#guide-title');
  if (title) title.textContent = keys;
  if (action !== undefined) {
    sceneAction = action;
    renderAction();
  }
}

/** Exit navigation temporarily takes priority over the current room's action. */
export function setExitGuide(available: boolean) {
  if (exitAvailable === available) return;
  exitAvailable = available;
  renderAction();
}

export function dockPrompt(el: HTMLElement | null) {
  const rail = document.querySelector('#hud-rail');
  if (el && rail && el.parentElement !== rail) rail.append(el);
}
