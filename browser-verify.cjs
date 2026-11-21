const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const baseUrl = process.env.RITUAL_TEST_URL || 'http://127.0.0.1:8080';
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'Asia/Shanghai' });
    const page = await context.newPage();
    await page.clock.install({ time: new Date('2026-11-20T10:00:00+08:00') });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(baseUrl);
    const waitForTitle = text => page.waitForFunction(expected => document.getElementById('action-title').textContent === expected, text);
    const primaryPosition = () => page.locator('#complete-action').evaluate(button => {
      const box = button.getBoundingClientRect();
      return {x: box.x + scrollX, y: box.y + scrollY, width: box.width, height: box.height};
    });
    const feedback = page.locator('#completion-feedback');
    const sceneProgress = () => page.locator('#ritual-scene').evaluate(el => Number(getComputedStyle(el).getPropertyValue('--progress')));
    assert.equal(await page.locator('#history-view').isHidden(), true);
    assert.equal(await page.locator('#top-date').getAttribute('datetime'), '2026-11-20');
    assert.equal(await page.locator('#top-weekday').textContent(), '星期五');
    await page.locator('[data-mode-option="morning"]').click();
    assert.equal(await page.locator('#action-title').textContent(), '刷牙');
    assert.equal(await feedback.evaluate(el => el.hidden), true);
    assert.equal(await sceneProgress(), 0);
    const quote = page.locator('#habit-quote');
    assert.equal(await quote.count(), 1, '本地打卡页应展示原有的习惯名言');
    assert.equal(await quote.locator('cite').innerText(), '《诗经·卫风·淇奥》');
    const firstButton = await primaryPosition();
    assert.equal((await page.locator('#complete-action').innerText()).trim(), '刷牙', '主操作只显示当前动作名称和对勾');
    assert.equal(await page.locator('#complete-action').getAttribute('aria-label'), '完成 · 刷牙');
    assert.ok(firstButton.width >= 240 && firstButton.height >= 48, '390px 手机主按钮应能从卡片两侧顺手点按');
    assert.equal(await page.locator('#routine-list').evaluate(list => list.open), false);
    assert.equal(await page.locator('#routine-actions').isHidden(), true);
    assert.equal(await page.locator('#supplement-panel > summary').isVisible(), true);
    for (const id of ['supplement-panel', 'night-note', 'week-notes']) {
      const marker = await page.locator(`#${id} > summary`).evaluate(summary => getComputedStyle(summary, '::after').content);
      assert.ok(['none', 'normal'].includes(marker), `${id} 不应再重复显示下拉箭头`);
    }
    assert.equal(await page.locator('#week-days').count(), 0);
    assert.equal(await page.locator('#action-sketch use').getAttribute('href'), '#drawing-brush');
    await page.locator('#routine-list > summary').click();
    assert.equal(await page.locator('.sparrow').isVisible(), true);
    await page.locator('#supplement-panel > summary').click();
    await page.waitForFunction(() => document.querySelector('#supplement-quote cite')?.innerText === '《道德经》第六十四章');
    await page.locator('#supplement-panel > summary').click();
    const reward = page.locator('.feed-reward');
    assert.equal(await reward.evaluate(el => getComputedStyle(el).opacity), '0');
    const growth = page.locator('#bird-growth');
    assert.equal(await growth.textContent(), '雏鸟 · 累计 0 天');
    const birdButton = page.locator('#bird-metrics');
    assert.equal(await growth.isVisible(), false);
    assert.deepEqual(await page.locator('.bird-stats > span').allTextContents(), ['0天', '0']);
    await birdButton.tap();
    assert.equal(await growth.isVisible(), true);
    await page.keyboard.press('Escape');
    assert.equal(await growth.isVisible(), false);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'bird-metrics');
    assert.match(await page.locator('.routine-heading').ariaSnapshot(), /习惯清单 0 \/ 6 已完成/);
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({width, height: 844});
      const card = await page.locator('#action-card').boundingBox();
      const bird = await page.locator('#ritual-scene').boundingBox();
      const sketch = await page.locator('#action-sketch').boundingBox();
      const quoteBox = await quote.boundingBox();
      const print = await page.locator('.scene-print').boundingBox();
      const caption = await page.locator('.bird-stats').boundingBox();
      assert.ok(bird.x >= sketch.x + sketch.width && bird.width <= card.width * 0.4);
      assert.ok(print.width >= bird.width - 1 && caption.y >= print.y + print.height - 1);
      assert.ok(bird.y + bird.height <= quoteBox.y + 1);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.locator('[data-mode-option="evening"]').click();
      let previous;
      for (const id of ['brush', 'breath', 'read']) {
        await page.locator(`[data-step="${id}"]`).click();
        const position = await primaryPosition();
        if (previous) assert.deepEqual(position, previous, `${width}px 切换到 ${id} 后完成按钮移动`);
        previous = position;
      }
      await page.locator('[data-mode-option="morning"]').click();
    }
    await page.setViewportSize({width: 390, height: 844});
    assert.equal(await page.locator('#meal-count').textContent(), '今晨已喂 0 粒');
    const confirmation = await page.evaluate(() => {
      const button = document.getElementById('complete-action');
      button.focus();
      button.click();
      button.click();
      return {
        title: document.getElementById('action-title').textContent,
        feedback: !document.getElementById('completion-feedback').hidden,
        count: document.getElementById('routine-progress').textContent,
        saved: JSON.parse(localStorage.getItem('early-evening-ritual.v1/2026-11-20/morning/brush')).status,
      };
    });
    assert.deepEqual(confirmation, { title: '刷牙', feedback: true, count: '1 / 6', saved: 'done' });
    assert.equal(await page.locator('#ritual-scene.feeding').count(), 1);
    assert.equal(await reward.innerText(), '+1');
    assert.equal(await reward.evaluate(el => getComputedStyle(el).opacity), '1');
    const poses = await page.locator('.sparrow').evaluate(el =>
      el.getAnimations().find(animation => animation.animationName === 'feeding-poses').effect.getKeyframes().map(frame => frame.backgroundPositionX)
    );
    assert.deepEqual(poses, ['0%', '50%', '100%', '0%']);
    assert.equal(await growth.textContent(), '雏鸟 · 累计 1 天');
    assert.equal(await page.locator('#meal-count').textContent(), '今晨已喂 1 粒');
    assert.deepEqual(await page.locator('.bird-stats > span').allTextContents(), ['1天', '1']);
    await waitForTitle('伸展一下');
    const nextButton = await primaryPosition();
    assert.ok(Math.abs(firstButton.y - nextButton.y) <= 1 && firstButton.width === nextButton.width);
    assert.equal(await page.locator('#action-sketch use').getAttribute('href'), '#drawing-stretch');
    assert.equal(await page.locator('#ritual-scene.feeding').count(), 0);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'complete-action');
    assert.equal(await feedback.isVisible(), false);
    await birdButton.tap();
    assert.equal(await feedback.innerText(), '刷牙已完成 · 喂食 +1 粒');
    assert.match(await birdButton.getAttribute('aria-label'), /累计 1 天，今晨已喂 1 粒/);
    await page.keyboard.press('Escape');
    assert.equal(await quote.locator('cite').innerText(), '陶渊明《饮酒·其五》');
    assert.equal(await sceneProgress(), 1 / 6);
    await page.locator('#night-note > summary').click();
    await page.locator('#lights-out').fill('23:10');
    await page.locator('#note-form button').click();
    await page.locator('#action-options summary').click();
    await page.locator('#skip-action').click();
    assert.equal(await page.locator('#action-title').textContent(), '阅读');
    await page.reload();
    assert.equal(await page.locator('#action-title').textContent(), '阅读');
    assert.equal(await feedback.textContent(), '刷牙已完成 · 喂食 +1 粒');
    assert.equal(await quote.locator('.translation').innerText(), '在一粒沙里，看见一个世界。');
    assert.equal(await growth.textContent(), '雏鸟 · 累计 1 天');
    if (!await page.locator('#routine-list').evaluate(list => list.open)) await page.locator('#routine-list > summary').click();
    await page.locator('#manage-habits').click();
    const pauseBrush = page.locator('[data-habit="brush"][data-habit-command="toggle"]');
    await pauseBrush.click();
    assert.equal(await page.locator('#meal-count').textContent(), '今晨已喂 1 粒');
    assert.equal(await page.locator('#routine-progress').textContent(), '0 / 5');
    await pauseBrush.click();
    await page.locator('#habit-name').fill('练琴十分钟');
    await page.locator('#habit-form button').click();
    const custom = await page.locator('#habit-settings li').last().locator('[data-habit-command="up"]').getAttribute('data-habit');
    await page.locator(`[data-habit="${custom}"][data-habit-command="up"]`).click();
    assert.equal(await page.locator('#habit-settings li').nth(5).locator('span').textContent(), '6. 练琴十分钟');
    await page.locator(`[data-habit="${custom}"][data-habit-command="toggle"]`).click();
    assert.equal(await page.locator('#habit-settings li').nth(5).locator('span').textContent(), '6. 练琴十分钟 · 已停用');
    await page.locator(`[data-habit="${custom}"][data-habit-command="toggle"]`).click();
    await page.locator('#habit-dialog form[method="dialog"] button').click();
    await page.reload();
    assert.equal(await page.locator('#routine-actions li').nth(5).locator('.habit-button').getAttribute('data-step'), custom);
    await page.locator('#routine-list > summary').click();
    await page.locator(`[data-step="${custom}"]`).click();
    assert.equal(await page.locator('#action-title').textContent(), '练琴十分钟');
    assert.equal(await page.locator('#action-sketch use').getAttribute('href'), '#drawing-sprig');
    await page.locator('#complete-action').click();
    await waitForTitle('闲走');
    assert.equal(await feedback.textContent(), '练琴十分钟已完成 · 喂食 +1 粒');
    assert.equal(await growth.textContent(), '雏鸟 · 累计 1 天');
    await page.locator('#open-history').click();
    await page.waitForURL(/#footprints$/);
    await page.locator('#heatmap-title').waitFor();
    assert.equal(await page.locator('#daily-view').isHidden(), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'heatmap-title');
    assert.equal(await page.locator('[data-range="month"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.heat-cell').count(), 30);
    for (const theme of ['evening', 'morning']) {
      await page.locator(`[data-mode-option="${theme}"]`).click();
      const contrast = await page.locator('.heatmap-panel').evaluate(panel => {
        const luminance = cssColor => {
          const [r, g, b] = cssColor.match(/\d+/g).slice(0, 3).map(Number).map(value => value / 255)
            .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
          return .2126 * r + .7152 * g + .0722 * b;
        };
        const unmarked = panel.querySelector('.heat-cell:not(.done,.future) .date-number');
        const ink = luminance(getComputedStyle(unmarked).borderColor);
        const paper = luminance(getComputedStyle(panel).backgroundColor);
        return (Math.max(ink, paper) + .05) / (Math.min(ink, paper) + .05);
      });
      assert.ok(contrast >= 3, `${theme} 模式空心日期与纸面的对比度 ${contrast}`);
    }
    await page.locator('#history-habit').selectOption('brush');
    await page.emulateMedia({ forcedColors: 'active' });
    const todayMark = await page.locator('button.heat-cell[aria-current="date"]').evaluate(cell =>
      getComputedStyle(cell, '::after').backgroundColor !== getComputedStyle(cell.closest('.heatmap-panel')).backgroundColor);
    assert.equal(todayMark, true, '高对比模式也应看得出今天的位置');
    await page.emulateMedia({ forcedColors: 'none' });
    assert.match(await page.locator('#habit-consistency').innerText(), /近 28 天已记 1 天/);
    await page.locator('#week-notes > summary').click();
    await page.waitForFunction(() => document.getElementById('week-note-list').innerText.includes('23:10 关灯'));
    assert.equal(await page.locator('#week-note-list time').first().getAttribute('datetime'), '2026-11-19');
    await page.locator('[data-range="week"]').click();
    assert.equal(await page.locator('.heat-cell').count(), 7);
    await page.locator('[data-range="month"]').click();
    assert.equal(await page.locator('.heat-cell').count(), 30);
    assert.equal(await page.locator('.heat-cell').first().evaluate(cell => getComputedStyle(cell).gridColumnStart), '7');
    await page.locator('[data-day="2026-11-20"]').click();
    assert.match(await page.locator('#heatmap-detail').textContent(), /2026-11-20 · 刷牙 · 已完成/);
    assert.equal(await page.locator('[data-day="2026-11-21"]').isDisabled(), true);
    await page.locator('[data-range="year"]').click();
    assert.equal(await page.locator('.heat-cell').count(), 365);
    assert.equal(await page.locator('.mini-month').count(), 12);
    assert.equal(await page.locator('.mini-month').nth(1).locator('.heat-cell').count(), 28);
    const firstDay = await page.locator('.mini-month').first().locator('.heat-cell').first().boundingBox();
    const febFirst = await page.locator('.mini-month').nth(1).locator('.heat-cell').first().boundingBox();
    assert.equal(febFirst.x, firstDay.x);
    assert.equal(await page.locator('.mini-month').nth(10).locator('.done').count(), 1);
    assert.equal(await page.locator('.mini-month').last().isDisabled(), true);
    await page.locator('#history-previous').click();
    assert.equal(await page.locator('#history-period').textContent(), '2025 年');
    await page.locator('#history-next').click();
    assert.equal(await page.locator('#history-next').isDisabled(), true);
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `horizontal overflow at ${width}`);
    }
    await page.locator('.mini-month').first().click();
    assert.equal(await page.locator('#history-period').textContent(), '2026 年 1 月');
    await page.locator('[data-day="2026-01-01"]').click();
    assert.match(await page.locator('#heatmap-detail').textContent(), /2026-01-01/);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goBack();
    await page.locator('#daily-view').waitFor();
    await page.goForward();
    await page.locator('#heatmap-title').waitFor();
    await page.locator('#open-today').click();
    await page.locator('#daily-view').waitFor();
    if (!await page.locator('#routine-list').evaluate(list => list.open)) await page.locator('#routine-list > summary').click();
    await page.locator('#manage-habits').click();
    await page.goBack();
    await page.locator('#heatmap-title').waitFor();
    assert.equal(await page.locator('#habit-dialog[open]').count(), 0);
    await page.locator('#open-today').click();
    await page.locator('#daily-view').waitFor();
    // Complete every remaining item; skipped items remain available for later.
    while (await page.locator('#complete-action').isVisible()) {
      await page.locator('#complete-action').click();
      await page.waitForFunction(() => !document.getElementById('complete-action').hasAttribute('aria-disabled'));
    }
    assert.equal(await page.locator('#action-title').textContent(), '今晨完成 6 项');
    assert.match(await page.locator('#action-description').textContent(), /1 项已跳过/);
    assert.equal(await sceneProgress(), 6 / 7);
    await page.locator('[data-step="brush"]').click();
    await page.locator('#complete-action').click();
    assert.equal(await page.locator('#complete-action').getAttribute('aria-pressed'), 'false');
    assert.equal(await sceneProgress(), 5 / 7);
    await page.locator('[data-mode-option="evening"]').click();
    assert.equal(await feedback.evaluate(el => el.hidden), true);
    assert.equal(await sceneProgress(), 0);
    assert.equal(await page.locator('#meal-count').textContent(), '今晚已喂 0 粒');
    assert.equal(await page.locator(`[data-step="${custom}"]`).count(), 0);
    // A second tab loads the same settings, then receives a storage event.
    const second = await context.newPage();
    await second.goto(baseUrl);
    await second.locator('[data-mode-option="morning"]').click();
    assert.equal(await second.locator(`[data-step="${custom}"]`).count(), 1);
    await page.locator('[data-mode-option="morning"]').click();
    await page.locator('[data-step="brush"]').click();
    await page.locator('#complete-action').click();
    await second.waitForFunction(() => document.querySelector('[data-step="brush"]').textContent.includes('已完成'));
    // A supplement moved to evening must keep its prior morning history visible.
    await page.evaluate(() => {
      const prefix = 'early-evening-ritual.v1/';
      const id = '0123456789abcdef01234567';
      localStorage.setItem(prefix + 'supplement-settings/' + id, JSON.stringify({ name: '历史补品', mode: 'evening', paused: false }));
      localStorage.setItem(prefix + '2026-11-20/supplement-check/' + id, 'morning');
    });
    await page.goto(new URL('#footprints', baseUrl).href);
    await page.reload();
    await page.locator('#heatmap-title').waitFor();
    await page.locator('#history-habit').selectOption({ label: '补品 · 历史补品' });
    assert.equal(await page.locator('.heat-cell.done').count(), 1);
    await page.locator('[data-mode-option="evening"]').click();
    assert.equal(await page.locator('#history-habit').inputValue(), 'supplement-0123456789abcdef01234567');
    assert.equal(await page.locator('.heat-cell.done').count(), 0);

    await page.locator('#open-today').click();
    await page.locator('#daily-view').waitFor();
    await page.evaluate(() => {
      document.getElementById('complete-action').click();
      document.querySelector('[data-mode-option="morning"]').click();
    });
    await waitForTitle('今晨完成 6 项');
    if (!await page.locator('#routine-list').evaluate(list => list.open)) await page.locator('#routine-list > summary').click();
    await page.locator('[data-step="stretch"]').click();
    await page.locator('#complete-action').click();
    await waitForTitle('今晨 7 项，全部完成');
    assert.equal(await quote.isVisible(), true);
    assert.equal(await sceneProgress(), 1);
    await page.reload();
    await waitForTitle('今晨 7 项，全部完成');
    await page.locator('[data-mode-option="evening"]').click();
    assert.equal(await page.locator('#action-title').textContent(), '睡前刷牙');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const reducedTitle = await page.evaluate(() => {
      document.getElementById('complete-action').click();
      return document.getElementById('action-title').textContent;
    });
    assert.equal(reducedTitle, '呼吸或冥想');
    assert.equal(await feedback.textContent(), '睡前刷牙已完成 · 喂食 +1 粒');
    assert.equal(await reward.evaluate(el => getComputedStyle(el).opacity), '1');
    await page.clock.runFor(1400);
    assert.equal(await reward.evaluate(el => getComputedStyle(el).opacity), '0');
    assert.equal(await page.locator('.sparrow').evaluate(el => getComputedStyle(el).backgroundPositionX), '100%');
    assert.equal(await sceneProgress(), 2 / 7);
    assert.equal(await page.locator('#ritual-scene.feeding').count(), 0);
    assert.equal(await page.locator('#meal-count').textContent(), '今晚已喂 2 粒');

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => {
      document.getElementById('complete-action').click();
      const key = 'early-evening-ritual.v1/2026-11-20/evening/read';
      const newValue = JSON.stringify({ status: 'done', at: Date.now() });
      localStorage.setItem(key, newValue);
      window.dispatchEvent(new StorageEvent('storage', { key, newValue }));
    });
    await waitForTitle('写作表达');
    const emptyRound = await browser.newPage({ viewport: { width: 320, height: 844 } });
    await emptyRound.goto(baseUrl);
    await emptyRound.evaluate(() => {
      const prefix = 'early-evening-ritual.v1/';
      const today = Ritual.activeDay('morning', new Date());
      for (let n = 1; n <= 12; n++) {
        const id = n.toString(16).padStart(24, '0');
        localStorage.setItem(prefix + 'supplement-settings/' + id, JSON.stringify({name: '补品' + n, mode: 'morning'}));
        if (n < 12) localStorage.setItem(prefix + today + '/supplement-check/' + id, 'morning');
      }
    });
    await emptyRound.reload();
    await emptyRound.locator('[data-mode-option="morning"]').click();
    assert.equal(await emptyRound.locator('#supplement-count').innerText(), '11/12');
    const tools = emptyRound.locator('.daily-tools');
    const [pack, note] = await Promise.all([tools.locator('#supplement-panel').boundingBox(), tools.locator('#night-note').boundingBox()]);
    assert.equal(pack.y, note.y, '320px 且有两位数记录时，两个辅助入口仍能并排');
    await tools.locator('#supplement-panel > summary').click();
    await tools.locator('#night-note > summary').click();
    const available = await tools.boundingBox();
    for (const panel of ['#supplement-panel', '#night-note']) {
      assert.ok(Math.abs((await tools.locator(panel).boundingBox()).width - available.width) <= 1);
    }
    await tools.locator('#lights-out').fill('23:20');
    await tools.locator('#note-form button').click();
    await tools.locator('#night-note > summary').click();
    await tools.locator('#supplement-panel > summary').click();
    for (let i = 0; i < 6; i++) {
      await emptyRound.locator('#action-options summary').click();
      await emptyRound.locator('#skip-action').click();
    }
    const menu = await emptyRound.locator('#action-options summary').boundingBox();
    const description = await emptyRound.locator('#action-description').boundingBox();
    const card = await emptyRound.locator('#action-card').boundingBox();
    assert.ok(menu.y >= card.y && menu.y + menu.height <= description.y + 1);
    await emptyRound.close();
    // Old records count even when they precede installation of the companion.
    for (const [pastDays, before, after, row] of [[6, 'chick', 'juvenile', '50%'], [29, 'juvenile', 'adult', '100%']]) {
      const staged = await browser.newPage({viewport: {width: 390, height: 844}, timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce'});
      await staged.clock.install({time: new Date('2026-11-20T10:00:00+08:00')});
      await staged.goto(baseUrl);
      await staged.evaluate(count => {
        for (let ago = 1; ago <= count; ago++) {
          const prior = Ritual.offsetDay('2026-11-20', -ago);
          localStorage.setItem('early-evening-ritual.v1/' + prior + '/evening/read', JSON.stringify({status: 'done', at: 1}));
        }
      }, pastDays);
      await staged.reload();
      const scene = staged.locator('#ritual-scene');
      assert.equal(await scene.getAttribute('data-stage'), before);
      await staged.locator('#complete-action').dblclick({delay: 25});
      assert.equal(await staged.locator('#meal-count').textContent(), '今晨已喂 1 粒', '双击不应顺手记上下一项');
      assert.equal(await scene.getAttribute('data-stage'), after);
      assert.equal(await staged.locator('.sparrow').evaluate(el => getComputedStyle(el).backgroundPositionY), row);
      assert.equal(await staged.locator('#action-title').innerText(), '伸展一下');
      await staged.locator('#routine-list > summary').click();
      await staged.locator('[data-step="brush"]').click();
      assert.equal(await staged.locator('#complete-glyph').getAttribute('href'), '#icon-undo');
      assert.equal(await staged.locator('#complete-action').getAttribute('aria-label'), '撤销完成 · 刷牙');
      await staged.locator('.check-disc').click();
      assert.equal(await scene.getAttribute('data-stage'), before);
      await staged.close();
    }
    const keyboard = await browser.newPage({reducedMotion:'reduce'});
    await keyboard.goto(baseUrl);
    await keyboard.locator('[data-mode-option="morning"]').click();
    await keyboard.locator('#complete-action').focus();
    await keyboard.keyboard.down('Enter');
    await keyboard.keyboard.down('Enter');
    await keyboard.keyboard.up('Enter');
    assert.equal(await keyboard.locator('#meal-count').textContent(), '今晨已喂 1 粒');
    await keyboard.keyboard.press('Enter');
    assert.equal(await keyboard.locator('#meal-count').textContent(), '今晨已喂 2 粒');
    await keyboard.close();
    assert.deepEqual(errors, []);
    console.log('PASS: sourced quotes, corner layout, feeding poses, instant save, progression and undo, reduced-motion feedback, growth from old records, habit settings, history navigation and drill-down, cross-tab and supplement history, 320/390/768/1280 layouts, no page errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
