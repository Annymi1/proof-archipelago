#!/usr/bin/env node
/* Smoke test for Proof Archipelago.
   It serves the repository, opens the real game in a headless browser and checks the things that have broken before:
   level data, every level and lab toy on a narrow phone (EN and RU), Russian texts, a play-through of the levels with
   the keyed answers, Back button and links, multi-part levels, carrying progress, and the offline / update behaviour
   of the service worker.

   Run:  cd tests && npm ci && npx playwright install chromium && npm test
   A failing check prints FAIL with details and the script exits with code 1. */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const overrides = new Map(); // path → text; lets a test pretend that the server has a newer file
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  const body = overrides.has(p) ? Buffer.from(overrides.get(p))
    : file.startsWith(ROOT + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile() ? fs.readFileSync(file) : null;
  if (!body) { res.writeHead(404).end('not found'); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' }).end(body);
});

let failed = 0;
function check(name, ok, detail) {
  if (!ok) failed++;
  console.log((ok ? '  ok    ' : '  FAIL  ') + name + (ok || detail === undefined ? '' : '\n          ' + JSON.stringify(detail).slice(0, 900)));
}

/* Strings that are the same in Russian (formulas with English identifiers, names of sets). Everything else in the level
   data that contains an English word must have a Russian entry — add it to the dictionary, or list the string here. */
const SAME_IN_RUSSIAN = [/dreams\(p, d\)/, /solve\(x\)/, /^const$/, /^(No|Empty|Always)-halt$/, /^(indeg|outdeg|depth)\([A-Z]\) = \?$/];

