import {sceneWalkable} from '../shared/walkability.mjs';
import Phaser from 'phaser';
import { registerRegions, type SpriteFrame } from './frames';
import { CONTENT_SCALE, METRICS, PIXEL_RATIO } from './layout';

import { playerInventory, items, vendingProducts, fridgeDefaults, type ItemName } from './player-inventory';
import { registerProductTextures } from './product-textures';
import {sharedAction,onlineWorld} from './multiplayer/world-client';

const restPoint = (x: number, y: number, equipment = false) => {
  const anchorX = equipment ? 65 : 320, anchorY = equipment ? 100 : 287;
  return { x: anchorX + (x - anchorX) * CONTENT_SCALE + (equipment ? 24 : 0), y: anchorY + (y - anchorY) * CONTENT_SCALE };
};
const tableOrigins = [170, 370, 570];
const tableCenters = tableOrigins.map(x => restPoint(x, 282).x);
const tableFloorY = restPoint(0, 262).y;
const tableCollision = { radiusX: 94 * CONTENT_SCALE / 2 + 6, radiusY: 24 * CONTENT_SCALE + 5 };
const tableCapacity = 6;
const chairSeats = tableCenters.flatMap(center => [-23, 23].map(offset => ({
  x: center + offset, y: restPoint(0, 224).y, facing: 0,
  approach: { x: center + offset, y: 215 },
})));

type Target = { id: string; name: string; kind: 'coffee' | 'fridge' | 'vending' | 'table' | 'chair'; x: number; y: number; index?: number };
declare global { interface Window { __restPreview?: { getState: () => unknown } } }

