async (page) => {
  const directory = 'output/playwright/moles';
  const origin = new URL(page.url()).origin;
  const report = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const [label, size] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    await page.setViewportSize(size);
    await page.goto(origin + '/moles');
    await page.waitForFunction(() => document.getElementById('selection').dataset.ready === 'true');
    await page.getByRole('button', { name: '清空', exact: true }).click();
    if (!await page.getByRole('button', { name: '开始 · 60 秒 →' }).isDisabled()) throw Error('Empty selection allowed');
    for (const name of ['f01 Suki', 'f04 Laura', 'f08 Amber']) await page.getByRole('button', { name, exact: true }).click();
    await page.reload();
    await page.waitForFunction(() => !document.getElementById('start').disabled);
    if (await page.locator('[aria-pressed="true"]').count() !== 3) throw Error('Selection not persisted');
    await page.screenshot({ path: `${directory}/${label}-selection.png`, fullPage: true });
    await page.getByRole('button', { name: '开始 · 60 秒 →' }).click();
    if (await page.locator('#countdown').textContent() !== '3') throw Error('Countdown missing');
    await page.waitForFunction(() => !!window.__moles.game.active);
    // Freeze the injected engine clock to photograph short-lived states consistently.
    await page.evaluate(() => {
      const game = window.__moles.game;
      game.now = () => game.active.born + 170;
    });
    await page.waitForTimeout(160);
    const person = await page.locator('.hole.up').getAttribute('data-person');
    if (!['f01', 'f04', 'f08'].includes(person)) throw Error('Unselected person appeared');
    await page.screenshot({ path: `${directory}/${label}-playing.png`, fullPage: true });
    const hole = Number(await page.locator('.hole.up').getAttribute('data-hole'));
    // Keyboard on desktop; a real touch event sequence on the mobile viewport.
    if (label === 'desktop') await page.keyboard.press('qweasd'[hole]);
    else {
      const target = page.locator(`.hole[data-hole="${hole}"]`);
      await target.dispatchEvent('touchstart', { touches: [{ identifier: 1, clientX: 50, clientY: 50 }] });
      await target.dispatchEvent('touchend', { touches: [] });
      await target.click();
    }
    await page.waitForFunction(() => document.getElementById('score').textContent === '1');
    await page.screenshot({ path: `${directory}/${label}-hit.png`, fullPage: true });
    await page.evaluate(() => {
      const game = window.__moles.game; game.now = () => game.end + 1; game.tick();
    });
    await page.waitForFunction(() => !document.getElementById('result').hidden);
    await page.screenshot({ path: `${directory}/${label}-result.png`, fullPage: true });
    await page.getByRole('button', { name: '换人再来', exact: true }).click();
    if (!await page.locator('#selection').isVisible()) throw Error('Cannot change people');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    if (overflow) throw Error('Horizontal overflow');
    report.push({ label, person, hole, score: 1, persistedSelection: true, overflow });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(origin + '/');
  await page.waitForSelector('#game canvas');
  await page.waitForFunction(() => { const loading = document.querySelector('.loading'); return !loading || loading.hidden || getComputedStyle(loading).display === 'none'; }).catch(() => {});
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${directory}/original-home.png`, fullPage: true });
  if (errors.length) throw Error(JSON.stringify(errors));
  return { report, pageErrors: errors, homeTitle: await page.title() };
}
