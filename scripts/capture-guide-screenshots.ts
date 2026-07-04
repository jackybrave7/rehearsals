/**
 * Captures guide v2 screenshots into public/guide/v2/
 * Prerequisite: npx tsx scripts/create-guide-session.ts
 */
import { chromium, type Locator, type Page } from 'playwright';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASE = process.env.GUIDE_CAPTURE_BASE ?? 'http://127.0.0.1:3003';
const TOKEN_FILE = path.join(ROOT, '.guide-session-token');
const OUT_DIR = path.join(ROOT, 'public', 'guide', 'v2');
const LOGIN_EMAIL = process.env.GUIDE_LOGIN_EMAIL?.trim();
const LOGIN_PASSWORD = process.env.GUIDE_LOGIN_PASSWORD;

type Theme = 'theater' | 'zen';

function token(): string {
  if (!existsSync(TOKEN_FILE)) {
    throw new Error('Run: npx tsx scripts/create-guide-session.ts');
  }
  return readFileSync(TOKEN_FILE, 'utf8').trim();
}

function outPath(slug: string, theme: Theme, ext: 'png' | 'gif'): string {
  const suffix = theme === 'zen' ? '-zen' : '';
  return path.join(OUT_DIR, `${slug}${suffix}.${ext}`);
}

async function highlight(locator: Locator): Promise<void> {
  await locator.first().evaluate((el) => {
    el.style.outline = '2px solid #ef4444';
    el.style.outlineOffset = '3px';
    el.style.borderRadius = '8px';
    el.scrollIntoView({ block: 'center', inline: 'nearest' });
  });
}

async function saveShot(
  page: Page,
  slug: string,
  theme: Theme,
  target?: Locator,
  ext: 'png' | 'gif' = 'png'
): Promise<void> {
  const file = outPath(slug, theme, ext);
  const capturePath = ext === 'gif' ? outPath(slug, theme, 'png') : file;
  if (target) {
    await highlight(target);
    await page.waitForTimeout(250);
    const box = await target.first().boundingBox();
    if (box && box.width > 40 && box.height > 40) {
      await page.screenshot({
        path: capturePath,
        clip: {
          x: Math.max(0, box.x - 24),
          y: Math.max(0, box.y - 24),
          width: Math.min(720, box.width + 48),
          height: Math.min(520, box.height + 48),
        },
      });
      if (ext === 'gif') copyFileSync(capturePath, file);
      return;
    }
  }
  await page.screenshot({ path: capturePath, fullPage: false });
  if (ext === 'gif') copyFileSync(capturePath, file);
}

async function firstRehearsalId(page: Page): Promise<string | null> {
  return page.evaluate(async () => {
    const response = await fetch('/api/state', { credentials: 'include' });
    if (!response.ok) return null;
    const state = (await response.json()) as { rehearsals?: Array<{ id: string }> };
    return state.rehearsals?.[0]?.id ?? null;
  });
}

const THEME_FILTER = process.env.GUIDE_CAPTURE_THEME as Theme | undefined;
const SLUG_FILTER = process.env.GUIDE_CAPTURE_SLUGS?.split(',').map((slug) => slug.trim()).filter(Boolean);

let activeTheme: Theme = 'theater';

async function waitForModal(page: Page) {
  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible', timeout: 15000 });
  return dialog;
}

async function openSettingsTheaterTab(page: Page): Promise<void> {
  await gotoApp(page, '/app/settings');
  const theaterTab = page.getByRole('button', { name: /театр/i });
  if (await theaterTab.count()) {
    await theaterTab.click();
    await page.waitForTimeout(400);
  }
}

