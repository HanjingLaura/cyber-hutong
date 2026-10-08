import { BASE } from './base';
import {canWorkAt} from './workstations';
import { OfficeWindow } from './office-window';
import { AniGuest, preloadAni } from './ani-guest';
import {sharedAction,onlineWorld} from './multiplayer/world-client';
import { startSocial } from './multiplayer/social';
import { OfficeGuest, preloadOfficeGuests } from './office-guests';
import Phaser from 'phaser';
import { mountTouchControls } from './mobile/controls';
import './style.css';
import './frontend-refinements.css';
import { RestRoomScene } from './rest-room';
import { PopMartScene } from './popmart';
import { BathroomScene } from './bathroom';
import { ConcertScene } from './concert';
import { ArcadeScene } from './arcade';
import { NoodleShopScene } from './noodle-shop';
import { GymScene } from './gym';
import { DanceStudioScene } from './dance-studio';
import { PerlerShopScene } from './perler-shop';
import { RehearsalScene } from './rehearsal';
import { ElevatorLobbyScene } from './elevator-lobby';
import { SubwayScene } from './subway';
import { KtvScene } from './ktv';
import { markScene, setGuide } from './hud';
import { openDeskComputer, closeDeskComputer, deskComputerOpen } from './desk-computer';
import { playerInventory, type ItemName } from './player-inventory';
import { registerProductTextures } from './product-textures';
import { holdScene } from './scene-gate';
import { registerRegions, setSpriteFrame, type SpriteFrame } from './frames';
import { canWalk, project, visualFacing, floorY, HEIGHT_PROJECTION, WORKSTATIONS, DESK_ROWS, REVERSE_Y, SPAWN, METRICS, VIEW_WIDTH, VIEW_HEIGHT, PIXEL_RATIO, CONTENT_SCALE, scaleRowPoint, type Facing, type Workstation } from './layout';

const assets = {
  wall: new URL('../assets/drafts/hutong-wall-view-v5.png', import.meta.url).href,
  reverse: new URL('../assets/drafts/hutong-reverse-view-v5.png', import.meta.url).href,
  furniture: new URL('../assets/drafts/hutong-furniture-kit-v5.png', import.meta.url).href,
  decor: new URL('../assets/drafts/desk-decor-v1.png', import.meta.url).href,
};
const HAWAII_SEATS: Workstation[] = ['culture', 'plain'].flatMap((row,index) =>
  Array.from({length:3},(_,number)=>({
    ...WORKSTATIONS.find(seat=>seat.row===row)!, id:`H${index===0?'R':'L'}${number+1}`,number:number+1,
    foot:{x:96+(number+2/3)*(448/3),y:WORKSTATIONS.find(seat=>seat.row===row)!.foot.y},
    stand:{x:96+(number+2/3)*(448/3),y:WORKSTATIONS.find(seat=>seat.row===row)!.stand.y},
  })));
type Layer = 'room' | 'desk' | 'chair' | 'laptop' | 'decor' | 'actor' | 'anchors';
interface Seat extends Workstation {
  chair: Phaser.GameObjects.Image;
  back: Phaser.GameObjects.Image; laptop: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text;
}
interface DeskRow { row: Workstation['row']; footY: number; facing: Facing; floorStart: number; floorEnd: number;
  desk: Phaser.GameObjects.Image; panel: Phaser.GameObjects.Image }
