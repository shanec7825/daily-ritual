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
    const feedback = page.locator('#completion-feedback');
    const sceneProgress = () => page.locator('#ritual-scene').evaluate(el => Number(getComputedStyle(el).getPropertyValue('--progress')));
    assert.equal(await page.locator('#history-view').isHidden(), true);
    assert.equal(await page.locator('#top-date').getAttribute('datetime'), '2026-11-20');
    assert.equal(await page.locator('#top-weekday').textContent(), '星期五');
    await page.locator('[data-mode-option="morning"]').click();
    assert.equal(await page.locator('#action-title').textContent(), '刷牙');
    assert.equal(await feedback.isHidden(), true);
    assert.equal(await sceneProgress(), 0);
    assert.equal(await page.locator('.rising-sun').isVisible(), true);
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
    await waitForTitle('伸展一下');
    assert.equal(await feedback.innerText(), '刚完成「刷牙」 · 今晨 1/6');
    assert.equal(await sceneProgress(), 1 / 6);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'action-title');
    await page.locator('#action-options summary').click();
    await page.locator('#skip-action').click();
    assert.equal(await page.locator('#action-title').textContent(), '阅读');
    await page.reload();
    assert.equal(await page.locator('#action-title').textContent(), '阅读');
    assert.equal(await feedback.innerText(), '刚完成「刷牙」 · 今晨 1/6');
    await page.locator('#manage-habits').click();
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
    await page.locator(`[data-step="${custom}"]`).click();
    assert.equal(await page.locator('#action-title').textContent(), '练琴十分钟');
    await page.locator('#complete-action').click();
    await waitForTitle('闲走');
    assert.equal(await feedback.innerText(), '刚完成「练琴十分钟」 · 今晨 2/7');
    await page.locator('#open-history').click();
    await page.waitForURL(/#footprints$/);
    await page.locator('#heatmap-title').waitFor();
    assert.equal(await page.locator('#daily-view').isHidden(), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'heatmap-title');
    assert.equal(await page.locator('.heat-cell').count(), 7);
    await page.locator('[data-range="month"]').click();
    assert.equal(await page.locator('.heat-cell').count(), 30);
    assert.equal(await page.locator('.heat-cell').first().evaluate(cell => getComputedStyle(cell).gridColumnStart), '7');
    await page.locator('[data-day="2026-11-20"]').click();
    assert.match(await page.locator('#heatmap-detail').textContent(), /2026-11-20 · 刷牙 · 已完成/);
    await page.locator('[data-range="year"]').click();
    assert.equal(await page.locator('.heat-cell').count(), 365);
    assert.equal(await page.locator('.mini-month').count(), 12);
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
    assert.equal(await feedback.isHidden(), true);
    assert.equal(await sceneProgress(), 0);
    assert.equal(await page.locator('.evening-window').isVisible(), true);
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
    await page.locator('[data-step="stretch"]').click();
    await page.locator('#complete-action').click();
    await waitForTitle('今晨 7 项，全部完成');
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
    assert.equal(await feedback.innerText(), '刚完成「睡前刷牙」 · 今晚 2/7');
    assert.equal(await sceneProgress(), 2 / 7);
    assert.equal(await page.locator('.lamplight').evaluate(el => getComputedStyle(el).transitionDuration), '0s');

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => {
      document.getElementById('complete-action').click();
      const key = 'early-evening-ritual.v1/2026-11-20/evening/read';
      const newValue = JSON.stringify({ status: 'done', at: Date.now() });
      localStorage.setItem(key, newValue);
      window.dispatchEvent(new StorageEvent('storage', { key, newValue }));
    });
    await waitForTitle('写作表达');
    assert.deepEqual(errors, []);
    console.log('PASS: dates, immediate save and completion feedback, skip/finish/undo, cancellation and reduced motion, habit settings, history route/back/forward, week/month/year and drill-down, cross-tab and supplement history, 320/390/768/1280 layouts, no page errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
