# Proof Archipelago — игра на телефон

Квест по ITB8832, главы 1–8: 11 островов, 70 уровней. На каждом острове глав — Маяк (наглядная теория с песочницами), в каждом задании — Лаборатория; два острова режима письма (Skeleton Dock — мидтерм 1, Skeleton Shipyard — мидтерм 2). Работает без интернета, ставится на экран телефона как приложение. Прогресс хранится на самом телефоне.

## Что в папке
- `index.html` — сама игра
- `manifest.webmanifest` — имя, иконка, режим «как приложение»
- `sw.js` — офлайн-кэш (после первого открытия игра работает без сети)
- `` — иконки

## Как выложить (один раз, ~5 минут) — GitHub Pages
1. github.com → **New repository** → имя, например `proof-archipelago` → **Public** → Create.
2. На странице репозитория: **Add file → Upload files** → перетащи ВСЁ содержимое этой папки (все файлы) → **Commit changes**.
3. **Settings → Pages** → Source: *Deploy from a branch* → Branch: `main`, папка `/ (root)` → Save.
4. Через 1–2 минуты появится адрес вида `https://<твой-логин>.github.io/proof-archipelago/`.

## Как поставить на телефон
- **iPhone (Safari):** открой адрес → кнопка «Поделиться» → **На экран «Домой»**.
- **Android (Chrome):** открой адрес → меню ⋮ → **Установить приложение** (или «Добавить на главный экран»).

Иконка с островом появится на экране. Запускается на весь экран, без браузера.

## Если что-то обновишь
Поменяй файл и в `sw.js` увеличь `VERSION` (например `pa-v5`), иначе телефон будет показывать старую копию из кэша.

## Проверить на Mac без выкладки
В этой папке: `python3 -m http.server 8000` → открой `http://localhost:8000`. (С телефона по Wi-Fi тоже откроется, но офлайн-режим работает только по https — поэтому для телефона нужен GitHub Pages.)

---
**EN, short:** upload the folder contents to any static HTTPS host (GitHub Pages: Settings → Pages → deploy from `main` / root), open the URL on the phone and choose *Add to Home Screen* / *Install app*. Works offline after the first visit. Bump `VERSION` in `sw.js` after any change.
