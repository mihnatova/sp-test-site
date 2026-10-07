const { chromium } = await import(process.env.PLAYWRIGHT);
const URL_ = 'https://mihnatova.github.io/sp-test-site/test/installation/gtm/';
const SP = 'secureprivacy.ai/script/';
const ID = '6ac665e149716c13b49b9bc7';

// Puppeteer networkidle2: at most 2 in-flight for 500ms (what browserless actually waits for)
function waitIdle2(page, maxInflight = 2, idleMs = 500, timeout = 15000) {
  return new Promise((resolve) => {
    let inflight = 0, timer = null, done = false;
    const fin = (w) => { if (!done) { done = true; clearTimeout(timer); resolve(w); } };
    const arm = () => { clearTimeout(timer); timer = setTimeout(() => fin('idle'), idleMs); };
    page.on('request', () => { inflight++; if (inflight > maxInflight) clearTimeout(timer); });
    const settle = () => { inflight = Math.max(0, inflight - 1); if (inflight <= maxInflight) arm(); };
    page.on('requestfinished', settle);
    page.on('requestfailed', settle);
    arm();
    setTimeout(() => fin('timeout'), timeout);
  });
}

// download throughput in Mbps -> simulates a heavier container / slower link
const PROFILES = [
  ['no throttle',      null],
  ['10 Mbps',   10 * 1024 * 1024 / 8],
  ['5 Mbps',     5 * 1024 * 1024 / 8],
  ['2 Mbps',     2 * 1024 * 1024 / 8],
  ['1 Mbps',     1 * 1024 * 1024 / 8],
  ['512 Kbps',     512 * 1024 / 8],
];

const browser = await chromium.launch();
console.log('profile        idle2@     SP tag@    verdict');
for (const [label, bps] of PROFILES) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  if (bps !== null) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false, latency: 0, downloadThroughput: bps, uploadThroughput: bps,
    });
  }
  let tagAt = null;
  const t0 = Date.now();
  page.on('request', (r) => { if (tagAt === null && r.url().includes(SP)) tagAt = Date.now() - t0; });
  const idleP = waitIdle2(page);
  await page.goto(URL_, { waitUntil: 'commit' });
  await idleP;
  const idleAt = Date.now() - t0;
  const hit = (await page.content()).includes(SP + ID + '.js');
  console.log(
    `${label.padEnd(13)} ${String(idleAt).padStart(6)}ms ${String(tagAt ?? '-').padStart(9)}ms    ` +
    `${hit ? 'CorrectlyInstalled' : 'NotInstalled  <-- MISSED'}`
  );
  await ctx.close();
}
await browser.close();