export class RestRoomScene extends Phaser.Scene {
  private actor = false;
  private fridge!: Phaser.GameObjects.Image;
  private fridgeDoor!: Phaser.GameObjects.Graphics;
  private fridgeItems: (ItemName | null)[] = [...fridgeDefaults, ...Array(6).fill(null)];
  private machineCup!: Phaser.GameObjects.Image;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private x = 554; private y = 184; private facing = 0; private motionTime = 0;
  private seated: number | null = null;
  private brewing = false;
  private get hand(): ItemName | null { return playerInventory.hand; }
  private set hand(value: ItemName | null) { playerInventory.hand = value; }
  private coffeeReady = false;
  private brewTimer?: Phaser.Time.TimerEvent;
  private tableItems: (ItemName | null)[][] = tableCenters.map(() => Array(tableCapacity).fill(null));
  private tableSprites: Phaser.GameObjects.Image[] = [];
  private groups: Record<string, Phaser.GameObjects.Image[]> = { equipment: [], tables: [], chairs: [] };
  private targets: Target[] = [
    { id: 'vending', kind: 'vending' as const, name: '贩卖机', ...restPoint(102, 163, true) },
    { id: 'fridge', kind: 'fridge' as const, name: '冰箱', ...restPoint(179, 163, true) },
    { id: 'coffee', kind: 'coffee' as const, name: '咖啡机', ...restPoint(346, 157, true) },
    ...tableCenters.map((x, index): Target => ({ id: `table-${index + 1}`, kind: 'table', name: `餐桌 ${index + 1}`, x, y: 245, index })),
    ...chairSeats.map((seat, index): Target => ({ id: `chair-${index + 1}`, kind: 'chair', name: `椅子 ${index + 1}`, ...seat.approach, index })),
  ];
  constructor() { super('rest'); }
  preload() {
    const load = (key: string, url: string) => { if (!this.textures.exists(key)) this.load.image(key, url); };
    load('rest-shell', new URL('../assets/drafts/rest-room-shell-v2.png', import.meta.url).href);
    load('rest-props', new URL('../assets/drafts/rest-props-v1.png', import.meta.url).href);
    load('rest-kit', new URL('../assets/drafts/rest-interaction-kit-v2.png', import.meta.url).href);
    load('held-water', new URL('../assets/props/water-bottle-v1.png', import.meta.url).href);
  }
  create() {
    registerProductTextures(this);
    this.cameras.main.setZoom(1 / PIXEL_RATIO).centerOn(320, 180);
    this.add.image(0, 0, 'rest-shell').setOrigin(0).setDisplaySize(640, 360).setDepth(-100);
    const props = registerRegions(this, 'rest-props', [
      { name: 'vending', x0: 0, y0: 0, x1: .29, y1: .55 },
      { name: 'fridge', x0: .30, y0: 0, x1: .53, y1: .55 },
      { name: 'counter', x0: .55, y0: 0, x1: 1, y1: .55 },
      { name: 'coffee', x0: 0, y0: .57, x1: .33, y1: 1 },
      { name: 'table', x0: .34, y0: .57, x1: .67, y1: 1 },
      { name: 'chair', x0: .68, y0: .57, x1: 1, y1: 1 },
    ]);
    const kit = registerRegions(this, 'rest-kit', ['chair-right', 'chair-left', 'empty-machine', 'coffee-cup'].map((name, i) => ({ name, x0: i / 4 + .01, x1: (i + 1) / 4 - .01, y0: 0, y1: 1 })));
    const prop = (index: number, x: number, y: number, width: number, height: number, group: string, depth = y) => {
      const point = restPoint(x, y, group === 'equipment');
      const image = this.add.image(point.x, point.y, 'rest-props', props[index].name).setOrigin(.5, 1).setDisplaySize(width * CONTENT_SCALE, height * CONTENT_SCALE).setDepth(restPoint(x, depth, group === 'equipment').y);
      this.groups[group].push(image); return image;
    };
    prop(0, 102, 139, 74, 132, 'equipment');
    this.fridge = prop(1, 179, 139, 67, 125, 'equipment');
    this.fridgeDoor = this.add.graphics().setDepth(this.fridge.depth + .5).setVisible(false);
    prop(2, 359, 139, 283, 79, 'equipment');
    const machinePoint = restPoint(346, 64, true);
    machinePoint.y += 6;
    this.groups.equipment.push(this.add.image(machinePoint.x, machinePoint.y, 'rest-kit', kit[2].name).setOrigin(.5, 1).setDisplaySize(37 * CONTENT_SCALE, 47 * CONTENT_SCALE).setDepth(133));
    this.machineCup = this.add.image(machinePoint.x - 4, machinePoint.y - 2, 'rest-kit', kit[3].name).setOrigin(.5, 1).setDisplaySize(7, 7).setDepth(134).setVisible(false);
    if (!this.textures.get('held-water').has('bottle')) this.textures.get('held-water').add('bottle', 0, 6, 2, 6, 11);
    // Plants remain separate decorations on the counter, rather than baked in.
    for (const x of [268, 465]) {
      const point = restPoint(x, 64, true);
      this.groups.equipment.push(this.add.image(point.x, point.y, 'decor', 'plant').setOrigin(.5, 1).setDisplaySize(31 * CONTENT_SCALE, 35 * CONTENT_SCALE).setDepth(restPoint(x, 140, true).y));
    }
    for (const x of tableOrigins) {
      prop(4, x, 282, 94, 78, 'tables', 262);
      for (let slot = 0; slot < tableCapacity; slot++) {
        const point = restPoint(x, 218);
        this.tableSprites.push(this.add.image(point.x + (slot - 2.5) * 11, point.y - 3,
          'rest-kit', kit[3].name).setOrigin(.5, 1).setDepth(tableFloorY + .2).setVisible(false));
      }
    }
    for (const seat of chairSeats) {
      this.groups.chairs.push(this.add.image(seat.x, seat.y, 'rest-props', props[5].name)
        .setOrigin(.5, 1).setDisplaySize(44 * CONTENT_SCALE, 56 * CONTENT_SCALE).setDepth(seat.y));
    }
    this.actor = true;
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
    const world = document.querySelector<HTMLElement>('.world')!;
    const action = (event: KeyboardEvent) => {
      if (!this.sys.isActive() || event.repeat) return;
      if (this.fridgeMenu.open) {
        if (event.key >= '1' && event.key <= '9') { event.preventDefault(); this.takeFridgeItem(Number(event.key) - 1); }
        else if (event.code === 'KeyF') { event.preventDefault(); this.storeFridgeItem(); }
        else if (event.code === 'KeyE') { event.preventDefault(); this.fridgeMenu.close(); }
        return;
      }
      if (this.tableMenu.open) {
        if (event.key >= '1' && event.key <= '6') { event.preventDefault(); this.takeTableItem(Number(this.tableMenu.dataset.table), Number(event.key) - 1); }
        else if (event.code === 'KeyE' || event.code === 'KeyF') { event.preventDefault(); this.tableMenu.close(); }
        return;
      }
      if (this.vendingMenu.open) {
        const index = Number(event.key) - 1;
        if (event.key >= '1' && event.key <= '6') { event.preventDefault(); this.takeProduct(vendingProducts[index]); }
        else if (event.code === 'KeyE') { event.preventDefault(); this.vendingMenu.close(); }
        return;
      }
      if ((document.activeElement !== world && document.activeElement !== this.game.canvas)) return;
      if (event.code === 'KeyE') { event.preventDefault(); this.interact(); }
      if (event.code === 'KeyF' && this.seated !== null) { event.preventDefault(); this.useTable(Math.floor(this.seated / 2)); }
      if (event.code === 'Escape') this.stand();
    };
    const products = document.querySelector('#vending-products')!;
    products.innerHTML = vendingProducts.map((name, index) => `<button type="button" data-product="${name}" aria-label="免费领取${name}"><span class="stock-row"><img alt=""/><img alt=""/><img alt=""/></span><span class="shelf-label">${index + 1} ${name}</span></button>`).join('');
    for (const button of products.querySelectorAll<HTMLButtonElement>('button')) {
      const name = button.dataset.product as ItemName;
      const item = items[name];
      const texture = this.textures.get(item.texture);
      const frame = texture.get(item.frame);
      const source = texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
      const canvas = document.createElement('canvas'); canvas.width = frame.cutWidth; canvas.height = frame.cutHeight;
      canvas.getContext('2d')!.drawImage(source, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, 0, 0, canvas.width, canvas.height);
      for (const image of button.querySelectorAll('img')) image.src = canvas.toDataURL();
      button.addEventListener('click', () => this.takeProduct(name));
    }
    document.querySelector('#vending-close')!.addEventListener('click', () => this.vendingMenu.close());
    this.vendingMenu.addEventListener('close', () => { this.input.keyboard?.resetKeys(); world.focus(); });
    document.querySelector('#table-close')!.addEventListener('click', () => this.tableMenu.close());
    this.tableMenu.addEventListener('close', () => { this.input.keyboard?.resetKeys(); world.focus(); });
    document.querySelector('#fridge-close')!.addEventListener('click', () => this.fridgeMenu.close());
    document.querySelector('#fridge-store')!.addEventListener('click', () => this.storeFridgeItem());
    this.fridgeMenu.addEventListener('close', () => { if(onlineWorld()?.objects.get('rest:fridge-door')?.open)sharedAction('rest:fridge-door','toggle');this.fridgeDoor.setVisible(false); this.input.keyboard?.resetKeys(); world.focus(); });
    window.addEventListener('keydown', action);
    const clear = () => this.input.keyboard?.resetKeys();
    world.addEventListener('blur', clear); window.addEventListener('blur', clear);
    document.querySelector('#table-action')!.addEventListener('click', () => { if (this.sys.isActive() && this.seated !== null) { this.useTable(Math.floor(this.seated / 2)); world.focus(); } });
    document.querySelector('#interact')!.addEventListener('click', () => { if (this.sys.isActive()) { this.interact(); world.focus(); } });
    document.querySelector('#rest-reset')!.addEventListener('click', () => {
      if (!this.sys.isActive()) return;
      this.brewTimer?.remove(); this.brewing = false; this.coffeeReady = false;
      this.stand(); this.x = 554; this.y = 184; this.hand = null; this.tableItems.forEach(table => table.fill(null)); this.fridgeItems = [...fridgeDefaults, ...Array(6).fill(null)];
      this.message(''); world.focus();
    });
    for (const checkbox of document.querySelectorAll<HTMLInputElement>('[data-rest-layer]')) checkbox.addEventListener('change', () => {
      for (const image of this.groups[checkbox.dataset.restLayer!]) image.setVisible(checkbox.checked);
    });
    this.events.once('shutdown', () => { window.removeEventListener('keydown', action); world.removeEventListener('blur', clear); window.removeEventListener('blur', clear); });
    this.events.on('sleep', () => { clear(); if (this.vendingMenu.open) this.vendingMenu.close(); if (this.tableMenu.open) this.tableMenu.close(); if (this.fridgeMenu.open) this.fridgeMenu.close(); });
    window.__restPreview = { getState: () => ({ ready: true, tableCollision: { ...tableCollision, floorY: tableFloorY }, active: this.sys.isActive(), x: this.x, y: this.y, seated: this.seated, hand: this.hand, fridgeItems: [...this.fridgeItems], fridgeOpen: this.fridgeMenu.open, tableItems: this.tableItems.map(table => [...table]), brewing: this.brewing, coffeeReady: this.coffeeReady, machineCupVisible: this.machineCup.visible, heldCupVisible: !!this.hand, actorTexture: 'team-avatar', metrics: METRICS, chairCount: this.targets.filter(target => target.kind === 'chair').length, facing: this.facing, seats: chairSeats.map(s => ({ ...s })), nearest: this.nearest()?.id ?? null, targets: this.targets.map(t => ({ ...t })) }) };
    world.focus();
  }
  private get fridgeMenu() { return document.querySelector<HTMLDialogElement>('#fridge-menu')!; }
  private openFridge() {
    if(onlineWorld()?.bridge.user?.role){if(!onlineWorld()!.objects.get('rest:fridge-door')?.open)sharedAction('rest:fridge-door','toggle');}
    this.input.keyboard?.resetKeys();
    this.drawFridgeDoor(true);
    this.renderFridge(); this.fridgeMenu.showModal();
  }
  private drawFridgeDoor(open:boolean) {
    if(!open){this.fridgeDoor.setVisible(false);return;}
    const left = this.fridge.x - this.fridge.displayWidth / 2;
    const top = this.fridge.y - this.fridge.displayHeight;
    const width = this.fridge.displayWidth, height = this.fridge.displayHeight * .54;
    // Only overlay the upper compartment; the original lower door stays closed.
    this.fridgeDoor.clear().setPosition(left, top).setVisible(true)
      .fillStyle(0x252a29).fillRect(0, 0, width, height)
      .fillStyle(0xd7dcda).fillRect(3, 3, width - 6, height - 6)
      .fillStyle(0x8eaaa3).fillRect(6, 6, width - 12, height - 12)
      .fillStyle(0xe5e9e1).fillRect(6, height * .4, width - 12, 2).fillRect(6, height * .7, width - 12, 2)
      .fillStyle(0x303635).fillRect(width - 2, 0, 15, height)
      .fillStyle(0xb5bfbc).fillRect(width, 2, 11, height - 4)
      .fillStyle(0xe1e5df).fillRect(width + 2, 6, 7, height - 12);
  }
  private renderFridge() {
    const list = document.querySelector('#fridge-items')!;
    list.innerHTML = this.fridgeItems.map((name, slot) => `<button type="button" data-fridge-slot="${slot}" ${!name ? 'disabled' : ''}>${name ? '<img alt=""/>' : '<span class="fridge-empty">空位</span>'}<span>${slot + 1} ${name ?? ''}</span></button>`).join('');
    for (const button of list.querySelectorAll<HTMLButtonElement>('button')) {
      const slot = Number(button.dataset.fridgeSlot), name = this.fridgeItems[slot];
      if (!name) continue;
      const item = items[name], texture = this.textures.get(item.texture), frame = texture.get(item.frame);
      const canvas = document.createElement('canvas'); canvas.width = frame.cutWidth; canvas.height = frame.cutHeight;
      canvas.getContext('2d')!.drawImage(texture.getSourceImage() as HTMLImageElement, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, 0, 0, canvas.width, canvas.height);
      button.querySelector('img')!.src = canvas.toDataURL();
      button.addEventListener('click', () => this.takeFridgeItem(slot));
    }
    document.querySelector('#fridge-hand')!.textContent = `手中：${this.hand ?? '空'} · 柜内 ${this.fridgeItems.filter(Boolean).length} / 9 件`;
    const store = document.querySelector<HTMLButtonElement>('#fridge-store')!;
    store.disabled = !this.hand || !this.fridgeItems.includes(null);
    store.textContent = this.hand ? `放入${this.hand}` : '放入手中物品';
    document.querySelector('#fridge-message')!.textContent = this.hand ? 'F 存' : '1–9 取';
  }
  private storeFridgeItem() {
    if (!this.sys.isActive() || !this.fridgeMenu.open || !this.hand) return;
    const slot = this.fridgeItems.indexOf(null);
    if (slot < 0) { document.querySelector('#fridge-message')!.textContent = '已满'; return; }
    if(sharedAction('rest:fridge','put',{slot},()=>this.renderFridge()))return;
    const name = this.hand; this.fridgeItems[slot] = name; this.hand = null;
    this.renderFridge(); document.querySelector('#fridge-message')!.textContent = '';
  }
  private takeFridgeItem(slot: number) {
    if (!this.sys.isActive() || !this.fridgeMenu.open || !this.fridgeItems[slot]) return;
    if (this.hand) { document.querySelector('#fridge-message')!.textContent = '手上有东西'; return; }
    if(sharedAction('rest:fridge','take',{slot},()=>this.renderFridge()))return;
    this.hand = this.fridgeItems[slot]; this.fridgeItems[slot] = null;
    this.renderFridge(); document.querySelector('#fridge-message')!.textContent = '';
  }
  private get vendingMenu() { return document.querySelector<HTMLDialogElement>('#vending-menu')!; }
  private takeProduct(name: ItemName) {
    if (!this.sys.isActive() || !this.vendingMenu.open || this.nearest()?.kind !== 'vending' || this.hand || !vendingProducts.includes(name)) return;
    if(sharedAction('rest:vending','supply',{item:name},()=>this.vendingMenu.close()))return;
    this.hand = name; this.vendingMenu.close();
    this.message('');
  }
  private nearest() {
    return this.targets.filter(t => Math.hypot(this.x - t.x, this.y - t.y) < 30)
      .sort((a, b) => Math.hypot(this.x - a.x, this.y - a.y) - Math.hypot(this.x - b.x, this.y - b.y))[0];
  }
  private message(text: string) { document.querySelector('#rest-message')!.textContent = text; }
  private stand() { if (this.seated !== null) { const seat = chairSeats[this.seated]; this.x = seat.approach.x; this.y = seat.approach.y; this.seated = null; this.message(''); } }
  private interact() {
    if (this.seated !== null) { this.stand(); return; }
    if (this.brewing) return;
    const target = this.nearest(); if (!target) return;
    if (target.kind === 'fridge') {
      this.openFridge();
    } else if (target.kind === 'coffee') {
      if (this.hand) { this.message('手上有东西'); return; }
      if(this.coffeeReady&&sharedAction('rest:coffee','supply',{item:'咖啡'},()=>{this.coffeeReady=false;this.message('');}))return;
      if (this.coffeeReady) { this.coffeeReady = false; this.hand = '咖啡'; this.message(''); return; }
      this.brewing = true; this.message('');
      this.motionTime = 0;
      this.timeEventCoffee();
    } else if (target.kind === 'vending') {
      if (this.hand) { this.message('手上有东西'); return; }
      this.input.keyboard?.resetKeys(); this.vendingMenu.showModal();
    } else if (target.kind === 'chair') {
      this.seated = target.index!; const seat = chairSeats[this.seated]; this.x = seat.x; this.y = seat.y; this.facing = seat.facing;
      this.message(`Esc 起身`);
    } else {
      this.useTable(target.index!);
    }
  }
  private get tableMenu() { return document.querySelector<HTMLDialogElement>('#table-menu')!; }
  private tableCount(index: number) { return this.tableItems[index].filter(Boolean).length; }
  private takeTableItem(index: number, slot: number) {
    if (!this.sys.isActive() || this.hand || !this.tableItems[index]?.[slot]) return;
    if(sharedAction(`rest:table-${index}`,'take',{slot},()=>{if(this.tableMenu.open)this.tableMenu.close();}))return;
    this.hand = this.tableItems[index][slot]; this.tableItems[index][slot] = null;
    if (this.tableMenu.open) this.tableMenu.close();
    this.message('');
  }
  private useTable(index: number) {
    const table = this.tableItems[index];
    if (this.hand) {
      const slot = table.indexOf(null);
      if (slot < 0) { this.message('桌上已满'); return; }
      if(sharedAction(`rest:table-${index}`,'put',{slot}))return;
      const name = this.hand; table[slot] = name; this.hand = null;
      this.message('');
    } else if (this.tableCount(index) === 1) this.takeTableItem(index, table.findIndex(Boolean));
    else if (this.tableCount(index) > 1) {
      this.tableMenu.dataset.table = String(index);
      document.querySelector('#table-menu-title')!.textContent = '';
      const list = document.querySelector('#table-pick-list')!;
      list.innerHTML = table.map((name, slot) => name ? `<button type="button" data-slot="${slot}">${slot + 1} ${name}</button>` : '').join('');
      for (const button of list.querySelectorAll<HTMLButtonElement>('button')) button.addEventListener('click', () => this.takeTableItem(index, Number(button.dataset.slot)));
      this.input.keyboard?.resetKeys(); this.tableMenu.showModal();
    } else this.message('');
  }

