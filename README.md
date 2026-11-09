# Proof Archipelago

A browser game for **ITB8832 Mathematics for Computer Science** (TalTech), built on the course book — Lehman, Leighton, Meyer, *Mathematics for Computer Science* (2018), chapters 1–10.

**Play:** https://annymi1.github.io/proof-archipelago/

- 14 islands in three rows: proofs, the Well Ordering Principle, logic, sets and counting (midterm 1); induction, state machines, stable matching, recursive data, infinity and halting (midterm 2); divisibility and the gcd, modular arithmetic and RSA, directed graphs and scheduling (chapters 9–10).
- Every chapter island opens with a **lighthouse**: short theory cards with references to the book, each with a toy you can poke.
- Every level has a **lab** with toys for that topic, and a free **💡 hint**. Boss levels have neither — they work like the real midterm.
- **Side quests from the book**: Bill’s courtyard, the unstacking game, fast exponentiation, the impossible Fifteen, Russell’s paradox, perfect numbers, the Chinese Remainder Theorem, de Bruijn words, tournament rankings, and bogus proofs to debug.
- Two **write-mode** islands: fill the gaps of exam proof skeletons.
- **EN / RU** switch in the top right corner.
- Works offline after the first visit; progress stays on your device.
- The browser **Back** button goes level → island → map, a reload keeps your place, and every island and level has its own link (for example `…/#prf/prf1`).
- **Progress on another device**: on the map press *Copy a link with my progress* and open that link on the phone or the laptop — the stars are added there, and for every level the better result is kept.

**Install on a phone:** open the link → iPhone (Safari): *Share → Add to Home Screen*; Android (Chrome): *⋮ → Install app*.

---

# Proof Archipelago — по-русски

Игра по курсу ITB8832 по книге MCS (2018), главы 1–10. 14 островов в три ряда (мидтерм 1, мидтерм 2 и главы 9–10: делимость и НОД, модульная арифметика и RSA, орграфы и расписания), на каждом острове главы — маяк с теорией и игрушками, в каждом уровне — лаборатория и бесплатная 💡 подсказка (кроме боссов: они как настоящий мидтерм), побочные квесты из книги, два острова режима письма. Переключатель EN / RU — справа вверху. Работает офлайн, прогресс хранится на твоём устройстве. Кнопка «Назад» в браузере ведёт уровень → остров → карта, а у каждого острова и уровня есть своя ссылка. Чтобы перенести прогресс на другое устройство, нажми на карте «Скопировать ссылку с моим прогрессом» и открой её там.

**Играть:** https://annymi1.github.io/proof-archipelago/ · на телефоне: «Поделиться → На экран „Домой“» (iPhone) или «⋮ → Установить приложение» (Android).

---
## For whoever maintains the game

- **Hosting a copy**: upload `index.html`, `manifest.webmanifest`, `sw.js`, `og.png` and the icons to any static HTTPS host (GitHub Pages: Settings → Pages → deploy from `main` / root). Put the address of your copy into `og:url` and `og:image` near the top of `index.html`, otherwise link previews point to the original.
- **Updating**: after changing `index.html` nothing else is needed — an open game notices the new page and offers a reload. After changing an icon, the manifest or `sw.js` itself, bump `VERSION` in `sw.js`.
- **Russian texts**: the islands of chapters 9–10 keep both languages side by side, `T('English','Русский')`, in the block “chapters 9–10” of `index.html`. The older islands use the dictionary near the end of the file, keyed by a hash of the English text: when an English sentence changes there, its Russian entry has to move with it. The test below fails if a translation is missing.
- **Tests**: `cd tests && npm ci && npx playwright install chromium && npm test` opens the game in a headless browser and checks the level data, every level and lab toy on a 320 px phone in both languages, the Russian texts, a play-through of the levels with the keyed answers, navigation, carrying progress and the offline / update behaviour. The same test runs on GitHub for every push to `main` and every pull request (`.github/workflows/test.yml`).
