import { chromium } from 'playwright';
const [dir, step] = process.argv.slice(2);
const ctx = await chromium.launchPersistentContext(dir, { viewport: { width: 390, height: 844 }, serviceWorkers: 'allow',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
await ctx.route('**/api/chapters/*', (r) => r.request().method() === 'GET' ? r.continue({ headers: { ...r.request().headers(), 'x-cw-prefetch': '1' } }) : r.continue());
const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.goto('https://coursewright.taile506df.ts.net/m/settings');
await page.evaluate(() => navigator.serviceWorker.ready);
const sw = async () => page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.scriptURL + ' waiting=' + !!(await navigator.serviceWorker.getRegistration())?.waiting);
if (step === 'before') {
  console.log('before deploy:', await sw());
} else {
  const prompt = page.getByText('A new version of the reader is ready');
  await prompt.waitFor({ timeout: 60000 });
  console.log('prompt shown;', await sw());
  await page.screenshot({ path: dir + '/../update-prompt.png' });
  await page.getByRole('button', { name: 'Reload' }).click();
  await page.waitForTimeout(4000);
  console.log('after Reload:', page.url().replace(/^https:\/\/[^/]+/, ''), await sw(), '| prompt gone:', !(await prompt.isVisible()));
}
await ctx.close();
process.exit(0);
