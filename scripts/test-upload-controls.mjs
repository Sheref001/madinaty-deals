/* global DataTransfer, File, DragEvent */
// Run against local Vite only. API calls are mocked; no accounts or files reach production.
// UPLOAD_TEST_BASE=http://127.0.0.1:5173 node scripts/test-upload-controls.mjs
import assert from 'node:assert/strict';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { URL } from 'node:url';
import console from 'node:console';
import { chromium, webkit } from '@playwright/test';
const base = process.env.UPLOAD_TEST_BASE || 'http://127.0.0.1:5173';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Local testing only');
const photo = { name: 'test.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64') };
const pdf = { name: 'proof.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\n%%EOF') };
for (const [name, engine] of Object.entries({ webkit, chromium })) {
  if (process.env.UPLOAD_TEST_BROWSER && name !== process.env.UPLOAD_TEST_BROWSER) continue;
  const executablePath = process.env[`${name.toUpperCase()}_TEST_EXECUTABLE`];
  const browser = await engine.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  try {
    for (const width of [320, 390, 1280]) for (const language of ['en', 'ar']) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      page.setDefaultTimeout(10000);
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      let uploaded;
      let rejectPhoto = true;
      let submissions = 0;
      await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== new URL(base).origin) return route.abort();
        if (!url.pathname.startsWith('/api/')) return route.continue();
        let data = {};
        if (url.pathname === '/api/config') data = { registrationEnabled: true, cognitoEnabled: true };
        if (url.pathname === '/api/auth/session') data = { csrfToken: 'test', user: { id: 'test', name: 'Test', role: 'RESIDENT', residentVerified: false } };
        if (url.pathname === '/api/uploads') {
          if (url.searchParams.get('purpose') === 'photo' && rejectPhoto) return route.fulfill({ status: 413, contentType: 'text/html', body: '<html>413 Request Entity Too Large</html>' });
          uploaded = route.request().headers();
          data = { upload: { id: 'test-upload' } };
        }
        if (url.pathname === '/api/submissions') { submissions++; data = { id: 'test-submission', status: 'PENDING_REVIEW' }; }
        return route.fulfill({ json: data });
      });
      const text = (en, ar) => language === 'en' ? en : ar;
      await page.goto(`${base}/?lang=${language}`);
      await page.getByRole('button', { name: text('Sign out', 'تسجيل الخروج'), exact: true }).waitFor();
      for (const service of [false, true]) {
        await page.getByRole('button', { name: text('Sell something', 'أضف إعلانًا') }).first().click();
        await page.getByRole('button', { name: service ? /Offer a service|قدّم خدمة/ : /Sell an item|بيع منتج/ }).click();
        const input = page.locator('input[type=file]');
        const box = await input.boundingBox();
        assert(box && box.width > 100 && box.height >= 44 && box.x >= 0 && box.x + box.width <= width, 'File control is visible and fits viewport');
        const chooserEvent = page.waitForEvent('filechooser', { timeout: 5000 });
        await input.click();
        const chooser = await chooserEvent;
        assert(chooser.isMultiple());
        await chooser.setFiles(photo);
        await page.locator('.media-preview-grid img').waitFor();
        await page.locator('.media-preview-grid button').click();
        assert.equal(await page.locator('.media-preview-grid img').count(), 0);
        // A second direct activation after removing the same file must still work.
        const nextChooser = page.waitForEvent('filechooser');
        await input.click();
        await (await nextChooser).setFiles(photo);
        await page.locator('.media-preview-grid img').waitFor();
        if (!service) {
          await page.getByLabel(text('What are you selling?', 'ماذا تبيع؟'), { exact: true }).fill('Small wooden table');
          await page.getByLabel(text('Description', 'الوصف'), { exact: true }).fill('A wooden table in good condition.');
          await page.getByLabel(text('Price (EGP)', 'السعر (جنيه مصري)'), { exact: true }).fill('500');
          await page.getByRole('button', { name: text('Preview listing', 'معاينة الإعلان'), exact: true }).click();
          await page.getByRole('button', { name: text('Submit for review', 'إرسال للمراجعة'), exact: true }).click();
          await page.getByRole('alert').waitFor();
          assert.match(await page.getByRole('alert').innerText(), /hello@madinatydeals.com/);
          assert.equal(submissions, 0, 'Upload failure must not create a submission');
          await page.getByRole('button', { name: text('Edit details', 'تعديل التفاصيل'), exact: true }).click();
          assert.equal(await page.getByLabel(text('What are you selling?', 'ماذا تبيع؟'), { exact: true }).inputValue(), 'Small wooden table');
          await page.locator('.media-preview-grid button').click();
          // Test the alternative that avoids the operating system's file window.
          await page.locator('.file-drop-area').evaluate((el, bytes) => {
            const data = new DataTransfer();
            data.items.add(new File([new Uint8Array(bytes)], 'dropped.png', { type: 'image/png' }));
            el.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: data }));
          }, Array.from(photo.buffer));
          await page.locator('.media-preview-grid img').waitFor();
          rejectPhoto = false;
          await page.getByRole('button', { name: text('Preview listing', 'معاينة الإعلان'), exact: true }).click();
          await page.getByRole('button', { name: text('Submit for review', 'إرسال للمراجعة'), exact: true }).click();
          await page.getByRole('dialog').waitFor({ state: 'hidden' });
          assert.equal(submissions, 1);
        } else await page.keyboard.press('Escape');
      }
      // Exercise the document input inside the real verification modal.
      await page.locator('.mobile-verify-cta').first().evaluate(el => el.click());
      const input = page.locator('input[type=file]');
      const chooserEvent = page.waitForEvent('filechooser');
      await input.click();
      const chooser = await chooserEvent;
      assert.equal(chooser.isMultiple(), false);
      await chooser.setFiles(pdf);
      await page.getByRole('button', { name: text('Request verification', 'طلب التوثيق'), exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      assert.equal(uploaded?.['content-type'], pdf.mimeType);
      assert.equal(uploaded?.['x-file-name'], pdf.name);
      assert.deepEqual(errors, []);
      console.log(`PASS ${name} ${language} ${width}px: chooser, drop, HTML 413 recovery, mocked listing/document submission`);
      await page.close();
    }
  } finally { await browser.close(); }
}