async function gotoApp(page: Page, pathSuffix: string): Promise<void> {
  await page.goto(`${BASE}${pathSuffix}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(700);
}

async function openZenMenu(page: Page): Promise<void> {
  const menuBtn = page.getByRole('button', { name: 'Открыть меню' });
  if (await menuBtn.count()) {
    await menuBtn.click();
    await page.waitForTimeout(300);
  }
}

async function captureShot(
  page: Page,
  slug: string,
  theme: Theme,
  run: () => Promise<void>,
  ext: 'png' | 'gif' = 'png'
): Promise<void> {
  if (SLUG_FILTER && !SLUG_FILTER.includes(slug)) return;
  try {
    await run();
    console.log(`  ok ${slug}${theme === 'zen' ? '-zen' : ''}.${ext}`);
  } catch (error) {
    console.error(`  FAIL ${slug}:`, error instanceof Error ? error.message : error);
    const errPath = path.join(OUT_DIR, `_error-${slug}${theme === 'zen' ? '-zen' : ''}.png`);
    await page.screenshot({ path: errPath, fullPage: true });
    console.error(`  saved debug: ${path.basename(errPath)} (not copied to ${slug})`);
  }
}

async function loginWithCredentials(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${BASE}/login`, { waitUntil: 'load', timeout: 60000 });
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Пароль' }).fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await page.waitForURL(/\/app/, { timeout: 30000 });
  await page.waitForTimeout(500);
}