type FurnitureKind = 'desk' | 'chair' | 'laptop';
interface DeskDecoration { row: Workstation['row']; x: number; frame: number; image: Phaser.GameObjects.Image }
interface PreviewState {
  hand: ItemName | null; heldItemVisible: boolean;
  ready: boolean; view: 'culture' | 'opposite'; mode: 'standing' | 'walking' | 'working' | 'sit';
  x: number; y: number; screenX: number; screenY: number; facing: Facing; visualFacing: Facing;
  seatedAt: string | null; nearest: string | null; seatCount: number; walkFrame: number;
  texture: string; actorScale: number; layers: Record<Layer, boolean>; frameCounts: Record<string, number>;
  metrics: typeof METRICS; deskRowCount: number; projectionY: number; framebuffer: { width: number; height: number };
  furnitureBounds: Record<FurnitureKind, { width: number; height: number }[]>; fps: number;
}
declare global { interface Window { __hawaiiPreview?: { getState: () => PreviewState & {curtainDown:boolean;curtainProgress:number;nearWindow:boolean} }; __hutongPreview?: { getState: () => PreviewState } } }

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header><h1>hutong-online</h1><p>WASD 移动 · E 互动</p></header>
  <nav class="scene-nav" aria-label="场景视角"><button data-scene="culture" aria-pressed="true">胡同</button><button data-scene="opposite" aria-pressed="false">胡同</button><button data-scene="rest" aria-pressed="false">休息室</button><button data-scene="pop" aria-pressed="false">POP MART</button><button data-scene="hawaii" aria-pressed="false">夏威夷</button><button data-scene="bathroom" aria-pressed="false">厕所</button><button data-scene="ktv" aria-pressed="false">KTV</button><button data-scene="concert" aria-pressed="false">演唱会</button><button data-scene="arcade" aria-pressed="false">娱乐室</button><button data-scene="noodle" aria-pressed="false">米线店</button><button data-scene="gym" aria-pressed="false">健身房</button><button data-scene="dance" aria-pressed="false">舞室</button><button data-scene="perler" aria-pressed="false">拼豆店</button><button data-scene="rehearsal" aria-pressed="false">排练厅</button><button data-scene="elevator" aria-pressed="false">电梯间</button><button data-scene="subway" aria-pressed="false">五道口站</button></nav>
  <main>
    <div class="stage-column">
      <section class="world" tabindex="0" aria-label="胡同游戏，方向键移动，E 互动，V 切换视角">
        <dialog id="vending-menu" class="vending-menu" aria-labelledby="vending-title">
          <div class="machine-header"><h2 id="vending-title">贩卖机</h2><button id="vending-close" type="button">关闭</button></div>
          <div class="machine-window"><div id="vending-products"></div></div>
          <div class="machine-bottom"><p></p><div class="pickup-slot" aria-hidden="true"></div></div>
        </dialog><dialog id="table-menu" class="table-menu" aria-labelledby="table-menu-title"><h2 id="table-menu-title">拿回桌上物品</h2><p>点击或按对应数字拿回一件</p><div id="table-pick-list"></div><button id="table-close" type="button">取消</button></dialog><dialog id="fridge-menu" class="fridge-menu" aria-labelledby="fridge-title">
          <div class="fridge-heading"><h2 id="fridge-title">冰箱</h2><button id="fridge-close" type="button">关门</button></div>
          <div class="fridge-cabinet"><div id="fridge-items"></div><div class="fridge-door-bins" aria-hidden="true"><span></span><span></span><span></span></div></div>
          <div class="fridge-actions"><p id="fridge-hand"></p><button id="fridge-store" type="button">放入手中物品</button><p id="fridge-message" aria-live="polite">1–9 取 · F 存</p></div>
        </dialog><dialog id="blind-menu" class="blind-menu" aria-labelledby="blind-title"><div class="blind-heading"><h2 id="blind-title">挑选盲盒</h2><button id="blind-close" type="button">关闭</button></div><div id="blind-machine-art" hidden><canvas id="gacha-art" width="82" height="190" aria-label="扭蛋机与取物口"></canvas></div><div id="blind-themes" aria-label="盲盒主题"></div><p id="blind-help"></p><div class="blind-glass"><div id="blind-boxes"></div></div><div class="blind-pickup"><button id="blind-extract" type="button" disabled>先选择一盒</button><button id="blind-refill" type="button">补货</button></div><div id="blind-result" aria-live="polite"></div></dialog><dialog id="arcade-game" class="arcade-game" aria-labelledby="arcade-title"><header><h2 id="arcade-title"></h2><button id="arcade-close" type="button">返回</button></header><canvas id="arcade-screen" width="640" height="420" aria-label="像素小游戏"></canvas><footer><span id="arcade-help"></span><button id="arcade-undo" type="button" hidden>撤销</button><button id="arcade-action" type="button" hidden></button><button id="arcade-new" type="button">重开</button></footer></dialog><dialog id="noodle-menu" class="noodle-menu" aria-labelledby="noodle-title"><div class="noodle-heading"><h2 id="noodle-title"></h2><button id="noodle-close" type="button">关闭</button></div><p id="noodle-menu-hand"></p><div id="noodle-choices"></div></dialog><dialog id="gym-storage" class="gym-storage" aria-labelledby="gym-storage-title"><div class="gym-storage-heading"><h2 id="gym-storage-title">储物架</h2><button id="gym-storage-close" type="button">关闭</button></div><div id="gym-storage-items"></div></dialog><dialog id="perler-workshop" class="perler-workshop" aria-labelledby="perler-title"><div class="perler-heading"><h2 id="perler-title">拼豆</h2><button id="perler-close" type="button">返回</button></div><div class="perler-workspace"><canvas id="perler-board" width="360" height="360" aria-label="16乘16拼豆底板，点击或拖动放豆，右键擦除"></canvas><div class="perler-tools"><label for="perler-pattern">底图</label><select id="perler-pattern"></select><div id="perler-palette" aria-label="豆子颜色"></div><button id="perler-eraser" type="button" aria-pressed="false">橡皮擦</button><div class="perler-history"><button id="perler-undo" type="button">撤销</button><button id="perler-redo" type="button">重做</button></div><button id="perler-iron" type="button">熨烫作品</button><button id="perler-new" type="button">换新底板</button><p id="perler-progress"></p></div></div><p id="perler-message" aria-live="polite"></p><div id="perler-collection" hidden><h3>作品</h3><div id="perler-gallery"></div></div></dialog><div id="game"></div><div class="loading">载入中…</div>
        <div id="hud-rail">
          <div id="scene-mark">胡同</div>
          <div id="play-guide" aria-live="polite"><strong id="guide-title">WASD / 方向键移动</strong><span id="guide-action">E 坐下 · V 换视角</span></div>
        </div>
        <div id="rehearsal-piano" hidden><div class="piano-heading"><span>钢琴</span><span id="piano-range"></span><button id="rehearsal-piano-close" type="button">起身</button></div><div id="rehearsal-keyboard" aria-label="钢琴琴键"></div></div>
        <button id="view" aria-pressed="false">换个视角</button>
      </section>
      <div class="scene-caption"><span id="view-label">文化墙一侧</span><span></span></div>
      <figure id="walk-review" hidden><canvas id="walk-sheet" width="768" height="224" role="img" aria-label=""></canvas>
        <figcaption></figcaption>
      </figure>
    </div>
    <aside>
      <div class="status"><h2>你的角色</h2><strong id="mode">未登录</strong>
        <p id="hint" class="hint" aria-live="polite"></p>
        <button id="interact" disabled></button><button id="table-action" hidden>放到桌上</button>
      </div>
      <p class="keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / 方向键移动<br>
        <kbd>E</kbd> 坐下办公 / 起身<br><kbd>Esc</kbd> 起身　<kbd>V</kbd> 切换视角</p>
      <div id="hutong-controls"><h2>素材分层</h2>
      <div class="layers">
        <label><input type="checkbox" data-layer="room" checked>墙、地毯、固定墙饰</label>
        <label><input type="checkbox" data-layer="desk" checked>两条完整连续桌排</label>
        <label><input type="checkbox" data-layer="chair" checked>八把独立网椅</label>
        <label><input type="checkbox" data-layer="laptop" checked>八台独立电脑</label>
        <label><input type="checkbox" data-layer="decor" checked>桌面绿植与杯子</label>
        <label><input type="checkbox" data-layer="actor" checked>人物与动作</label>
        <label><input type="checkbox" data-layer="anchors">座位交互点</label>
      </div>
      <button id="curtain-control" type="button" hidden>拉下窗帘</button><div class="seat-state" id="seat-state"></div>
      <p class="note" hidden></p>
      <div class="review-actions"><button id="walk-toggle" aria-expanded="false">查看步行动作</button><button id="reset">回到入口</button></div>
      <p class="note" hidden></p>
      </div>
      <div id="rest-controls" hidden><h2>休息室</h2><p id="rest-inventory">手中：空</p><p id="rest-message" aria-live="polite"></p><div class="layers"><label><input type="checkbox" data-rest-layer="equipment" checked></label><label><input type="checkbox" data-rest-layer="tables" checked>独立餐桌</label><label><input type="checkbox" data-rest-layer="chairs" checked>独立椅子</label></div><button id="rest-reset">重置休息室</button></div>
      <div id="pop-controls" hidden><h2>本期盲盒 <span id="pop-count"></span></h2><div id="pop-collection" class="lineup"></div><p id="pop-legacy" class="note"></p></div>
      <div id="bathroom-controls" hidden><h2>厕所</h2><p id="bathroom-state"></p><button id="bathroom-door" type="button" disabled></button></div>
      <div id="concert-controls" hidden><h2>演唱会内场</h2><p id="concert-state"></p></div>
      <div id="arcade-controls" hidden><h2>娱乐室</h2></div>
      <div id="noodle-controls" hidden><h2>米线店</h2><p id="noodle-hand">手中：空</p></div>
      <div id="gym-controls" hidden><h2>健身房</h2><p id="gym-hand"></p><p id="gym-stats"></p><button id="gym-speed" type="button" hidden>切换速度</button><button id="gym-rep" type="button" hidden>举一次</button><p id="gym-breath"></p></div>
      <div id="dance-controls" hidden><h2>舞室</h2><p id="dance-hand"></p><button id="dance-music" type="button">播放节拍</button><button id="dance-tempo" type="button">120 BPM</button><button id="dance-start" type="button">对镜跳舞</button><button id="dance-practice" type="button">跟拍练习</button><p id="dance-sequence" aria-live="polite"></p><p id="dance-score"></p></div>
      <div id="perler-controls" hidden><h2>拼豆店</h2><p id="perler-hand"></p><p id="perler-count"></p><button id="perler-continue" type="button" hidden>继续拼豆</button></div>
      <div id="rehearsal-controls" hidden><h2>排练厅</h2><p id="rehearsal-state"></p></div>
      <div id="subway-controls" hidden><h2>五道口站</h2><p id="subway-state"></p></div>
      <div id="elevator-controls" hidden><h2>电梯间</h2><p id="elevator-state"></p></div>
    </aside>
  </main>`;

const modeElement = document.querySelector('#mode')!;
const hintElement = document.querySelector('#hint')!;
const interactButton = document.querySelector<HTMLButtonElement>('#interact')!;
const viewButton = document.querySelector<HTMLButtonElement>('#view')!;
const world = document.querySelector<HTMLElement>('.world')!;

class HutongScene extends Phaser.Scene {
  private frames: Record<string, SpriteFrame[]> = {};
  private groups: Record<Layer, Phaser.GameObjects.GameObject[]> = { room: [], desk: [], chair: [], laptop: [], decor: [], actor: [], anchors: [] };
  private layers: Record<Layer, boolean> = { room: true, desk: true, chair: true, laptop: true, decor: true, actor: true, anchors: false };
  private seats: Seat[] = [];
  private deskRows: DeskRow[] = [];
  private hawaiiDeskPieces: {desk: Phaser.GameObjects.Image[];panel: Phaser.GameObjects.Image[]}[] = [];
  private decorations: DeskDecoration[] = [];
  private furnitureScales: Record<FurnitureKind, { x: number; y: number }> = {
    desk: { x: 1, y: 1 }, chair: { x: 1, y: 1 }, laptop: { x: 1, y: 1 },
  };
  private actor = false;
  private room!: Phaser.GameObjects.Image;
  private keyInput!: Record<string, Phaser.Input.Keyboard.Key>;
  private actorX = SPAWN.x;
  private actorY = SPAWN.y;
  private facing: Facing = 0;
  private reverse = false;
  private mode: PreviewState['mode'] = 'standing';
  private seatedAt: Seat | null = null;
  private nearest: Seat | null = null;
  private motionTime = 0;
  private walkFrame = 0;
  private lastHud = '';

  constructor(key='hutong') { super(key); }
  private get isHawaii() { return this.sys.settings.key==='hawaii'; }
  private get workstations() { return this.isHawaii ? HAWAII_SEATS : WORKSTATIONS; }
  private officeWindow?: OfficeWindow;
  private officeGuest?: OfficeGuest;
  private aniGuest?: AniGuest;
  private guestSeatState='';
  private curtainDown=false;
  private curtainProgress=0;
  private nearWindow() { return this.isHawaii && !this.seatedAt && Math.hypot(this.actorX-78,this.actorY-184)<40; }
  private toggleCurtain() {
    if(!this.isHawaii)return;
    if(sharedAction('hawaii:curtain','toggle'))return;
    this.curtainDown=!this.curtainDown;
    this.tweens.killTweensOf(this);
    this.tweens.add({targets:this,curtainProgress:this.curtainDown?1:0,duration:450,ease:'Linear'});
    this.lastHud='';
  }
  preload() {
    if(!this.isHawaii)preloadAni(this);
    preloadOfficeGuests(this);
    for (const [key, url] of Object.entries(assets)) if(!this.textures.exists(key))this.load.image(key, url);
    if(this.isHawaii)this.load.image('hawaii-wall',new URL('../assets/drafts/hawaii-wall-v2.png',import.meta.url).href);
    this.load.image('rest-kit', new URL('../assets/drafts/rest-interaction-kit-v2.png', import.meta.url).href);
    this.load.image('held-water', new URL('../assets/props/water-bottle-v1.png', import.meta.url).href);
    this.load.on('loaderror', () => {
      const loading = document.querySelector('.loading');
      if (loading) loading.textContent = '加载失败，请刷新';
    });
  }
  private addSlice(key: string, frame: SpriteFrame, name: string, ratio: number, lower: boolean) {
    const height = Math.round(frame.height * ratio);
    if(this.textures.get(key).has(name))return;
    this.textures.get(key).add(name, 0, frame.x, lower ? frame.y + height : frame.y,
      frame.width, lower ? frame.height - height : height);
  }
  create() {
    registerProductTextures(this);
    this.cameras.main.setZoom(1 / PIXEL_RATIO).centerOn(VIEW_WIDTH / 2, VIEW_HEIGHT / 2);
    const furniture = registerRegions(this, 'furniture', [
      { name: 'desk-front', x0: 0, y0: 0, x1: 1, y1: .38 },
      { name: 'desk-back', x0: 0, y0: .38, x1: 1, y1: .65 },
      ...[0, .23, .40, .54, .68, .83].map((x0, index, starts) => ({
        name: `prop-${index}`, x0, y0: .65, x1: starts[index + 1] ?? 1, y1: 1,
      })),
    ]);
    this.frames.desk = furniture.slice(0, 2);
    this.frames.chair = furniture.slice(2, 4);
    this.frames.laptop = furniture.slice(4);
    this.frames.decor = registerRegions(this, 'decor', [
      { name: 'plant', x0: 0, y0: 0, x1: .64, y1: 1 },
      { name: 'cup', x0: .64, y0: 0, x1: 1, y1: 1 },
    ]);
    // One world-size contract per furniture type; state and camera changes keep
    // that same scale. Transparent margins never determine a prop's size.
    const size = (kind: FurnitureKind) => ({ width: Math.max(...this.frames[kind].map(f => f.width)),
      height: Math.max(...this.frames[kind].map(f => f.height)) });
    const deskSize = size('desk'), chairSize = size('chair'), laptopSize = size('laptop');
    this.furnitureScales.desk = { x: (this.isHawaii?448:METRICS.deskRowWidth) / deskSize.width, y: METRICS.deskHeight / deskSize.height };
    this.furnitureScales.chair = { x: METRICS.chairWidth / chairSize.width, y: METRICS.chairHeight / chairSize.height };
    this.furnitureScales.laptop = { x: METRICS.laptopWidth / laptopSize.width, y: METRICS.laptopWidth / laptopSize.width };
    registerRegions(this, 'rest-kit', [{ name: 'coffee-cup', x0: .76, x1: .99, y0: 0, y1: 1 }]);
    this.textures.get('held-water').add('bottle', 0, 6, 2, 6, 11);
    this.frames.desk.forEach((frame, index) => this.addSlice('furniture', frame, `panel-${index}`, .42, true));
    this.addSlice('furniture', this.frames.chair[0], 'backrest', .58, false);
    this.room = this.add.image(0, 0, this.isHawaii?'hawaii-wall':'wall').setOrigin(0).setDisplaySize(VIEW_WIDTH, VIEW_HEIGHT).setDepth(-100);
    this.groups.room.push(this.room);
    if(this.isHawaii)this.officeWindow=new OfficeWindow(this);
    for (const row of DESK_ROWS) {
      const workstation = this.workstations.find(seat => seat.row === row.row)!;
      const desk = this.add.image(0, 0, 'furniture'), panel = this.add.image(0, 0, 'furniture');
      this.deskRows.push({ ...row, footY: workstation.foot.y, desk, panel });
      this.groups.desk.push(desk, panel);
      if(this.isHawaii){
        const pieces={desk:[] as Phaser.GameObjects.Image[],panel:[] as Phaser.GameObjects.Image[]};
        for(let piece=0;piece<3;piece++){
          pieces.desk.push(this.add.image(0,0,'furniture'));
          pieces.panel.push(this.add.image(0,0,'furniture'));
        }
        this.hawaiiDeskPieces.push(pieces); this.groups.desk.push(...pieces.desk,...pieces.panel);
      }
    }
    for (const workstation of this.workstations) {
      const chair = this.add.image(0, 0, 'furniture'), back = this.add.image(0, 0, 'furniture', 'backrest');
      const laptop = this.add.image(0, 0, 'furniture');
      const label = this.add.text(0, 0, workstation.id, { fontFamily: 'Consolas', fontSize: '11px', color: '#f5f0c9',
        backgroundColor: '#26382d', padding: { x: 3, y: 1 } }).setOrigin(.5, 0).setDepth(900);
      this.seats.push({ ...workstation, chair, back, laptop, label });
      this.groups.chair.push(chair, back);
      this.groups.laptop.push(laptop); this.groups.anchors.push(label);
    }
    for (const row of ['culture', 'plain'] as const) {
      for (const x of [104, row === 'culture' ? 344 : 464]) {
        const image = this.add.image(0, 0, 'decor');
        this.decorations.push({ row, x, frame: 0, image }); this.groups.decor.push(image);
      }
      for (const x of row === 'culture' ? [194, 434] : [314, 477]) {
        const image = this.add.image(0, 0, 'decor');
        this.decorations.push({ row, x, frame: 1, image }); this.groups.decor.push(image);
      }
    }
    this.actor = true;
    this.keyInput = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.addCapture(['UP', 'DOWN', 'LEFT', 'RIGHT', 'SPACE']);
    const acceptsInput = () => this.sys.isActive() && (document.activeElement === world || document.activeElement === this.game.canvas);
    // Actions run once on the DOM keydown. They must not get lost between
    // Phaser's queued down/up processing during a very short key tap.
    const actionKey = (event: KeyboardEvent) => {
      if (!acceptsInput() || event.repeat) return;
      if (event.code === 'KeyE') {
        event.preventDefault();
        if (deskComputerOpen()) { closeDeskComputer(); return; }
        this.interact();
      }
      else if (event.code === 'Escape') {
        event.preventDefault();
        if (deskComputerOpen()) { closeDeskComputer(); return; }
        this.stand();
      }
      else if (!this.isHawaii && event.code === 'KeyV') { event.preventDefault(); this.switchView(); }
    };
    window.addEventListener('keydown', actionKey);
    const clearKeys = () => this.input.keyboard?.resetKeys();
    world.addEventListener('blur', clearKeys); window.addEventListener('blur', clearKeys);
    this.events.once('shutdown', () => {
      closeDeskComputer();
      world.removeEventListener('blur', clearKeys); window.removeEventListener('blur', clearKeys);
      window.removeEventListener('keydown', actionKey);
    });
    this.events.on('sleep', () => closeDeskComputer());
    // UI bindings must never block scene startup (the 「载入中…」 overlay is cleared at the end of create).
    try {
    world.addEventListener('pointerdown', () => world.focus());
    interactButton.addEventListener('click', () => { if (this.sys.isActive()) { this.interact(); world.focus(); } });
    viewButton.addEventListener('click', () => { if (this.sys.isActive()) { this.switchView(); world.focus(); } });
    document.querySelector('#reset')!.addEventListener('click', () => {
      if (!this.sys.isActive()) return;
      this.stand(); this.actorX = SPAWN.x; this.actorY = SPAWN.y; this.facing = 0; world.focus();
    });
    document.querySelector<HTMLButtonElement>('#walk-toggle')!.addEventListener('click', event => {
      if(!this.sys.isActive())return;
      const review = document.querySelector<HTMLElement>('#walk-review')!;
      review.hidden = !review.hidden;
      const button = event.currentTarget as HTMLButtonElement;
      button.setAttribute('aria-expanded', String(!review.hidden));
      button.textContent = review.hidden ? '查看步行动作' : '收起步行动作';
    });
    for (const checkbox of document.querySelectorAll<HTMLInputElement>('[data-layer]')) {
      checkbox.addEventListener('change', () => {
        if(!this.sys.isActive())return;
        const layer = checkbox.dataset.layer as Layer; this.layers[layer] = checkbox.checked;
        for (const object of this.groups[layer]) (object as Phaser.GameObjects.Image).setVisible(checkbox.checked);
        this.drawFurniture();
      });
    }
    } catch (error) { console.error('UI init failed in scene create', error); }
    this.drawFurniture();
    this.officeGuest=new OfficeGuest(this,this.isHawaii,this.workstations);
    if(!this.isHawaii)this.aniGuest=new AniGuest(this);
    this.events.on(Phaser.Scenes.Events.WAKE,()=>this.officeGuest?.enter(this.seatedAt?.id??null));
    this.drawFurniture();
    if(this.isHawaii)window.__hawaiiPreview={getState:()=>({...this.snapshot(),curtainDown:this.curtainDown,curtainProgress:this.curtainProgress,nearWindow:this.nearWindow()})};
    else window.__hutongPreview = { getState: () => this.snapshot() };
    document.querySelector('#curtain-control')?.addEventListener('click',()=>{if(this.sys.isActive()&&this.isHawaii){this.toggleCurtain();world.focus();}});
    document.querySelector('.loading')?.remove(); world.focus();
  }
  private snapshot(): PreviewState {
    const screen = project({ x: this.actorX, y: this.actorY }, this.reverse);
    return { hand: playerInventory.hand, heldItemVisible: !!playerInventory.hand, ready: true, view: this.reverse ? 'opposite' : 'culture', mode: this.mode,
      x: this.actorX, y: this.actorY, screenX: screen.x, screenY: screen.y,
      facing: this.facing, visualFacing: visualFacing(this.facing, this.reverse),
      seatedAt: this.seatedAt?.id ?? null, nearest: this.nearest?.id ?? null, seatCount: this.seats.length,
      walkFrame: this.walkFrame, texture: 'team-avatar', actorScale: 1,
      layers: { ...this.layers }, frameCounts: Object.fromEntries(Object.entries(this.frames).map(([key, value]) => [key, value.length])),
      metrics: this.isHawaii?{...METRICS,deskRowWidth:448,workstationWidth:448/3}:METRICS, deskRowCount: this.deskRows.length, projectionY: REVERSE_Y,
      framebuffer: { width: this.game.canvas.width, height: this.game.canvas.height },
      furnitureBounds: Object.fromEntries((['desk', 'chair', 'laptop'] as const).map(kind => [kind,
        this.frames[kind].map(frame => ({ width: frame.width * this.furnitureScales[kind].x,
          height: frame.height * this.furnitureScales[kind].y }))])) as PreviewState['furnitureBounds'],
      fps: Math.round(this.game.loop.actualFps) };
  }
  private switchView() {
    if(this.isHawaii)return;
    this.input.keyboard?.resetKeys(); this.reverse = !this.reverse; this.motionTime = 0;
    this.room.setTexture(this.reverse ? 'reverse' : 'wall').setDisplaySize(VIEW_WIDTH, VIEW_HEIGHT);
    viewButton.setAttribute('aria-pressed', String(this.reverse));
    for (const tab of document.querySelectorAll<HTMLElement>('[data-scene]')) tab.setAttribute('aria-pressed', String(tab.dataset.scene === (this.reverse ? 'opposite' : 'culture')));
    markScene('胡同');
    this.drawFurniture();
  }
  public selectView(reverse: boolean) {
    if (this.reverse !== reverse) this.switchView();
    this.lastHud = '';
  }
  private drawFurniture() {
    for (const [rowNumber,row] of this.deskRows.entries()) {
      const point = project({ x: VIEW_WIDTH / 2, y: row.footY }, this.reverse);
      const far = visualFacing(row.facing, this.reverse) === 2;
      const index = far ? 0 : 1, frame = this.frames.desk[index], scale = this.furnitureScales.desk;
      const bottom = this.reverse ? REVERSE_Y - row.floorStart : row.floorEnd;
      row.desk.setTexture('furniture', frame.name).setOrigin(.5, 1).setScale(scale.x, scale.y).setFlipX(this.reverse)
        .setPosition(point.x, bottom).setDepth(far ? bottom - 4 : point.y + 3).setVisible(this.layers.desk);
      if(this.isHawaii){
        const parts=this.hawaiiDeskPieces[rowNumber];
        const atlas=this.textures.get('furniture');
        for(const [piece,sourceBay] of [0,1,3].entries()){
          const left=Math.round(frame.width*sourceBay/4),right=Math.round(frame.width*(sourceBay+1)/4);
          const name=`hawaii-desk-${index}-${piece}`;
          if(!atlas.has(name))atlas.add(name,0,frame.x+left,frame.y,right-left,frame.height);
          const partX=320-224+(piece+.5)*(448/3);
          parts.desk[piece].setTexture('furniture',name).setOrigin(.5,1).setDisplaySize(448/3,frame.height*scale.y)
            .setPosition(partX,bottom).setDepth(far?bottom-4:point.y+3).setVisible(this.layers.desk);
          const nativePanel=atlas.get(`panel-${index}`),panelName=`hawaii-panel-${index}-${piece}`;
          if(!atlas.has(panelName))atlas.add(panelName,0,nativePanel.cutX+left,nativePanel.cutY,right-left,nativePanel.cutHeight);
          parts.panel[piece].setTexture('furniture',panelName).setOrigin(.5,1).setDisplaySize(448/3,nativePanel.cutHeight*scale.y)
            .setPosition(partX,bottom).setDepth(point.y+5).setVisible(this.layers.desk&&!far);
        }
        row.desk.setVisible(false);
      }
      row.panel.setTexture('furniture', `panel-${index}`).setOrigin(.5, 1).setScale(scale.x, scale.y).setFlipX(this.reverse)
        .setPosition(point.x, bottom).setDepth(point.y + 5).setVisible(this.layers.desk && !far && !this.isHawaii);
    }
    for (const seat of this.seats) {
      const point = project(seat.foot, this.reverse), far = visualFacing(seat.facing, this.reverse) === 2;
      const index = far ? 0 : 1;
      const chairFrame = this.frames.chair[index];
      const chairScale = this.furnitureScales.chair;
      seat.chair.setTexture('furniture', chairFrame.name).setOrigin(.5, 1).setScale(chairScale.x, chairScale.y);
      seat.chair.setPosition(point.x, point.y).setDepth(point.y).setVisible(this.layers.chair);
      const backrestFrame = this.frames.chair[0];
      seat.back.setTexture('furniture', 'backrest').setOrigin(.5, 0).setScale(chairScale.x, chairScale.y)
        .setPosition(point.x, point.y - backrestFrame.height * chairScale.y)
        .setDepth(point.y + 2).setVisible(this.layers.chair && far && (this.seatedAt === seat||!!this.officeGuest?.occupies(seat.id)));
      const computerIndex = index * 2 + Number(this.seatedAt===seat&&this.mode==='working'||!!onlineWorld()?.bridge.players.some(p=>p.scene===this.sys.settings.key&&p.seat===seat.id&&canWorkAt(p.role,p.scene,p.seat)));
      const laptopScale = this.furnitureScales.laptop;
      const computerPoint = project({ x: seat.foot.x, y: scaleRowPoint({ x: 0, y: floorY(seat.row === 'culture' ? 35 : 305) }, seat.row).y }, this.reverse);
      seat.laptop.setTexture('furniture', this.frames.laptop[computerIndex].name).setOrigin(.5, 1)
        .setScale(laptopScale.x, laptopScale.y).setPosition(computerPoint.x, computerPoint.y - 75 * HEIGHT_PROJECTION * CONTENT_SCALE)
        .setDepth(point.y + (far ? -2 : 6)).setVisible(this.layers.laptop);
      const ownDesk = this.seatedAt === seat && this.mode === 'working' && this.sys.isActive();
      seat.laptop.removeAllListeners('pointerdown');
      if (ownDesk) {
        seat.laptop.setInteractive({ useHandCursor: true }).on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          if (!this.sys.isActive() || deskComputerOpen()) return;
          pointer.event?.stopPropagation?.();
          openDeskComputer();
        });
      } else {
        seat.laptop.disableInteractive();
      }
      const stand = project(seat.stand, this.reverse);
      seat.label.setPosition(stand.x, stand.y + 4).setVisible(this.layers.anchors);
    }
    for (const decoration of this.decorations) {
      const seat = this.workstations.find(seat => seat.row === decoration.row)!;
      const far = visualFacing(seat.facing, this.reverse) === 2;
      const point = project(scaleRowPoint({ x: decoration.x + (decoration.frame === 1 ? 15 : 0), y: floorY(decoration.row === 'culture' ? 40 : 300) }, decoration.row), this.reverse);
      const frame = this.frames.decor[decoration.frame];
      setSpriteFrame(decoration.image, 'decor', frame, (decoration.frame === 0 ? 36 : 14) * CONTENT_SCALE);
      decoration.image.setPosition(point.x, point.y - 75 * HEIGHT_PROJECTION * CONTENT_SCALE)
        .setDepth(project(seat.foot, this.reverse).y + (far ? -3 : 7)).setVisible(this.layers.decor);
    }
  }
  private interact() {
    if (deskComputerOpen()) { closeDeskComputer(); return; }
    if (this.seatedAt) { this.stand(); return; }
    if(this.nearWindow()){this.toggleCurtain();return;}
    if(this.nearGuest()){this.officeGuest!.interact({x:this.actorX,y:this.actorY});this.lastHud='';this.drawFurniture();return;}
    const seat = this.findNearest();
    if (!seat) return;
    this.seatedAt = seat;
    this.actorX = this.seatedAt.foot.x; this.actorY = this.seatedAt.foot.y;
    this.facing = this.seatedAt.facing; this.mode = canWorkAt(onlineWorld()?.bridge.user?.role??'laura',this.sys.settings.key,seat.id)?'working':'sit'; this.motionTime = 0;
    this.drawFurniture();
  }
  private findNearest(): Seat | null {
    return this.seats.reduce<Seat | null>((nearest, seat) => {
      if(this.officeGuest?.occupies(seat.id))return nearest;
      const distance = Math.hypot(this.actorX - seat.foot.x, this.actorY - seat.foot.y);
      if (distance > 43) return nearest;
      return !nearest || distance < Math.hypot(this.actorX - nearest.foot.x, this.actorY - nearest.foot.y) ? seat : nearest;
    }, null);
  }
  private nearGuest(){if(!this.officeGuest?.near(this.actorX,this.actorY))return false;const guest=this.officeGuest.snapshot(),seat=this.findNearest();return !seat||Math.hypot(this.actorX-guest.x,this.actorY-guest.y)<Math.hypot(this.actorX-seat.stand.x,this.actorY-seat.stand.y);}
  private stand() {
    if (!this.seatedAt) return;
    closeDeskComputer();
    const seat = this.seatedAt;
    this.actorX = seat.stand.x; this.actorY = seat.stand.y;
    if(this.officeGuest?.blocks(this.actorX,this.actorY)){
      const clear=[{x:this.actorX+30,y:this.actorY},{x:this.actorX-30,y:this.actorY}].find(p=>canWalk(p,this.workstations)&&!this.officeGuest?.blocks(p.x,p.y));
      if(clear){this.actorX=clear.x;this.actorY=clear.y;}
    }
    this.seatedAt = null; this.mode = 'standing'; this.motionTime = 0;
    this.drawFurniture();
  }
  // The player is rendered only by the multiplayer TeamAvatar; this tracks the walk phase for state snapshots.
  private drawActor() {
    this.walkFrame = this.seatedAt ? 0 : this.mode === 'walking' ? Math.floor(this.motionTime / 125) % 4 : 0;
  }
  update(_time: number, delta: number) {
    if (!this.actor) return;
    const active = document.activeElement === world || document.activeElement === this.game.canvas;
    const key = (name: string) => active && this.keyInput[name].isDown;
    const screenDx = Number(key('D') || key('RIGHT')) - Number(key('A') || key('LEFT'));
    const screenDy = Number(key('S') || key('DOWN')) - Number(key('W') || key('UP'));
    const dx = this.reverse ? -screenDx : screenDx, dy = this.reverse ? -screenDy : screenDy;
    if (this.seatedAt) this.motionTime += Math.min(delta, 50);
    else {
      const oldX = this.actorX, oldY = this.actorY, oldFacing = this.facing;
      if (dx || dy) {
        this.facing = (dx === 0 ? (dy > 0 ? 0 : 2) : (dx > 0 ? 1 : 3)) as Facing;
        const distance = 108 * Math.min(delta, 32) / 1000 / Math.hypot(dx, dy);
        const nextX = this.actorX + dx * distance, nextY = this.actorY + dy * distance;
        if (canWalk({ x: nextX, y: this.actorY },this.workstations)&&!this.officeGuest?.blocks(nextX,this.actorY)&&!this.aniGuest?.blocks(nextX,this.actorY,{x:this.actorX,y:this.actorY})) this.actorX = nextX;
        if (canWalk({ x: this.actorX, y: nextY },this.workstations)&&!this.officeGuest?.blocks(this.actorX,nextY)&&!this.aniGuest?.blocks(this.actorX,nextY,{x:this.actorX,y:this.actorY})) this.actorY = nextY;
      }
      const moved = Math.hypot(this.actorX - oldX, this.actorY - oldY) > .001;
      if (moved) {
        if (this.mode !== 'walking' || this.facing !== oldFacing) this.motionTime = 0;
        else this.motionTime += Math.min(delta, 50);
        this.mode = 'walking';
      } else { this.mode = 'standing'; this.motionTime = 0; }
    }
    this.drawActor();
    this.officeGuest?.update(delta,{x:this.actorX,y:this.actorY,seat:this.seatedAt?.id??null});
    const guestSeat=JSON.stringify([this.officeGuest?.snapshot().mode,onlineWorld()?.bridge.players.filter(p=>p.scene===this.sys.settings.key&&canWorkAt(p.role,p.scene,p.seat)).map(p=>p.seat).sort()]);
    if(guestSeat!==this.guestSeatState){this.guestSeatState=guestSeat;this.lastHud='';this.drawFurniture();}
    this.officeGuest?.draw(this.reverse,this.layers.actor);
    this.aniGuest?.draw(this.reverse,this.layers.actor);
    this.nearest = this.findNearest();
    this.officeWindow?.draw(this.curtainProgress,this.layers.room);
    const nearGuest=!this.seatedAt&&this.nearGuest();
    const hud = `${nearGuest}:${this.officeGuest?.prompt}:${this.nearWindow()}:${this.curtainDown}:${this.mode}:${this.nearest?.id}:${this.seatedAt?.id}:${this.reverse}`;
    if (hud !== this.lastHud) {
      this.lastHud = hud;
      modeElement.textContent = '';
      hintElement.textContent = this.seatedAt ? (this.mode==='working'?'点电脑 · Esc 起身':'Esc 起身') : this.nearest ? 'E 坐下' : 'E 坐下';
      interactButton.disabled = !this.seatedAt && !this.nearest;
      interactButton.textContent = this.seatedAt ? '起身' : this.nearest ? `坐到 ${this.nearest.id}` : '';
      setGuide('WASD / 方向键移动 · V 换视角', this.seatedAt ? (this.mode==='working'?'点电脑 · E 起身':'E 起身') : this.nearest ? `E · ${this.nearest.id} ${canWorkAt(onlineWorld()?.bridge.user?.role??'laura',this.sys.settings.key,this.nearest.id)?'办公':'坐下'}` : 'E 坐下');
      document.querySelector('#seat-state')!.textContent = this.seatedAt ? '' : this.isHawaii?'':'';
      if(this.isHawaii){
        modeElement.textContent=this.mode==='working'?`在 ${this.seatedAt!.id} 办公`:this.mode==='sit'?`坐在 ${this.seatedAt!.id} 休息`:this.mode==='walking'?'在夏威夷走动':'站在夏威夷';
        setGuide('WASD / 方向键移动', this.seatedAt ? (this.mode==='working'?'点电脑 · E 起身':'E 起身') : this.nearest ? `E · ${this.nearest.id} ${canWorkAt(onlineWorld()?.bridge.user?.role??'laura',this.sys.settings.key,this.nearest.id)?'办公':'坐下'}` : 'E 坐下');
        if(this.nearWindow()){
          interactButton.disabled=false;interactButton.textContent=this.curtainDown?'卷起窗帘':'拉下窗帘';
          hintElement.textContent=`E ${interactButton.textContent}`;
          setGuide('WASD / 方向键移动', `E · ${interactButton.textContent}`);
        }
        document.querySelector('#curtain-control')!.textContent=this.curtainDown?'卷起窗帘':'拉下窗帘';
      }
      if(nearGuest&&!this.nearWindow()){
        interactButton.disabled=false;interactButton.textContent=this.officeGuest!.prompt;
        hintElement.textContent=`E ${this.officeGuest!.prompt}`;
        setGuide('WASD / 方向键移动', `E · ${this.officeGuest!.prompt}`);
      }
    }
  }
}

holdScene();
const game = new Phaser.Game({ type: Phaser.AUTO, width: VIEW_WIDTH / PIXEL_RATIO, height: VIEW_HEIGHT / PIXEL_RATIO, parent: 'game', backgroundColor: '#333936',
  pixelArt: true, roundPixels: true, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [new HutongScene(), RestRoomScene, PopMartScene, new HutongScene('hawaii'), BathroomScene, ConcertScene, ArcadeScene, NoodleShopScene, GymScene, DanceStudioScene, PerlerShopScene, RehearsalScene, ElevatorLobbyScene, SubwayScene, KtvScene], input: { keyboard: true }, banner: false,
});
let selectedSceneKey='hutong';
game.events.once('ready',()=>{try{startSocial(game);}catch(error){console.error('startSocial failed',error);}try{mountTouchControls();}catch(error){console.error('touch controls failed',error);}});
game.events.once('ready',()=>{
  for(const key of ['hutong','rest','pop','hawaii','bathroom','concert','arcade','noodle','gym','dance','perler','rehearsal','elevator','subway','ktv']){
    const scene=game.scene.getScene(key);
    scene.events.on('create',()=>{if(key!==selectedSceneKey)game.scene.sleep(key);});
  }
});
let navigationAuthorized=false;
window.addEventListener('hutong:navigate',event=>{navigationAuthorized=true;try{document.querySelector<HTMLButtonElement>(`[data-scene="${(event as CustomEvent).detail}"]`)?.click();}finally{navigationAuthorized=false;}});
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-scene]')) button.addEventListener('click', () => {
  if(!navigationAuthorized&&!((import.meta as any).env.DEV&&location.search.includes('debug=1')))return;
  const target = button.dataset.scene!;
  const ktv=target==='ktv';
  world.dataset.area=target;
  for (const tab of document.querySelectorAll('[data-scene]')) tab.setAttribute('aria-pressed', String(tab === button));
  const rest = target === 'rest', pop = target === 'pop', hawaii=target==='hawaii', bathroom=target==='bathroom', concert=target==='concert', arcade=target==='arcade', noodle=target==='noodle', gym=target==='gym', dance=target==='dance', perler=target==='perler', rehearsal=target==='rehearsal', elevator=target==='elevator', subway=target==='subway';
  document.querySelector<HTMLElement>('#curtain-control')!.hidden=!hawaii;
  const updateLayerLabel=(layer:string,label:string)=>{
    const input=document.querySelector<HTMLInputElement>(`[data-layer="${layer}"]`)!;
    input.parentElement!.lastChild!.textContent=label;
  };
  updateLayerLabel('chair',hawaii?'六把独立网椅':'八把独立网椅');
  updateLayerLabel('laptop',hawaii?'六台独立电脑':'八台独立电脑');
  document.querySelector('#hutong-controls .review-actions + .note')!.textContent='';
  document.querySelector('#hutong-controls .seat-state + .note')!.textContent='';
  document.querySelector<HTMLElement>('#hutong-controls')!.hidden = rest || pop || bathroom || concert || arcade || noodle || gym || dance || perler || rehearsal || elevator || subway || ktv;
  document.querySelector<HTMLElement>('#rest-controls')!.hidden = !rest;
  document.querySelector<HTMLElement>('#pop-controls')!.hidden = !pop;
  viewButton.hidden = rest || pop || hawaii || bathroom || concert || arcade || noodle || gym || dance || perler || rehearsal || elevator || subway || ktv;
  document.querySelector<HTMLButtonElement>('#table-action')!.hidden = true;
  document.querySelector<HTMLElement>('#walk-review')!.hidden = true;
  markScene(hawaii?'夏威夷':pop ? 'POP MART' : rest ? '休息室' : '胡同');
  setGuide('WASD / 方向键移动', hawaii?'E 坐下 / 起身 · 窗边 E 卷帘':pop?'E 挑盒 / 转动扭蛋机':rest?'E 互动':'E 坐下 · V 换视角');
  document.querySelector('.scene-caption span:last-child')!.textContent='';
  document.querySelector('.keys')!.innerHTML = hawaii?'WASD / 方向键移动<br>E 坐下 / 起身 · 窗边 E 卷帘<br>Esc 起身':pop ? 'WASD / 方向键移动<br>E 挑盒 / 转动扭蛋机<br>点击选盒 · Esc 关闭' : rest ? 'WASD / 方向键移动<br>E 与物件互动 · Esc 起身<br>坐着时 F 放下 / 拿回物品' : 'WASD / 方向键移动<br>E 坐下办公 / 起身 · V 换视角';
  document.querySelector<HTMLElement>('#bathroom-controls')!.hidden=!bathroom;
  if(bathroom){
    markScene('厕所');
    setGuide('WASD / 方向键移动', 'E 开门 / 坐下 · E 洗手');
    document.querySelector('.scene-caption span:last-child')!.textContent='';
    document.querySelector('.keys')!.innerHTML='WASD / 方向键移动<br>E 开门 / 坐下 / 起身<br>F 开关门 起身<br>洗手台 E 洗手';
  }
  document.querySelector<HTMLElement>('#concert-controls')!.hidden=!concert;
  if(concert){
    markScene('演唱会');
    setGuide('WASD / 方向键移动', 'E 坐下');
    document.querySelector('.scene-caption span:last-child')!.textContent='';
    document.querySelector('.keys')!.innerHTML='WASD / 方向键移动<br>E 坐下 / 起身 起身';
  }
  document.querySelector<HTMLElement>('#arcade-controls')!.hidden=!arcade;
  if(arcade){
    markScene('娱乐室');
    setGuide('WASD / 方向键移动', 'E 玩游戏');
    document.querySelector('.scene-caption span:last-child')!.textContent='';
    document.querySelector('.keys')!.innerHTML='WASD / 方向键移动<br>E 玩游戏 · Esc 返回';
  }
  document.querySelector<HTMLElement>('#noodle-controls')!.hidden=!noodle;
  if(noodle){
    markScene('米线店');
    setGuide('WASD / 方向键移动', 'E 互动');
    document.querySelector('.scene-caption span:last-child')!.textContent='';
    document.querySelector('.keys')!.innerHTML='WASD / 方向键移动<br>E 取餐 / 坐下 / 起身<br>F 桌上物品 / 调料 · Esc 起身';
  }
  document.querySelector<HTMLElement>('#gym-controls')!.hidden=!gym;
  if(gym){
    markScene('健身房');
    setGuide('WASD / 方向键移动', 'E 使用');
    document.querySelector('.scene-caption span:last-child')!.textContent='';
    document.querySelector('.keys')!.innerHTML='WASD / 方向键移动<br>E 使用 / 结束 · Esc 结束<br>跑步 F 调速 · 哑铃 Space 举起';
  }
  document.querySelector<HTMLElement>('#dance-controls')!.hidden=!dance;
  if(dance){
    markScene('舞室');
    setGuide('WASD / 方向键移动', 'E 跳舞');
    document.querySelector('.scene-caption span:last-child')!.textContent='';
    document.querySelector('.keys')!.innerHTML='WASD / 方向键移动<br>E 跳舞 / 互动 · Esc 结束<br>F 调速 · 跟拍时按方向键';
  }
  document.querySelector<HTMLElement>('#perler-controls')!.hidden=!perler;
  if(perler){
    markScene('拼豆店');
    setGuide('WASD / 方向键移动', 'E 拼豆');
    document.querySelector('.scene-caption span:last-child')!.textContent='';
    document.querySelector('.keys')!.innerHTML='WASD / 方向键移动<br>E 坐下 / 互动 · Esc 返回 / 起身<br>F 继续拼豆 · 点击或拖动放豆';
  }
  document.querySelector<HTMLElement>('#rehearsal-controls')!.hidden=!rehearsal;
  if(rehearsal){
    markScene('排练厅');
    setGuide('WASD / 方向键移动', '');
    document.querySelector('.scene-caption span:last-child')!.textContent='';
    document.querySelector('.keys')!.innerHTML='WASD / 方向键移动<br>E 坐下 / 互动 · Esc 起身<br>弹琴时 A W S R D F T G Y H U J K';
  }
  document.querySelector<HTMLElement>('#elevator-controls')!.hidden=!elevator;
  if(elevator){
    markScene('电梯间');
    setGuide('WASD / 方向键移动', 'E 开关门');
    document.querySelector('.scene-caption span:last-child')!.textContent='';
    document.querySelector('.keys')!.innerHTML='WASD / 方向键移动<br>E 开关附近电梯门';
  }
  document.querySelector<HTMLElement>('#subway-controls')!.hidden=!subway;
  if(subway){
    markScene('五道口站');
    setGuide('WASD / 方向键移动', 'E 开关车门');
    document.querySelector('.scene-caption span:last-child')!.textContent='';
    document.querySelector('.keys')!.innerHTML='WASD / 方向键移动<br>E 开关列车车门';
  }
  if(ktv){markScene('KTV');setGuide('WASD / 方向键移动','E 点歌 / 拿麦 / 坐下');document.querySelector('.keys')!.innerHTML='WASD / 方向键移动<br>E 点歌 / 拿麦 / 坐下 / 灯光<br>拿麦后 Space 唱一拍 · Esc 结束';}
  const activeKey = ktv?'ktv':subway?'subway':elevator?'elevator':rehearsal?'rehearsal' :perler?'perler' :dance?'dance' :gym?'gym' :noodle?'noodle':arcade?'arcade':concert?'concert':bathroom?'bathroom':hawaii?'hawaii':pop ? 'pop' : rest ? 'rest' : 'hutong';
  selectedSceneKey=activeKey;
  for (const key of ['hutong', 'rest', 'pop', 'hawaii', 'bathroom', 'concert', 'arcade', 'noodle', 'gym', 'dance', 'perler', 'rehearsal', 'elevator', 'subway', 'ktv']) {
    const scene = game.scene.getScene(key);
    scene.input.keyboard?.resetKeys();
    if (key !== activeKey && game.scene.isActive(key)) game.scene.sleep(key);
  }
  // Phaser run() restarts an already active scene; viewpoint tabs share Hutong.
  if(!game.scene.isActive(activeKey))game.scene.run(activeKey);
  if (activeKey === 'hutong') (game.scene.getScene('hutong') as HutongScene).selectView(target === 'opposite');
  world.focus();
});


