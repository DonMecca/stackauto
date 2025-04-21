// gensparkAutomation.js
// Automates GenSpark Super Agent prompt submission and result copy using Puppeteer
// Usage: Call runGenSparkAutomation(appsumoUrl, promptTemplate)

const fs = require('fs');
const path = require('path');

const GensparkUrl = 'https://www.genspark.ai/';
const PromptSelector = 'textarea[placeholder="Ask anything, create anything"]';
const SubmitSelector = 'div.enter-icon-wrapper';
const CopyButtonSelector = 'div.conversation-item-desc.assistant div.button .label';

async function runGenSparkAutomation(appsumoUrl, promptTemplate, extractionMethod = 'clipboard') {
  const puppeteer = require('puppeteer');
  const clipboardy = await import('clipboardy');
  const prompt = promptTemplate.replace(/https:\/\/appsumo.com\/products\/example-app\//, appsumoUrl);
  const singletonLockPath = path.join(__dirname, 'genspark-profile', 'SingletonLock');
  try {
    if (fs.existsSync(singletonLockPath)) {
      fs.unlinkSync(singletonLockPath);
    }
  } catch {}

  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: './genspark-profile',
    args: ['--start-maximized']
  });
  const [page] = await browser.pages().then(pages => pages.length ? pages : [browser.newPage()]);
  const { width, height } = await page.evaluate(() => ({ width: window.screen.width, height: window.screen.height }));
  await page.setViewport({ width, height });

  try {
    const cookiesPath = './gensparkCookies.json';
    if (fs.existsSync(cookiesPath)) {
      const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'));
      await page.setCookie(...cookies);
    }
  } catch {}

  await page.goto(GensparkUrl, { waitUntil: 'networkidle2' });
  await page.waitForSelector(PromptSelector, { timeout: 60000 });
  await page.evaluate((selector, prompt) => {
    const textarea = document.querySelector(selector);
    textarea.value = prompt;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }, PromptSelector, prompt);
  await page.click(SubmitSelector);
  await page.waitForSelector(CopyButtonSelector, { timeout: 180000 });

  let clipboardResult = '';
  let domResult = '';

  if (extractionMethod === 'clipboard' || extractionMethod === 'both') {
    // Clipboard polling logic for reliability
    const before = await clipboardy.default.read();
    await page.click(CopyButtonSelector);
    let clipboardContent = '';
    const maxTries = 10;
    for (let i = 0; i < maxTries; i++) {
      await page.waitForTimeout(200);
      clipboardContent = await clipboardy.default.read();
      if (clipboardContent && clipboardContent !== before) break;
    }
    clipboardResult = clipboardContent;
  }

  if (extractionMethod === 'dom' || extractionMethod === 'both') {
    domResult = await page.$eval('.conversation-item-desc.assistant', el => el.innerText);
  }

  await browser.close();
  return { clipboard: clipboardResult, dom: domResult };
}

module.exports = { runGenSparkAutomation };
