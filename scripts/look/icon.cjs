const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 512, height: 512 } });
await p.goto('file://' + process.argv[2] + '/icon.html'); await p.screenshot({ path: process.argv[2] + '/icon.png' }); await b.close(); })();
