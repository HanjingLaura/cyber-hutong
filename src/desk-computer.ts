import './desk-computer.css';
import aniIcon from '../assets/ui/ani-app-icon.png';
import grokIcon from '../assets/ui/grokbot-app-icon.png';
import codexIcon from '../assets/ui/codex-app-icon.png';
import feishuIcon from '../assets/ui/feishu-app-icon.png';

const apps = [
  { id: 'grokbot', name: 'Grokbot', href: 'https://grok.com/', icon: grokIcon },
  { id: 'codex', name: 'Codex', href: 'https://chatgpt.com/codex/', icon: codexIcon },
  { id: 'ani', name: 'Ani', href: 'https://app.ani.cool/', icon: aniIcon },
  { id: 'feishu', name: '飞书', href: 'https://www.feishu.cn/', icon: feishuIcon },
] as const;

let root: HTMLDialogElement | null = null;

function ensure() {
  if (root) return root;
  root = document.createElement('dialog');
  root.id = 'desk-computer';
  root.className = 'desk-computer';
  root.innerHTML = `
    <div class="desk-bezel" role="document">
      <header class="desk-titlebar">
        <span class="desk-title">工位电脑 · DESKTOP</span>
        <button type="button" class="desk-close" aria-label="关闭电脑屏幕">×</button>
      </header>
      <div class="desk-screen">
        <div class="desk-wallpaper" aria-hidden="true"></div>
        <div class="desk-icons"></div>
        <footer class="desk-taskbar">
          <span class="desk-start">赛博胡同</span>
          <span class="desk-clock" id="desk-clock"></span>
        </footer>
      </div>
    </div>`;
  const icons = root.querySelector('.desk-icons')!;
  for (const app of apps) {
    const link = document.createElement('a');
    link.className = 'desk-app';
    link.href = app.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.dataset.app = app.id;
    link.innerHTML = `<img src="${app.icon}" alt="" width="48" height="48" draggable="false"/><span>${app.name}</span>`;
    icons.append(link);
  }
  root.querySelector('.desk-close')!.addEventListener('click', () => closeDeskComputer());
  root.addEventListener('cancel', event => {
    event.preventDefault();
    closeDeskComputer();
  });
  root.addEventListener('click', event => {
    if (event.target === root) closeDeskComputer();
  });
  document.querySelector('.world')!.append(root);
  return root;
}

function tick() {
  const clock = document.getElementById('desk-clock');
  if (!clock || !root?.open) return;
  clock.textContent = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function deskComputerOpen() {
  return !!root?.open;
}

export function openDeskComputer() {
  const dialog = ensure();
  if (!dialog.open) dialog.showModal();
  tick();
}

export function closeDeskComputer() {
  if (!root?.open) return;
  root.close();
  document.querySelector<HTMLElement>('.world')?.focus();
}

setInterval(tick, 1000);