async function captureAll(page: Page): Promise<void> {
  const theme = activeTheme;

  await captureShot(page, 'sozdanie-teatra-v-bokovom-menyu', theme, async () => {
    await gotoApp(page, theme === 'zen' ? '/app' : '/app/scenes');
    if (theme === 'zen') {
      await openZenMenu(page);
      await saveShot(
        page,
        'sozdanie-teatra-v-bokovom-menyu',
        theme,
        page.getByRole('button', { name: /новый/i }).first()
      );
      return;
    }
    await saveShot(page, 'sozdanie-teatra-v-bokovom-menyu', theme, page.getByText('Новый', { exact: true }));
  });

  await captureShot(page, 'kartochka-novoj-postanovki', theme, async () => {
    await gotoApp(page, '/app/play');
    const edit = page.getByRole('button', { name: /редактировать/i }).first();
    await edit.scrollIntoViewIfNeeded();
    await edit.click({ force: true });
    await page.waitForTimeout(500);
    const dialog = page.getByRole('dialog');
    if (!(await dialog.isVisible())) {
      await page.locator('h2').first().screenshot({ path: outPath('kartochka-novoj-postanovki', theme, 'png') });
      return;
    }
    await saveShot(page, 'kartochka-novoj-postanovki', theme, dialog);
  });

  await captureShot(page, 'spisok-scen-s-knopkoj-dobavleniya', theme, async () => {
    await gotoApp(page, '/app/scenes');
    await saveShot(
      page,
      'spisok-scen-s-knopkoj-dobavleniya',
      theme,
      page.getByRole('button', { name: /импорт|добавить|новая/i }).first()
    );
  });

  await captureShot(page, 'raspredelenie-rolej-v-postanovke', theme, async () => {
    await gotoApp(page, '/app/play#cast');
    const cast = page.locator('#cast');
    await cast.scrollIntoViewIfNeeded();
    await saveShot(page, 'raspredelenie-rolej-v-postanovke', theme, cast, 'gif');
    copyFileSync(outPath('raspredelenie-rolej-v-postanovke', theme, 'gif'), outPath('raspredelenie-rolej-v-postanovke', theme, 'png'));
  }, 'gif');

  await captureShot(page, 'forma-ploschadki', theme, async () => {
    await gotoApp(page, '/app/venues');
    await page.locator('header').getByRole('button', { name: 'Добавить' }).click();
    const dialog = await waitForModal(page);
    await saveShot(page, 'forma-ploschadki', theme, dialog);
  });

  const rehearsalId = await firstRehearsalId(page);

  await captureShot(page, 'plan-repeticii-s-blokami-scen', theme, async () => {
    if (!rehearsalId) throw new Error('no rehearsal');
    await gotoApp(page, `/app/rehearsals/${rehearsalId}`);
    const plan = page.locator('text=План по времени').first();
    await plan.scrollIntoViewIfNeeded();
    const planSection = plan.locator('xpath=ancestor::section[1]').first();
    await saveShot(
      page,
      'plan-repeticii-s-blokami-scen',
      theme,
      (await planSection.count()) ? planSection : plan
    );
  });

  await captureShot(page, 'otpravka-plana-v-telegram', theme, async () => {
    if (!rehearsalId) throw new Error('no rehearsal');
    await gotoApp(page, `/app/rehearsals/${rehearsalId}`);
    const actions = page.getByRole('button', { name: /действия|⋮/i }).first();
    if (await actions.count()) await actions.click();
    const tgItem = page.getByRole('menuitem', { name: /telegram/i }).first();
    await saveShot(page, 'otpravka-plana-v-telegram', theme, (await tgItem.count()) ? tgItem : page.locator('body'), 'gif');
    copyFileSync(outPath('otpravka-plana-v-telegram', theme, 'gif'), outPath('otpravka-plana-v-telegram', theme, 'png'));
  }, 'gif');

  await captureShot(page, 'kabinet-aktera-blizhajshie-repeticii', theme, async () => {
    await gotoApp(page, '/app/my');
    await saveShot(page, 'kabinet-aktera-blizhajshie-repeticii', theme, page.locator('main').first());
  });

  await captureShot(page, 'blok-google-docs-na-stranice-scen', theme, async () => {
    await gotoApp(page, '/app/scenes');
    await saveShot(page, 'blok-google-docs-na-stranice-scen', theme, page.locator('text=Google').first());
  });

  await captureShot(page, 'sozdanie-repeticii', theme, async () => {
    await gotoApp(page, '/app/rehearsals');
    await page.getByRole('button', { name: /новая репетиция/i }).click({ force: true });
    await page.waitForTimeout(500);
    const dialog = page.getByRole('dialog');
    if (!(await dialog.isVisible())) {
      await page.screenshot({ path: outPath('sozdanie-repeticii', theme, 'png'), fullPage: false });
      return;
    }
    await saveShot(page, 'sozdanie-repeticii', theme, dialog);
  });

  await captureShot(page, 'dobavlenie-scen-iz-dvuh-postanovok-v-plan', theme, async () => {
    if (!rehearsalId) throw new Error('no rehearsal');
    await gotoApp(page, `/app/rehearsals/${rehearsalId}`);
    const formPlan = page.getByRole('button', { name: /сформировать план/i });
    await formPlan.waitFor({ state: 'visible', timeout: 15000 });
    await formPlan.scrollIntoViewIfNeeded();
    await formPlan.click();
    const dialog = await waitForModal(page);
    await saveShot(page, 'dobavlenie-scen-iz-dvuh-postanovok-v-plan', theme, dialog, 'gif');
    await page.keyboard.press('Escape');
  }, 'gif');

  await captureShot(page, 'nastrojka-telegram-chata-teatra', theme, async () => {
    await openSettingsTheaterTab(page);
    const tgHeading = page.getByText('Telegram чат театра');
    await tgHeading.waitFor({ state: 'visible', timeout: 15000 });
    await tgHeading.scrollIntoViewIfNeeded();
    const section = tgHeading.locator('xpath=ancestor::section[1]').first();
    await saveShot(page, 'nastrojka-telegram-chata-teatra', theme, (await section.count()) ? section : tgHeading);
  });
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  for (const theme of (THEME_FILTER ? [THEME_FILTER] : ['theater', 'zen']) as Theme[]) {
    activeTheme = theme;
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      deviceScaleFactor: 1,
    });

    const page = await context.newPage();

    if (LOGIN_EMAIL && LOGIN_PASSWORD) {
      await loginWithCredentials(page, LOGIN_EMAIL, LOGIN_PASSWORD);
    } else {
      await context.addCookies([
        {
          name: 'rehearsals_session',
          value: token(),
          domain: '127.0.0.1',
          path: '/',
        },
      ]);
      await page.goto(`${BASE}/app`, { waitUntil: 'load', timeout: 60000 });
    }
    await page.evaluate((design) => {
      localStorage.setItem('rehearsals-design', design);
    }, theme);
    await page.reload({ waitUntil: 'load' });

    console.log(`\n=== Theme: ${theme} ===`);
    await captureAll(page);

    await context.close();
  }

  await browser.close();
  console.log('\nDone. Files in public/guide/v2/');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
