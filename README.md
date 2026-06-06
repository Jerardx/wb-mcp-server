<p align="center">
  <img src="https://raw.githubusercontent.com/eduard256/wb-mcp-server/assets/img/wb-mcp-logo.webp" alt="WB MCP" width="420">
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/eduard256/wb-mcp-server/assets/img/wb-card.webp" alt="Wildberries MCP — search, details, reviews" width="480">
</p>

# Wildberries MCP Server

MCP-сервер для поиска товаров на Wildberries (wildberries.ru). Даёт ИИ три инструмента: искать товары, читать карточку и читать отзывы.

У Wildberries есть публичный JSON API, поэтому браузер не нужен — сервер ходит прямо в `search.wb.ru`, `card.wb.ru` и `feedbacks.wb.ru` обычным HTTP и парсит готовый JSON. Образ лёгкий, ответы быстрые.

## Инструменты

1. **wb_search** — поиск товаров. Возвращает название, цену (в рублях, числом), старую цену, рейтинг, число отзывов, бренд, продавца, картинку и ссылку.
2. **wb_product_details** — карточка товара по артикулу (nm) или ссылке. Цена, старая цена, наличие, рейтинг, продавец, цвета, фото, характеристики, описание.
3. **wb_product_reviews** — отзывы покупателей: автор, оценка, текст, плюсы, минусы, дата, цвет/размер.

## Запуск через Docker

Образ опубликован в Docker Hub.

```bash
docker run -i --rm --init eduard256/wb-mcp-server:latest
```

Флаги: `-i` — stdin для stdio, `--init` — корректное завершение процесса. Chromium не нужен — образ на `node:20-slim` весит ~80 МБ.

## Установка в ваш клиент

Инструкция под каждую систему — отдельным файлом:

- [Claude Code](docs/CLAUDECODE-install.md)
- [Claude Desktop](docs/CLAUDE-install.md)
- [OpenAI Codex CLI](docs/CODEX-install.md)
- [Cursor](docs/CURSOR-install.md)
- [Windsurf](docs/WINDSURF-install.md)
- [VS Code (Copilot)](docs/VSCODE-install.md)
- [Cline](docs/CLINE-install.md)
- [Continue.dev](docs/CONTINUE-install.md)
- [Zed](docs/ZED-install.md)
- [JetBrains AI Assistant](docs/JETBRAINS-install.md)
- [Junie](docs/JUNIE-install.md)
- [Gemini CLI](docs/GEMINI-install.md)

## Как это работает

- `src/wb.js` — HTTP-клиент к публичному API Wildberries. Запросы идут через системный `curl` (Node-fetch WB отбивает по TLS-фингерпринту, curl проходит). Троттлинг между запросами + ретрай с джиттером на 429/403.
- `src/parse.js` — чистые парсеры JSON (search / detail / card.json / feedbacks). Без сети.
- `src/index.js` — MCP-сервер по stdio. Логи идут только в stderr (stdout занят протоколом JSON-RPC).

**Важно:**

1. WB режет частые запросы (HTTP 429/403). Сервер сам выдерживает паузу и повторяет — но при шквале запросов ответы будут медленнее.
2. Эндпоинт деталей — `card.wb.ru/cards/v4/detail` (v2 больше не работает).
3. Описание и характеристики берутся из CDN `card.json` на шардах `basket-XX.wbbasket.ru`; номер шарда вычисляется по артикулу.
4. Артикул (nm) для отзывов не подходит — отзывы лежат по `root` (imtId), который берётся из ответа деталей.

## Локальная разработка

```bash
npm install
node src/index.js          # MCP-сервер по stdio
```
