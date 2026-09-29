#!/usr/bin/env node
// Short motion recording: review overview -> story step transition + accordion.
import { chromium } from 'playwright-core';
const ORIGIN = 'http://localhost:7777';
const OUT = new URL('./screens/', import.meta.url).pathname;
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', recordVideo: { dir: OUT, size: { width: 1440, height: 900 } } });
const page = await ctx.newPage();
await page.addInitScript(`(function(){try{localStorage.clear();localStorage.setItem('ds-theme','dark');}catch(e){}})()`);
await page.goto(ORIGIN + '/repo/SmartDiffChecker/review?story=story.json', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(800);
const node = page.locator('[data-thread-node="1"]').first();
await node.waitFor({ state: 'attached', timeout: 8000 });
await node.evaluate((el) => el.click());
await page.waitForTimeout(1500);
await page.keyboard.press('j');
await page.waitForTimeout(1500);
await ctx.close();
await browser.close();
console.log('recording done');
