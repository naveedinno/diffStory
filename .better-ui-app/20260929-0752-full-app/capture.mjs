#!/usr/bin/env node
// Capture script for better-ui-app run 20260929-0752-full-app (web).
// Renders the local diffStory server with system Chrome via playwright-core.
import { chromium } from 'playwright-core';

const ORIGIN = 'http://localhost:7777';
const REPO = 'SmartDiffChecker';
const OUT = new URL('./screens/', import.meta.url).pathname;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const viewports = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 812 },
};

const screens = [
  ['picker', `/repos`],
  ['stories', `/repo/${REPO}/stories`],
  ['change', `/repo/${REPO}/change`],
  ['review', `/repo/${REPO}/review?story=story.json`],
  ['diff', `/repo/${REPO}/diff`],
];

const results = [];
const consoleErrors = [];

async function settle(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => (document.fonts ? document.fonts.status === 'loaded' : true), undefined, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(400);
}

function themeInit(theme) {
  return `(function(){try{localStorage.clear();localStorage.setItem('ds-theme','${theme}');localStorage.setItem('ds-sidebar-collapsed','0');}catch(e){}})()`;
}

async function blankCheck(page) {
  return page.evaluate(() => {
    const text = (document.body.innerText || '').trim();
    const title = document.title || '';
    return { len: text.length, title, blank: text.length < 40 };
  });
}