  private timeEventCoffee() {
    this.brewTimer = this.time.delayedCall(1400, () => { this.brewing = false; this.coffeeReady = true; this.message(''); });
  }
  private canWalk(x:number,y:number){return sceneWalkable('rest',x,y);}
  update(_now: number, delta: number) {
    const focus = document.activeElement;
    const accepts = focus === document.querySelector('.world') || focus === this.game.canvas;
    let moving = false;
    if (accepts && this.seated === null && !this.brewing) {
      const dx = Number(this.keys.RIGHT.isDown || this.keys.D.isDown) - Number(this.keys.LEFT.isDown || this.keys.A.isDown);
      const dy = Number(this.keys.DOWN.isDown || this.keys.S.isDown) - Number(this.keys.UP.isDown || this.keys.W.isDown);
      if (dx || dy) {
        const step = 108 * Math.min(delta, 32) / 1000 / Math.hypot(dx, dy);
        const oldX = this.x, oldY = this.y;
        if (this.canWalk(this.x + dx * step, this.y)) this.x += dx * step;
        if (this.canWalk(this.x, this.y + dy * step)) this.y += dy * step;
        const facing = dx ? dx > 0 ? 1 : 3 : dy > 0 ? 0 : 2;
        if (facing !== this.facing) this.motionTime = 0;
        this.facing = facing; moving = oldX !== this.x || oldY !== this.y;
      }
    }
    this.motionTime = moving ? this.motionTime + Math.min(delta, 50) : 0;
    const tableVisible = document.querySelector<HTMLInputElement>('[data-rest-layer="tables"]')!.checked;
    this.tableSprites.forEach((cup, index) => {
      const drink = this.tableItems[Math.floor(index / tableCapacity)][index % tableCapacity];
      cup.setVisible(tableVisible && !!drink);
      if (drink) {
        const item = items[drink];
        cup.setTexture(item.texture, item.frame).setDisplaySize(item.width, item.height);
      }
    });
    const target = this.nearest();
    const equipmentVisible = document.querySelector<HTMLInputElement>('[data-rest-layer="equipment"]')!.checked;
    this.machineCup.setVisible(this.coffeeReady && equipmentVisible);
    document.querySelector('#mode')!.textContent = '';
    document.querySelector('#hint')!.textContent = this.seated !== null ? 'F 物品 · Esc 起身' : target ? `E 互动` : '';
    const tableButton = document.querySelector<HTMLButtonElement>('#table-action')!;
    tableButton.hidden = this.seated === null;
    if (this.seated !== null) {
      const count = this.tableCount(Math.floor(this.seated / 2));
      tableButton.disabled = !this.hand && !count;
      tableButton.textContent = this.hand ? `放下${this.hand}到桌上` : count ? `选择桌上物品（${count} 件）` : '桌上没有物品';
    }
    const button = document.querySelector<HTMLButtonElement>('#interact')!;
    button.disabled = this.brewing || (this.seated === null && !target);
    button.textContent = this.seated !== null ? '起身' : target?.kind === 'fridge' ? '打开冰箱上门' : target?.kind === 'vending' ? '挑选产品' : target?.kind === 'coffee' ? this.coffeeReady ? '拿起咖啡' : '冲一杯咖啡' : target?.kind === 'chair' ? '坐下休息' : target?.kind === 'table' ? this.hand ? `放下${this.hand}` : this.tableCount(target.index!) ? `选择桌上物品（${this.tableCount(target.index!)} 件）` : '查看餐桌' : '';
    document.querySelector('#rest-inventory')!.textContent = `手中：${this.hand ?? '空'}`;
    document.querySelector('#guide-title')!.textContent = 'WASD / 方向键移动';
    document.querySelector('#guide-action')!.textContent = this.seated !== null ? tableButton.disabled ? '桌面空 · E / Esc 起身' : `F · ${tableButton.textContent} · E / Esc 起身` : this.brewing ? '' : target ? `E · ${button.textContent}` : 'E 互动';
  }
}


