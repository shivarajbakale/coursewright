import { webkit } from 'playwright';
const b = await webkit.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
await ctx.route('**/api/chapters/*/progress', (r) => r.fulfill({ json: { data: {} } }));
const page = await ctx.newPage();
await page.goto('https://coursewright.taile506df.ts.net/m/courses/bf3cc8d8-e655-41a3-b35d-fbdd7bff696b');
await page.evaluate(() => navigator.serviceWorker.ready); await page.reload();
await page.getByRole('button', { name: 'Save for offline' }).click();
await page.getByText(/^Saved · /).waitFor({ timeout: 120000 });
console.log(await page.evaluate(async () => {
  const c = await caches.open('cw-api'); const keys = await c.keys();
  const hit = await c.match('/api/chapters/422d9576-5c80-44ff-840e-19b6d52f24d2');
  const pre = (await caches.keys());
  return { apiEntries: keys.length, tokenChapter: hit ? (await hit.json()).data.title : null, caches: pre };
}));
await b.close(); process.exit(0);
