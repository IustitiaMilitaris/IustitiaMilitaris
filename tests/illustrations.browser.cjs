const { chromium } = require('playwright');
const { spawn } = require('node:child_process'),
  fs = require('node:fs/promises'),
  os = require('node:os'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'),
  en = require('../src/i18n/scenarios.en.json');
(async () => {
  const uk = {};
  for (const file of await fs.readdir(root + '/stsenarii'))
    if (file.endsWith('.json')) {
      const s = JSON.parse(
        await fs.readFile(root + '/stsenarii/' + file, 'utf8')
      );
      uk[s.id] = s;
    }
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'description-test-'));
  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: root,
    env: { ...process.env, PORT: '18496', DATA_DIR: dir },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let browser;
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('startup')), 10000);
      server.stdout.on('data', (d) => {
        if (String(d).includes('Local:')) {
          clearTimeout(timer);
          resolve();
        }
      });
      server.once('exit', () => reject(Error('server exited')));
    });
    browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      headless: true,
      args: ['--no-sandbox']
    });
    for (const theme of ['dark', 'light'])
    for (const lang of ['uk', 'en'])
      for (const width of [375, 1280]) {
        const c = await browser.newContext({
          viewport: { width, height: 900 }
        });
        await c.addInitScript(
          ({lang,theme}) => { localStorage.setItem('eds-language', lang); localStorage.setItem('eds-theme', theme); },
          {lang,theme}
        );
        const p = await c.newPage();
        await p.goto('http://127.0.0.1:18496/');
        await p.evaluate(() => document.fonts.ready);
        const cards = p.locator('.scenario-card');
        await cards.first().waitFor();
        await p.waitForFunction(() => [...document.querySelectorAll('.scenario-card img')].length === 3 && [...document.querySelectorAll('.scenario-card img')].every(i => i.naturalWidth > 0));
        const positions = await cards.evaluateAll(es => es.map(e => {const i=e.querySelector('img').getBoundingClientRect();return {y:i.y,w:i.width,h:i.height};}));
        positions.forEach(i => assert.ok(Math.abs(i.w/i.h-16/9)<0.05));
        if(width===1280) assert.ok(Math.max(...positions.map(i=>i.y))-Math.min(...positions.map(i=>i.y))<2);

        if (lang === 'en' && width === 1280) {
          await cards.first().waitFor();
          assert.equal(await cards.first().locator('.description-preview').textContent(), en.S01.sytuatsiia);
          assert.equal(await cards.first().locator('.description-more,.description-continuation').count(), 0);
          const aligned = await cards.evaluateAll(es => es.map(e => ({
            height:e.getBoundingClientRect().height,
            metadata:e.querySelector('.scenario-card-metadata').getBoundingClientRect().top,
            actions:e.lastElementChild.getBoundingClientRect().top
          })));
          for (const card of aligned) for (const key of ['height','metadata','actions']) assert.ok(Math.abs(card[key]-aligned[0][key])<1, key);
        }

        const starts = await cards.evaluateAll((els) =>
          els.map((el) => ({
            top: el.getBoundingClientRect().top,
            start: el
              .querySelector('.scenario-description')
              .getBoundingClientRect().top
          }))
        );
        for (const a of starts)
          for (const b of starts.filter((b) => Math.abs(a.top - b.top) < 2))
            assert.ok(
              Math.abs(a.start - b.start) < 2,
              JSON.stringify({ a, b })
            );
        for (let i = 0; i < (await cards.count()); i++) {
          const card = cards.nth(i),
            desc = card.locator('.scenario-description'),
            preview = await desc.locator('.description-preview').textContent(),
            popup = desc.locator('.description-continuation');
          const id = (
              await card
                .locator('.scenario-card-description span')
                .first()
                .textContent()
            ).trim(),
            scenarioId = `S${Number(id.match(/(\d+)$/)[1]).toString().padStart(2, '0')}`,
            original = (lang === 'uk' ? uk : en)[scenarioId].sytuatsiia;
          assert.ok(Array.from(preview).length > 0);
          if (scenarioId === 'S02') {
            assert.equal(preview, original);
            assert.equal(await popup.count(), 0);
            assert.equal(await desc.getByRole('button').count(), 0);
          }
          const endings = [...original.matchAll(/[.!?](?=\s|$)/gu)].map(
            (m) => m.index + 1
          );
          if (endings[0] < 240 && endings.length > 1)
            assert.ok(preview.length >= endings[1]);

          if (await popup.count()) assert.match(preview, /[.!?]$/u);
          assert.equal(
            await desc.locator('p').first().getAttribute('lang'),
            lang
          );
          assert.equal(
            await desc
              .locator('p')
              .first()
              .evaluate((el) => getComputedStyle(el).textAlignLast),
            'left'
          );
          const typography = await desc
            .locator('p')
            .first()
            .evaluate((el) => {
              const css = getComputedStyle(el);
              const range = document.createRange();
              range.selectNodeContents(
                el.querySelector('.description-preview')
              );
              return {
                align: css.textAlign,
                height: el.getBoundingClientRect().height,
                line: parseFloat(css.lineHeight),
                bottom: range.getBoundingClientRect().bottom,
                boxBottom: el.getBoundingClientRect().bottom
              };
            });
          assert.equal(typography.align, 'justify');
          assert.ok(
            typography.height >= typography.line * 7 - 1,
            JSON.stringify(typography)
          );
          assert.ok(typography.bottom <= typography.boxBottom + 1);
          assert.equal(
            preview + ((await popup.count()) ? await popup.textContent() : ''),
            original
          );
          const descriptionBounds = await desc.boundingBox();
          const titleBounds = await card
            .locator('.scenario-card-title')
            .boundingBox();
          assert.ok(Math.abs(descriptionBounds.x - titleBounds.x) < 1);
          if (await popup.count()) {
            assert.match(preview, /[.!?]$/u);
            await desc.evaluate((e) => e.scrollIntoView({ block: 'center' }));
            await p.mouse.move(0, 0);
            await p.evaluate(() =>
              Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {})))
            );
            const positions = () =>
              p
                .locator(
                  '.scenario-card, .scenario-card-metadata, .scenario-secondary-actions'
                )
                .evaluateAll((els) =>
                  els.map((el) => {
                    const r = el.getBoundingClientRect();
                    return [r.x, r.y, r.width, r.height];
                  })
                );
            const before = await positions();
            await desc.hover();
            await popup.waitFor({ state: 'visible' });
            await popup.evaluate((e) =>
              Promise.all(e.getAnimations().map((a) => a.finished.catch(() => {})))
            );
            assert.deepEqual(await positions(), before);
            const a = await desc.boundingBox(),
              b = await popup.boundingBox();
            assert.ok(Math.abs(a.width - b.width) < 1);
            assert.ok(Math.abs(a.x - b.x) < 1);
            assert.deepEqual(
              await popup.evaluate((e) => {
                const s = getComputedStyle(e);
                return [
                  s.position,
                  s.maxHeight,
                  s.overflowY,
                  s.overflowX,
                  e.scrollHeight <= e.clientHeight
                ];
              }),
              ['absolute', 'none', 'visible', 'visible', true]
            );
            await p.mouse.move(0, 0);
            await desc.getByRole('button').focus();
            await popup.waitFor({ state: 'visible' });
            await desc.getByRole('button').evaluate((e) => e.blur());
          } else assert.equal(await desc.getByRole('button').count(), 0);
        }
        assert.equal(
          await p.evaluate(
            () => document.documentElement.scrollWidth > innerWidth
          ),
          false
        );
        await p.setViewportSize({
          width: width === 360 ? 1280 : 360,
          height: 900
        });
        await p.waitForFunction(() =>
          [...document.querySelectorAll('.description-preview-box')].every(
            (el) => {
              const range = document.createRange();
              range.selectNodeContents(
                el.querySelector('.description-preview')
              );
              return (
                range.getBoundingClientRect().bottom <=
                el.getBoundingClientRect().bottom + 1
              );
            }
          )
        );
        await p.goto('http://127.0.0.1:18496/');
        await p.setViewportSize({width,height:500});
        await p.locator('.scenario-description').first().waitFor();await p.locator('.scenario-description').first().evaluate(e=>{
          // Keep the stacking regression exercised when current catalogue copy fits in full.
          if(!e.querySelector('.description-continuation')){const button=document.createElement('button');button.className='description-more';button.textContent='[···]';e.append(button);const popup=document.createElement('div');popup.className='description-continuation absolute left-0 right-0 top-full mt-1.5 w-full z-40 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible';popup.textContent='Continuation '.repeat(100);e.append(popup);}
        });
        const more=p.locator('.description-more').first();await more.hover();await more.focus();
        await p.waitForFunction(()=>getComputedStyle(document.querySelector('.description-continuation')).opacity==='1');
        const down=await p.locator('.scenario-description').first().evaluate(e=>e.querySelector('.description-continuation').getBoundingClientRect().top>=e.getBoundingClientRect().bottom);assert.equal(down,true);
        await p.locator('.description-continuation').first().evaluate(e=>window.scrollBy(0,e.getBoundingClientRect().top-20));
        assert.equal(await p.evaluate(()=>{const pop=document.querySelector('.description-continuation').getBoundingClientRect(),header=document.querySelector('.site-header').getBoundingClientRect();const x=Math.min(innerWidth-10,Math.max(10,pop.left+20)),y=Math.min(header.bottom-2,Math.max(2,pop.top+10));return pop.top<header.bottom&&document.elementFromPoint(x,y)?.closest('.site-header')!==null;}),true);
        assert.equal(await p.locator('main').evaluate(e=>getComputedStyle(e).zIndex),'10');assert.equal(await p.locator('.site-header').evaluate(e=>getComputedStyle(e).zIndex),'50');
        await c.close();
        console.log(
          'PASS complete-sentence preview, exact continuation, overlay width, hover/focus and zero card/metadata/action displacement',
          lang,
          width
        );
      }
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
    await new Promise((r) =>
      server.exitCode !== null ? r() : server.once('exit', r)
    );
    await fs.rm(dir, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