async function main() {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const BASE = 'http://localhost:' + server.address().port + '/';
  const browser = await chromium.launch();
  const open = async (opts = {}, lang = 'en', url = BASE) => {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 }, ...opts });
    const page = await ctx.newPage();
    page.errors = [];
    page.on('pageerror', e => page.errors.push(e.message));
    await page.addInitScript(l => { try { if (!localStorage.getItem('proof-archipelago-lang')) localStorage.setItem('proof-archipelago-lang', l); } catch (e) {} }, lang);
    await page.goto(url, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    return page;
  };
  const settled = page => page.waitForFunction(() => pend === null); // an in-app “←” goes through history.back()

  try {
    /* ---------- level data ---------- */
    console.log('\nLevel data');
    {
      const page = await open();
      const bad = await page.evaluate(() => {
        const out = [], ids = new Set();
        const mc = (q, L, at) => { const o = q.opts || L.opts;
          if (!o) return out.push(at + ': no options');
          if (!(Number.isInteger(q.a) && q.a >= 0 && q.a < o.length)) out.push(at + ': answer index ' + q.a + ' is outside the options');
          if (new Set(o).size !== o.length) out.push(at + ': two identical options');
          if (!q.q || !q.why) out.push(at + ': question or explanation is missing');
          for (const k of Object.keys(q.wrong || {})) if (+k === q.a || +k >= o.length) out.push(at + ': “wrong” message for option ' + k + ' cannot be shown'); };
        const visit = (L, at) => {
          if (!C[L.type]) return out.push(at + ': unknown level type ' + L.type);
          if (L.type === 'mc') (L.qs || []).forEach((q, i) => mc(q, L, at + ' q' + (i + 1)));
          if (L.type === 'input') L.qs.forEach((q, i) => { if (typeof q.a !== 'number') out.push(at + ' q' + (i + 1) + ': the answer is not a number'); });
          if (L.type === 'order') L.lines.forEach((l, i) => { if (l.r && !L.reasons.includes(l.r)) out.push(at + ' line ' + (i + 1) + ': reason is not among the reasons'); });
          if (L.type === 'cloze') { const used = new Set();
            L.lines.forEach(t => (t.match(/\{(\w+)\}/g) || []).forEach(m => { const k = m.slice(1, -1); if (!L.gaps[k]) out.push(at + ': gap {' + k + '} has no answer'); used.add(k); }));
            for (const k of Object.keys(L.gaps)) { const g = L.gaps[k]; if (!used.has(k)) out.push(at + ': answer “' + k + '” has no gap');
              if (g.o ? !g.o.includes(g.a) : !(Array.isArray(g.a) && g.a.length)) out.push(at + ': gap {' + k + '} has no valid answer'); } }
          if (L.type === 'ttable' || L.type === 'venn') L.rounds.forEach((R, i) => { if (R.q) mc(R.q, {}, at + ' round ' + (i + 1)); });
          if (L.type === 'stages') L.stages.forEach((S, i) => visit(S, at + ' part ' + (i + 1)));
        };
        WORLDS.forEach(W => W.levels.forEach(L => { if (ids.has(L.id)) out.push('level id ' + L.id + ' is used twice'); ids.add(L.id);
          if (!L.title || !L.brief || !L.lesson) out.push(L.id + ': title, brief or lesson is missing'); visit(L, L.id); }));
        return out;
      });
      check('answers, gaps and reasons are consistent in all levels', bad.length === 0, bad);
      await page.context().close();
    }

    /* ---------- every level and toy on a narrow phone ---------- */
    for (const lang of ['en', 'ru']) {
      console.log('\nEvery level on a 320 px phone, ' + lang.toUpperCase());
      const page = await open({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true }, lang);
      await page.evaluate(() => { __quest.go({ v: 'level', w: 'ind', l: 'ind1' }); document.querySelector('details.lab').open = true; });
      await page.evaluate(() => document.fonts.ready); // the fonts of a level and of the lab are in before anything is measured
      const r = await page.evaluate(async () => {
        const out = { levels: 0, toys: 0, wide: [], cut: [] };
        const look = at => {
          const vw = document.documentElement.clientWidth, sw = document.documentElement.scrollWidth;
          if (sw > vw + 1) out.wide.push(at + ' (' + sw + ' px)');
          for (const svg of document.querySelectorAll('#app svg')) { const b = svg.getBoundingClientRect(); if (!b.width) continue;
            for (const t of svg.querySelectorAll('text')) { const tb = t.getBoundingClientRect();
              if (tb.width && (tb.left < b.left - 2 || tb.right > b.right + 2)) { out.cut.push(at + ': “' + t.textContent.slice(0, 30) + '”'); break; } } }
        };
        const press = sel => { let n = 0; for (const b of document.querySelectorAll(sel)) { if (n++ > 12) break; if (b.isConnected && !b.disabled) b.click(); } };
        for (const W of WORLDS) for (const L of W.levels) {
          __quest.go({ v: 'level', w: W.id, l: L.id }); out.levels++; look(L.id);
          const hint = document.querySelector('.hintb'); if (hint) { hint.click(); look(L.id + ', hint'); }
          const lab = document.querySelector('details.lab');
          if (lab) { lab.open = true;
            for (const tab of lab.querySelectorAll('.labin > .row > button[data-toy]')) { tab.click(); out.toys++; look(L.id + ', toy ' + tab.dataset.toy);
              press('details.lab .toy button'); look(L.id + ', toy ' + tab.dataset.toy + ' after pressing its buttons'); } }
          if (L.type === 'explore') for (let k = 0; k < 12 && !document.querySelector('#app .result'); k++) { press('#app .card:not(.result) button'); look(L.id + ', card ' + (k + 1)); }
          await new Promise(r => setTimeout(r)); // let timers and animations of the level run
        }
        return out;
      });
      check('all ' + r.levels + ' levels and ' + r.toys + ' lab toys open without a script error', page.errors.length === 0 && r.levels > 50, page.errors.slice(0, 5));
      check('no page is wider than the screen', r.wide.length === 0, r.wide.slice(0, 8));
      check('no text in a picture is cut off at the sides', r.cut.length === 0, r.cut.slice(0, 8));
      if (lang === 'ru') {
        const miss = await page.evaluate(() => {
          const out = [], seen = new Set(), SKIP = new Set(['id', 'type', 'c', 'ru', 'data', 'keys', 'lab', 'toys', 'toy', 'pic', 'fig', 'mode', 'book', 'dag', 'suitors', 'opt']);
          const walk = (v, at, cloze) => {
            if (typeof v === 'string') { if (cloze || seen.has(v) || !/[A-Za-z]{4}/.test(v)) return; seen.add(v); MISS.delete(v); tr(v); if (MISS.has(v)) out.push(at + ': ' + v.slice(0, 120)); return; }
            if (!v || typeof v !== 'object' || v.nodeType) return;
            if (Array.isArray(v)) return v.forEach((x, i) => walk(x, at, cloze));
            const cz = cloze || v.type === 'cloze'; // the exam skeletons of write mode stay in English on purpose
            for (const k of Object.keys(v)) if (!SKIP.has(k)) walk(v[k], at + '.' + k, cz && !['title', 'brief', 'lesson', 'hint', 'tag'].includes(k));
          };
          WORLDS.forEach(W => { walk(W.name, W.id, false); walk(W.ch, W.id, false); W.levels.forEach(L => walk(L, L.id, false)); });
          return out;
        });
        const real = miss.filter(m => !SAME_IN_RUSSIAN.some(re => re.test(m.slice(m.indexOf(': ') + 2))));
        check('every text of the level data has a Russian translation', real.length === 0, real.slice(0, 12));
      }
      await page.context().close();
    }

    /* ---------- every level built from standard parts can be won with the keyed answers ---------- */
    console.log('\nPlaying the levels');
    {
      const page = await open();
      const r = await page.evaluate(async () => {
        const CAN = new Set(['mc', 'input', 'order', 'cloze', 'explore', 'topo', 'debruijn', 'matchpick']);
        const sleep = ms => new Promise(f => setTimeout(f, ms)), click = el => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        const out = { played: 0, skipped: 0, bad: [] };
        for (const W of WORLDS) for (const L of W.levels) {
          const parts = L.type === 'stages' ? L.stages : [L];
          if (!parts.every(P => CAN.has(P.type))) { out.skipped++; continue; }
          prog = {}; __quest.go({ v: 'level', w: W.id, l: L.id }); out.played++;
          const card = () => document.querySelector('#app .card:not(.result)');
          const part = () => { if (L.type !== 'stages') return L; const m = /part (\d+) of/.exec(card().querySelector('.stage-tag')?.textContent || ''); return m ? parts[m[1] - 1] : parts[0]; };
          const question = P => { const m = [...card().querySelectorAll('.stage-tag')].map(t => /Question (\d+) of/.exec(t.textContent)).find(Boolean); return P.qs[m[1] - 1]; };
          const primary = (re) => { const b = [...card().querySelectorAll('.btn.primary')].filter(x => !x.hidden && !x.disabled && (!re || re.test(x.textContent))).pop(); if (b) b.click(); return !!b; };
          let why = '';
          for (let step = 0; step < 400 && !document.querySelector('#app .result'); step++) {
            const c = card(), P = part();
            try {
              if (P.type === 'explore') primary();
              else if (P.type === 'mc') { const q = question(P), bs = [...c.querySelectorAll('.opts button')]; if (bs.every(x => x.disabled)) primary(); else bs.find(x => +x.dataset.k === q.a).click(); }
              else if (P.type === 'input') { const q = question(P), inp = c.querySelector('input[type=number]'); if (inp.disabled) primary(); else { inp.value = String(q.a); primary(/Check/); } }
              else if (P.type === 'order') { const placed = [...c.querySelectorAll('ol.proof > li')].filter(li => !li.classList.contains('pop') && !li.classList.contains('empty')).length, rs = c.querySelector('.reasons');
                (rs ? [...rs.querySelectorAll('button')].find(x => x.dataset.r === P.lines[placed].r) : c.querySelector(`.pool button[data-i="${placed}"]`)).click(); }
              else if (P.type === 'cloze') { if (c.querySelector('.modelproof')) primary(); else { for (const k of Object.keys(P.gaps)) document.getElementById(`cz-${L.id}-${k}`).value = P.gaps[k].o ? P.gaps[k].a : P.gaps[k].a[0]; primary(/skeleton/); } }
              else if (P.type === 'matchpick') { const D = DATA[P.data], res = P.suitors === 'women' ? ritualRun(D.pw, D.pm).wife : ritualRun(D.pm, D.pw).wife; res.forEach((j, i) => { document.getElementById('mp-' + i).value = String(j); }); primary(/Check/); }
              else if (P.type === 'debruijn') { if (c.querySelector('.why')) primary(); else { const have = c.querySelectorAll('.bit').length; [...c.querySelectorAll('.row .btn')].find(x => x.textContent === '0001011100'[have]).click(); } }
              else if (P.type === 'topo') { if (c.querySelector('.why')) primary(); else { const G = DAGS[P.dag], ids = Object.keys(G.v), nodes = [...c.querySelectorAll('.tk')], el = Object.fromEntries(ids.map((v, i) => [v, nodes[i]]));
                const done = v => el[v].classList.contains('done'), ready = ids.filter(v => !done(v) && dagPre(G, v).every(done));
                if (P.mode === 'par') { ready.forEach(v => { if (!el[v].classList.contains('sel')) click(el[v]); }); primary(/Start/); } else click(el[ready[0]]); } }
            } catch (e) { why = String(e.message || e); break; }
            await sleep(2);
          }
          for (let i = 0; i < 80 && !document.querySelector('#app .result'); i++) await sleep(25); // some parts finish after a short delay
          const res = document.querySelector('#app .result .big'), hearted = !['cloze', 'explore'].includes(L.type);
          if (!res || /Out of hearts/.test(res.textContent)) out.bad.push(L.id + ': not finished' + (why ? ' (' + why + ')' : ''));
          else if (hearted && prog[L.id] !== 3) out.bad.push(L.id + ': the keyed answers lost a heart');
        }
        return out;
      });
      check(r.played + ' levels can be won with the keyed answers (' + r.skipped + ' with their own mini-game are not played)', r.bad.length === 0 && r.played > 60 && page.errors.length === 0, [...r.bad, ...page.errors].slice(0, 10));
      await page.context().close();
    }

    /* ---------- Back button, reload, links ---------- */
    console.log('\nNavigation');
    {
      const page = await open();
      const at = () => page.evaluate(() => view.v + (view.w ? ':' + view.w : '') + (view.l ? '/' + view.l : '') + ' ' + location.hash);
      await page.click('.legend-list button >> nth=0'); await page.click('.trail .node >> nth=1');
      check('map → island → level writes the address', await at() === 'level:prf/prf1 #prf/prf1', await at());
      await page.goBack(); const a1 = await at(); await page.goBack(); const a2 = await at();
      check('browser Back: level → island → map', a1 === 'island:prf #prf' && a2 === 'map ', [a1, a2]);
      await page.goForward(); await page.goForward(); await page.reload(); await page.waitForFunction(() => typeof view === 'object');
      check('Forward, then a reload keeps the level', await at() === 'level:prf/prf1 #prf/prf1', await at());
      await page.click('#app > .row .btn'); await settled(page);
      check('the “←” button of a level goes to its island', await at() === 'island:prf #prf', await at());
      await page.context().close();
      const locked = await open({}, 'en', BASE + '#lgc/lgc3');
      check('a link to a locked level opens its island', await locked.evaluate(() => view.v + ':' + view.w) === 'island:lgc');
      check('no script errors while navigating', page.errors.length + locked.errors.length === 0, [...page.errors, ...locked.errors]);
      await locked.context().close();
    }

    /* ---------- a part of a multi-part level cannot be skipped ---------- */
    console.log('\nMulti-part levels');
    {
      const page = await open();
      await page.evaluate(() => __quest.go({ v: 'level', w: 'inf', l: 'inf4' }));
      for (let i = 0; i < 5; i++) await page.click('.hintb'); // the hint fills one diagonal place per click
      await page.evaluate(() => { const b = [...document.querySelectorAll('#app .card button')].find(x => /Check d/.test(x.textContent)); b.click(); b.click(); b.click(); });
      await page.waitForFunction(() => /part 2 of 2/.test(document.querySelector('#app .card .stage-tag')?.textContent || ''), null, { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(900);
      const s = await page.evaluate(() => ({ won: !!document.querySelector('.result'), tag: document.querySelector('#app .card .stage-tag')?.textContent, stars: prog.inf4 || 0 }));
      check('three quick clicks on “Check d” lead to part 2, not past it', !s.won && /part 2 of 2/.test(s.tag || '') && s.stars === 0, s);
      await page.context().close();
    }

    /* ---------- carrying progress ---------- */
    console.log('\nProgress link');
    {
      const one = await open();
      await one.evaluate(() => { prog = { prf0: 3, prf1: 2, prf_s1: 1, skl10: 3 }; save(); });
      const link = await one.evaluate(() => progLink());
      check('the code is short and uses only link-safe characters', /#p=PA1\.[A-Za-z0-9_.\-]+$/.test(link) && link.length < BASE.length + 60, link);
      const full = await one.evaluate(() => { const keep = prog; prog = {}; WORLDS.forEach(W => W.levels.forEach(L => { prog[L.id] = 3; })); const n = Object.keys(progParse(progCode())).length, len = progCode().length; prog = keep; return [n, WORLDS.reduce((a, W) => a + W.levels.length, 0), len]; });
      check('a code with every level cleared reads back completely', full[0] === full[1] && full[2] < 400, full);
      const two = await open({}, 'en', link);
      const before = await two.evaluate(() => [!!document.querySelector('.offer'), location.hash, localStorage.getItem('proof-archipelago-v1')]);
      check('opening the link only offers the progress', before[0] && before[1] === '' && before[2] === null, before);
      await two.click('.offer .btn.primary');
      check('accepting adds it', await two.evaluate(() => JSON.stringify(prog)) === JSON.stringify({ prf0: 3, prf1: 2, prf_s1: 1, skl10: 3 }));
      const merged = await two.evaluate(() => { prog = { prf1: 3, wop1: 1 }; const n = progMerge(progParse('PA1.prf-0C1A.zzz-0C.wop-99B')); return [n, prog]; });
      check('adding keeps the better result and ignores unknown levels', merged[0] === 1 && JSON.stringify(merged[1]) === JSON.stringify({ prf1: 3, wop1: 1, prf0: 3 }), merged);
      check('no script errors', one.errors.length + two.errors.length === 0, [...one.errors, ...two.errors]);
      await one.context().close(); await two.context().close();
    }

    /* ---------- service worker: offline and updates ---------- */
    console.log('\nOffline and updates');
    {
      const page = await open();
      await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 20000 });
      const names = await page.evaluate(async () => { const keys = await caches.keys(), c = await caches.open(keys[0]); return [keys.length, (await c.keys()).filter(r => r.url.startsWith(location.origin)).length]; });
      check('first visit: one cache with the page, the manifest and the icons', names[0] === 1 && names[1] >= 8, names);
      await page.reload(); await page.waitForTimeout(1500);
      check('same page on the server: no update bar', await page.evaluate(() => !document.querySelector('#upd')));
      overrides.set('/index.html', fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace('</body>', '<!-- newer --></body>'));
      await page.reload();
      const bar = await page.waitForSelector('#upd', { timeout: 15000 }).then(() => true, () => false);
      check('newer page on the server: the update bar appears', bar);
      if (bar) { await page.click('#upd .btn >> nth=0'); await page.waitForLoadState('load'); }
      check('its Reload button shows the newer page', await page.evaluate(() => document.documentElement.outerHTML.includes('<!-- newer -->')));
      await page.context().setOffline(true);
      await page.reload(); await page.waitForFunction(() => typeof view === 'object');
      check('offline: the game opens from the cache', await page.evaluate(() => !!document.querySelector('.sea')));
      check('no script errors', page.errors.length === 0, page.errors);
      overrides.clear();
      await page.context().close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failed ? '\n' + failed + ' check(s) FAILED' : '\nAll checks passed');
  process.exit(failed ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
