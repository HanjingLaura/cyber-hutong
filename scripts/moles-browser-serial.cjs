async (page) => {
  const origin = new URL(page.url()).origin;
  await page.addInitScript(() => {
    const serial = new EventTarget(); const writes = [];
    let controller;
    const port = {
      readable: new ReadableStream({ start(value) { controller = value; } }),
      writable: new WritableStream({ write(value) { writes.push(new TextDecoder().decode(value)); } }),
      async open(options) { window.__fakeOptions = options; }, async close() {},
    };
    serial.requestPort = async () => port;
    Object.defineProperty(navigator, 'serial', { configurable: true, value: serial });
    window.__fakeSerial = { writes, push(text) { controller.enqueue(new TextEncoder().encode(text)); },
      unplug() { const event = new Event('disconnect'); Object.defineProperty(event, 'port', { value: port }); serial.dispatchEvent(event); } };
  });
  await page.goto(origin + '/moles');
  await page.waitForFunction(() => document.getElementById('selection').dataset.ready === 'true');
  await page.getByRole('button', { name: '清空', exact: true }).click();
  await page.getByRole('button', { name: 'f02 Sid', exact: true }).click();
  await page.getByRole('button', { name: '连接 Uno', exact: true }).click();
  await page.getByRole('button', { name: '开始 · 60 秒 →' }).click();
  await page.waitForFunction(() => !!window.__moles.game.active);
  if (await page.evaluate(() => window.__fakeSerial.writes.length)) throw Error('Pre-READY write');
  await page.evaluate(() => {
    const game = window.__moles.game, time = game.now(); game.now = () => time;
    window.__fakeSerial.push('REA');
  });
  if (await page.evaluate(() => window.__moles.uno.ready)) throw Error('Partial READY interpreted');
  await page.evaluate(() => window.__fakeSerial.push('DY\r\n'));
  await page.waitForFunction(() => window.__moles.uno.ready);
  const hole = await page.evaluate(() => window.__moles.game.active.hole);
  await page.waitForFunction(hole => window.__fakeSerial.writes.includes(`ON:${hole}\n`), hole);
  await page.evaluate(hole => window.__fakeSerial.push(`HIT:${hole}\n`), hole);
  await page.waitForFunction(() => document.getElementById('score').textContent === '1');
  await page.waitForFunction(hole => window.__fakeSerial.writes.includes(`OFF:${hole}\n`), hole);
  if (await page.locator('.hole.up').getAttribute('data-person') !== 'f02') throw Error('Wrong person');
  await page.evaluate(() => window.__fakeSerial.unplug());
  await page.waitForFunction(() => !window.__moles.uno.ready);
  if (await page.evaluate(() => window.__moles.game.phase) !== 'playing') throw Error('Unplug ended round');
  const report = await page.evaluate(() => ({ baudRate: window.__fakeOptions.baudRate,
    writes: window.__fakeSerial.writes, score: window.__moles.game.score, person: window.__moles.game.active.person,
    status: document.getElementById('serial-status').textContent }));
  // Real touch input in a browser context with touch hardware emulation.
  const context = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const mobile = await context.newPage(); await mobile.goto(origin + '/moles');
  await mobile.waitForFunction(() => !document.getElementById('start').disabled);
  await mobile.getByRole('button', { name: '开始 · 60 秒 →' }).tap();
  await mobile.waitForFunction(() => !!window.__moles.game.active);
  await mobile.evaluate(() => { const game = window.__moles.game, time = game.now(); game.now = () => time; });
  await mobile.locator('.hole.up').tap();
  await mobile.waitForFunction(() => document.getElementById('score').textContent === '1');
  report.realTouchScore = await mobile.locator('#score').textContent(); await context.close();
  return report;
}