async function shoot(browser, name, route, viewport, theme, opts = {}) {
  const context = await browser.newContext({
    viewport: viewports[viewport],
    colorScheme: theme === 'dark' ? 'dark' : 'light',
    reducedMotion: opts.reduced ? 'reduce' : 'no-preference',
  });
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`${name}: ${msg.text().slice(0, 200)}`);
  });
  page.on('pageerror', (err) => consoleErrors.push(`${name}: pageerror ${String(err).slice(0, 200)}`));
  try {
    await page.addInitScript(themeInit(theme));
    await page.goto(ORIGIN + route, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await settle(page);
    if (opts.after) await opts.after(page, context);
    const check = await blankCheck(page);
    const file = `${OUT}${name}.png`;
    await page.screenshot({ path: file });
    results.push({ name, route, viewport, theme, ok: !check.blank, title: check.title, len: check.len, note: opts.note || '' });
    console.log(`${check.blank ? 'BLANK ' : 'ok     '} ${name} [${check.title}] (${check.len} chars)`);
  } catch (err) {
    results.push({ name, route, viewport, theme, ok: false, title: '', len: 0, note: `FAILED: ${String(err).slice(0, 160)}` });
    console.log(`FAILED ${name}: ${String(err).slice(0, 200)}`);
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
try {
  // 1. Full matrix: 5 screens x 3 viewports x 2 themes
  for (const [screen, route] of screens) {
    for (const viewport of ['desktop', 'tablet', 'mobile']) {
      for (const theme of ['dark', 'light']) {
        await shoot(browser, `${screen}-${viewport}-${theme}`, route, viewport, theme);
      }
    }
  }

  // 2. Review story step (code scene) at desktop dark/light + mobile dark
  const stepAfter = async (page) => {
    const node = page.locator('[data-thread-node="1"]').first();
    await node.waitFor({ state: 'attached', timeout: 8000 });
    await node.evaluate((el) => el.click());
    await page.waitForTimeout(600);
  };
  await shoot(browser, 'review-step-desktop-dark', `/repo/${REPO}/review?story=story.json`, 'desktop', 'dark', { after: stepAfter, note: 'story step 1 (code scene)' });
  await shoot(browser, 'review-step-desktop-light', `/repo/${REPO}/review?story=story.json`, 'desktop', 'light', { after: stepAfter, note: 'story step 1 (code scene)' });
  await shoot(browser, 'review-step-mobile-dark', `/repo/${REPO}/review?story=story.json`, 'mobile', 'dark', { after: stepAfter, note: 'story step 1 (code scene)' });

  // 3. Folder browser modal over picker (desktop dark)
  await shoot(browser, 'picker-modal-desktop-dark', '/repos', 'desktop', 'dark', {
    note: 'add-repository modal',
    after: async (page) => {
      const btn = page.locator('[data-add-repo], button:has-text("Add repository"), [data-open-browser]').first();
      await btn.waitFor({ state: 'visible', timeout: 5000 });
      await btn.click();
      await page.waitForTimeout(600);
    },
  });

  // 4. Reduced motion: review + change desktop dark
  await shoot(browser, 'review-desktop-dark-reduced', `/repo/${REPO}/review?story=story.json`, 'desktop', 'dark', { reduced: true, note: 'prefers-reduced-motion: reduce' });
  await shoot(browser, 'change-desktop-dark-reduced', `/repo/${REPO}/change`, 'desktop', 'dark', { reduced: true, note: 'prefers-reduced-motion: reduce' });
} finally {
  await browser.close();
}

// 5. Reflow 320px + 200% zoom need special contexts: separate browser for zoom flag
const zoomed = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--force-device-scale-factor=2'] });
try {
  const ctx = await zoomed.newContext({ viewport: { width: 720, height: 450 }, colorScheme: 'dark' });
  const page = await ctx.newPage();
  await page.addInitScript(themeInit('dark'));
  await page.goto(ORIGIN + `/repo/${REPO}/review?story=story.json`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await settle(page);
  await page.screenshot({ path: `${OUT}review-zoom200-dark.png` });
  results.push({ name: 'review-zoom200-dark', route: '/review', viewport: '720x450@2x ≈ 200% zoom', theme: 'dark', ok: true, title: '', len: 0, note: 'force-device-scale-factor=2' });
  console.log('ok     review-zoom200-dark');
  await ctx.close();
} catch (err) {
  results.push({ name: 'review-zoom200-dark', route: '/review', viewport: 'zoom', theme: 'dark', ok: false, title: '', len: 0, note: `FAILED: ${String(err).slice(0, 160)}` });
  console.log(`FAILED review-zoom200-dark: ${String(err).slice(0, 200)}`);
} finally {
  await zoomed.close();
}

const narrow = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
try {
  for (const [screen, route] of [['review', `/repo/${REPO}/review?story=story.json`], ['change', `/repo/${REPO}/change`]]) {
    const ctx = await narrow.newContext({ viewport: { width: 320, height: 700 }, colorScheme: 'dark' });
    const page = await ctx.newPage();
    try {
      await page.addInitScript(themeInit('dark'));
      await page.goto(ORIGIN + route, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await settle(page);
      const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);
      await page.screenshot({ path: `${OUT}${screen}-320-dark.png` });
      results.push({ name: `${screen}-320-dark`, route, viewport: '320x700', theme: 'dark', ok: true, title: '', len: 0, note: `horizontal overflow: ${Math.round(overflow)}px` });
      console.log(`ok     ${screen}-320-dark (overflow ${Math.round(overflow)}px)`);
    } catch (err) {
      results.push({ name: `${screen}-320-dark`, route, viewport: '320', theme: 'dark', ok: false, title: '', len: 0, note: `FAILED: ${String(err).slice(0, 160)}` });
      console.log(`FAILED ${screen}-320-dark: ${String(err).slice(0, 200)}`);
    }
    await ctx.close();
  }

  // 6. Keyboard pass on review page (desktop dark)
  {
    const ctx = await narrow.newContext({ viewport: viewports.desktop, colorScheme: 'dark' });
    const page = await ctx.newPage();
    await page.addInitScript(themeInit('dark'));
    await page.goto(ORIGIN + `/repo/${REPO}/review?story=story.json`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await settle(page);
    const order = [];
    await page.keyboard.press('Tab');
    for (let i = 0; i < 18; i++) {
      const desc = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return '(no focus)';
        const tag = el.tagName.toLowerCase();
        const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 50);
        const label = el.getAttribute('aria-label') || '';
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return `${tag}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.split(/\s+/).slice(0, 2).join('.') : ''} label="${label}" text="${text}" box=${Math.round(rect.width)}x${Math.round(rect.height)} outline=${style.outlineStyle} shadow=${style.boxShadow.slice(0, 40)}`;
      });
      order.push(`tab${i + 1}: ${desc}`);
      if (i === 0) await page.screenshot({ path: `${OUT}review-focus-skiplink.png` });
      if (i === 4) await page.screenshot({ path: `${OUT}review-focus-midpass.png` });
      await page.keyboard.press('Tab');
    }
    console.log('--- keyboard order ---');
    for (const line of order) console.log(line);
    results.push({ name: 'review-focus-skiplink', route: '/review', viewport: 'desktop', theme: 'dark', ok: true, title: '', len: 0, note: 'focus after 1 Tab (expect skip link)' });
    results.push({ name: 'review-focus-midpass', route: '/review', viewport: 'desktop', theme: 'dark', ok: true, title: '', len: 0, note: 'focus after 5 Tabs' });
    await ctx.close();
  }
} finally {
  await narrow.close();
}

console.log('--- console errors ---');
for (const e of [...new Set(consoleErrors)]) console.log(e);
if (!consoleErrors.length) console.log('(none)');
const failed = results.filter((r) => !r.ok);
console.log(`--- done: ${results.length - failed.length}/${results.length} ok ---`);
