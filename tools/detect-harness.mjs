// Point PLAYWRIGHT at any checkout that already has playwright installed, e.g.
//   PLAYWRIGHT=~/secure-privacy-web-v2/e2e/node_modules/playwright/index.mjs node <script>
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');

const BASE = 'https://mihnatova.github.io/sp-test-site/test/installation';
const SP = 'secureprivacy.ai/script/';

// the "domain ID" each fixture is stamped with (placeholders, pre-registration)
const SCENARIOS = [
  { name: 'direct',   id: '6ac65fd28927a02bcaba001f' },
  { name: 'gtm',      id: '6ac665e149716c13b49b9bc7' },    // container not published; scenario 02 is out of this run
  { name: 'dynamic',  id: '6ac665e58927a02bcaba0088' }, // assembled at runtime
  { name: 'none',     id: '6ac665ea49716c13b49b9bca' },   // no ID on the page by design
  { name: 'delayed',  id: '6ac665ee8927a02bcaba008e' }, // assembled at runtime
  { name: 'bare-id',  id: '6ac665f249716c13b49b9bd0' },
];

function scriptSrcs(src) {
  const out = [];
  const re = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(src))) out.push(m[1]);
  return out.filter(Boolean).sort((a, b) => src.indexOf(a) - src.indexOf(b));
}

// returns [status, whichBranchFired]
function check(scripts, source, id, enforceOrdering) {
  const exact = SP + id + '.js';
  if (scripts.some((s) => s.includes(exact))) {
    if (!enforceOrdering) return ['CorrectlyInstalled', 'script-src match'];
    return scripts[0].includes(exact)
      ? ['CorrectlyInstalled', 'script-src match (first)']
      : ['NotFirstScript', 'script-src match (not first)'];
  }
  if (source.includes(id)) return ['CorrectlyInstalled', 'bare domain-ID substring'];
  if (source.includes(SP)) return ['InvalidDomain', 'SP url substring'];
  return ['NotInstalled', '-'];
}

const browser = await chromium.launch();
const rows = [];

for (const { name, id } of SCENARIOS) {
  const url = `${BASE}/${name}/`;

  const raw = await (await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.2; WOW64; Trident / 6.0)' },
  })).text();
  const [p1, p1why] = check(scriptSrcs(raw), raw, id, true);

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const nav0 = Date.now();
  let spAt = null;
  page.on('request', (r) => { if (spAt === null && r.url().includes(SP)) spAt = Date.now() - nav0; });

  const t2 = Date.now();
  try { await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 }); } catch {}
  const idleMs = Date.now() - t2;
  const rendered = await page.content();

  // the backend only runs browserless when pass 1 came back NotInstalled
  const reaches = p1 === 'NotInstalled';
  const [p2, p2why] = check(scriptSrcs(rendered), rendered, id, false);

  let eventual = spAt;
  if (eventual === null) {
    try { await page.waitForRequest((r) => r.url().includes(SP), { timeout: 8000 }); eventual = Date.now() - nav0; }
    catch { eventual = null; }
  }
  await ctx.close();

  const final = reaches ? p2 : p1;
  rows.push({ name, p1, p1why, reaches, p2, p2why, final, idleMs, spAt: eventual });

  console.log(
    `${name.padEnd(8)} | pass1 ${p1.padEnd(18)} (${p1why.padEnd(26)}) | browserless ${reaches ? 'RUNS ' : 'skipped'} ` +
    `${(reaches ? p2 : '-').padEnd(18)} | idle ${String(idleMs).padStart(4)}ms | tag@ ${spAt === null ? 'never' : spAt + 'ms'} | FINAL ${final}`
  );
}

await browser.close();
console.log('\n' + JSON.stringify(rows, null, 2));
