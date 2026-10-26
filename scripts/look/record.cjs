const { chromium } = require('playwright');
(async () => {
  const dir = process.argv[2];
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 780, height: 1688 }, deviceScaleFactor: 1, recordVideo: { dir, size: { width: 780, height: 1688 } } });
  const p = await ctx.newPage();
  await p.goto('file://' + dir + '/app.html');
  await p.waitForTimeout(400);
  await p.evaluate(() => window.run());
  await p.waitForTimeout(300);
  await ctx.close(); await b.close();
})();
