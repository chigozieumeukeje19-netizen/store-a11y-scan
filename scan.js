// Scans each store homepage in stores.txt with axe-core (WCAG 2.2 A/AA) and
// collects the contact emails shown on its own policy and contact pages.
const fs = require('fs');
const { chromium } = require('playwright');
const axeSrc = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const sites = fs.readFileSync('stores.txt', 'utf8').split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'));
const PAGES = ['/policies/privacy-policy', '/policies/refund-policy', '/pages/contact', '/pages/contact-us', '/policies/terms-of-service'];

async function scanOne(browser, site) {
  const out = { site, ok: false };
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'en-US' });
  const page = await ctx.newPage();
  try {
    const resp = await page.goto('https://' + site + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    out.status = resp ? resp.status() : 0;
    await page.waitForTimeout(6000);
    out.title = (await page.title()).slice(0, 80);
    out.url = page.url();
    if (/just a moment|attention required|access denied/i.test(out.title) || out.status >= 400) { out.blocked = true; return out; }
    out.shopify = await page.evaluate(() => !!window.Shopify);
    await page.addScriptTag({ content: axeSrc });
    const r = await page.evaluate(() => axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] }));
    out.passes = r.passes.length;
    out.findings = r.violations.map(v => ({
      id: v.id, impact: v.impact, count: v.nodes.length, help: v.help,
      examples: v.nodes.slice(0, 3).map(n => ({ html: n.html.replace(/\s+/g, ' ').slice(0, 220), target: n.target.join(' ').slice(0, 120),
        contrast: ((n.any[0] || {}).data || {}).contrastRatio || null })),
    }));
    out.emails = await page.evaluate(async (pages) => {
      const found = new Set();
      for (const u of pages) {
        try { const t = await (await fetch(u)).text();
          (t.match(/[\w.+-]+@[\w-]+\.[a-z.]{2,}/gi) || []).forEach(e => found.add(e.toLowerCase().replace(/\.$/, '').replace(/^(20|3d|40)/, ''))); } catch (e) {}
      }
      return [...found].filter(e => !/sentry|shopify|example|\.png|\.jpg|\.webp|giftnote|your@|email@|name@/.test(e)).slice(0, 8);
    }, PAGES);
    out.ok = true;
  } catch (e) { out.error = String(e.message).split('\n')[0].slice(0, 200); }
  finally { await ctx.close(); }
  return out;
}

(async () => {
  const browser = await chromium.launch();
  const results = []; let i = 0;
  const worker = async () => { while (i < sites.length) { const s = sites[i++]; const r = await scanOne(browser, s); results.push(r);
    console.log(`${results.length}/${sites.length}`, r.ok ? 'ok' : (r.blocked ? 'blocked' : 'error')); } };
  await Promise.all(Array.from({ length: 4 }, worker));
  await browser.close();
  fs.mkdirSync('results', { recursive: true });
  fs.writeFileSync('results/latest.json', JSON.stringify({ scanned: new Date().toISOString(), results }, null, 1));
})();
