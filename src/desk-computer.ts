import './desk-computer.css';
import aniIcon from '../assets/ui/ani-app-icon.png';
import grokIcon from '../assets/ui/grokbot-app-icon.png';
import codexIcon from '../assets/ui/codex-app-icon.png';
import feishuIcon from '../assets/ui/feishu-app-icon.png';
import { launchApp } from './app-launch.mjs';
import { isTouchDevice } from './mobile/input.mjs';

type DeskApp = { id: string; name: string; href: string; icon: string; scheme?: string; mobileHref?: string };

const apps: DeskApp[] = [
  { id: 'grokbot', name: 'Grok Bot', href: 'https://grok.com/', scheme: 'grokbot://app/v1/open', icon: grokIcon },
  { id: 'codex', name: 'Codex', href: 'https://chatgpt.com/codex/', scheme: 'codex://threads/new', icon: codexIcon },
  { id: 'ani', name: 'Ani', href: 'https://app.ani.cool/', icon: aniIcon },
  {
    id: 'feishu', name: '飞书', href: 'https://www.feishu.cn/',
    scheme: 'feishu://applink/client/op/open',
    mobileHref: 'https://applink.feishu.cn/client/op/open?lk_unique=true',
    icon: feishuIcon,
  },
];

// Apps whose scheme did nothing this session: later clicks go straight to the website.
const noApp = new Set<string>();

function touchDevice() {
  return isTouchDevice({ coarse: matchMedia('(pointer: coarse)').matches, maxTouchPoints: navigator.maxTouchPoints || 0, finePointer: matchMedia('(any-pointer: fine)').matches && !matchMedia('(pointer: coarse)').matches });
}

function onAppClick(event: MouseEvent, app: DeskApp, link: HTMLAnchorElement) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const mobile = touchDevice();
  if (mobile && app.mobileHref) link.href = app.mobileHref;
  if (mobile || !app.scheme || noApp.has(app.id) || link.dataset.launching) return;
  event.preventDefault();
  link.dataset.launching = '1';
  void launchApp(app, { win: window, doc: document, mobile: false }).then(result => {
    delete link.dataset.launching;
    link.dataset.launched = result;
    if (result !== 'app') noApp.add(app.id);
  });
}

let root: HTMLDialogElement | null = null;

function ensure() {
  if (root) return root;
  root = document.createElement('dialog');
  root.id = 'desk-computer';
  root.className = 'desk-computer';
  root.innerHTML = `
    <div class="desk-bezel" role="document">
      <header class="desk-titlebar">
        <span class="desk-title"></span>
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
    link.addEventListener('click', event => onAppClick(event, app, link));
    link.innerHTML = `<img src="${app.icon}" alt="" width="64" height="64" draggable="false"/><span>${app.name}</span>`;
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
