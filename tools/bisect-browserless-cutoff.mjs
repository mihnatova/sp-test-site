import http from 'node:http';
// Point PLAYWRIGHT at any checkout that already has playwright installed, e.g.
//   PLAYWRIGHT=~/secure-privacy-web-v2/e2e/node_modules/playwright/index.mjs node <script>
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');

const DELAYS = [0, 250, 500, 750, 1000, 1500, 2000, 3000, 4000];
const SP = 'secureprivacy.ai/script/';
const ID = 'deadbeefdeadbeefdeadbeef';

// serve a page whose SP tag is injected after ?d= ms, with the URL assembled at runtime
const server = http.createServer((req, res) => {
  const d = Number(new URL(req.url, 'http://x').searchParams.get('d') || 0);
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`<!DOCTYPE html><html><head><title>d=${d}</title></head><body>
<h1>delay ${d}ms</h1>
<script>
(function(){
  var host = "https://frontend-test.secure" + "privacy.ai/script/";
  var id = "deadbeef" + "deadbeefdeadbeef";
  function inject(){ var s=document.createElement('script'); s.src=host+id+".js"; document.head.appendChild(s); }
  ${d === 0 ? 'inject();' : `setTimeout(inject, ${d});`}
})();
</script></body></html>`);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

// Puppeteer's networkidle2: at most 2 in-flight requests for 500ms
function waitForNetworkIdle2(page, maxInflight = 2, idleMs = 500, timeout = 15000) {
  return new Promise((resolve) => {
    let inflight = 0, timer = null, done = false;
    const finish = (why) => { if (!done) { done = true; clearTimeout(timer); resolve(why); } };
    const arm = () => { clearTimeout(timer); timer = setTimeout(() => finish('idle'), idleMs); };
    const disarm = () => clearTimeout(timer);
    page.on('request', () => { inflight++; if (inflight > maxInflight) disarm(); });
    const settle = () => { inflight = Math.max(0, inflight - 1); if (inflight <= maxInflight) arm(); };
    page.on('requestfinished', settle);
    page.on('requestfailed', settle);
    arm();
    setTimeout(() => finish('timeout'), timeout);
  });
}

const browser = await chromium.launch();
console.log('delay   idle2@    tagSeen@   snapshot contains SP tag?');
for (const d of DELAYS) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const t0 = Date.now();
  let tagAt = null;
  page.on('request', (r) => { if (tagAt === null && r.url().includes(SP)) tagAt = Date.now() - t0; });

  const idleP = waitForNetworkIdle2(page);
  await page.goto(`http://127.0.0.1:${port}/?d=${d}`, { waitUntil: 'commit' });
  const why = await idleP;
  const idleAt = Date.now() - t0;

  const html = await page.content();
  const hit = html.includes(SP + ID + '.js');
  console.log(
    `${String(d).padStart(5)}ms ${String(idleAt).padStart(6)}ms ${String(tagAt ?? '-').padStart(9)}ms   ` +
    `${hit ? 'YES -> CorrectlyInstalled' : 'NO  -> NotInstalled'}${why === 'timeout' ? '  [idle timed out]' : ''}`
  );
  await ctx.close();
}
await browser.close();
server.close();
