# Wildberries MCP Server

MCP-сервер для Wildberries (wildberries.ru). Даёт ИИ три инструмента: искать товары, читать карточку и читать отзывы. Браузер не нужен — сервер ходит в публичный JSON API Wildberries обычным HTTP и парсит готовый JSON.

> Форк [eduard256/wb-mcp-server](https://github.com/eduard256/wb-mcp-server) с починенными отзывами.
> WB перенёс API отзывов: старые хосты `feedbacks1/2.wb.ru` + путь `/feedbacks/v1/` мертвы (TCP-соединение
> отбрасывается). Этот форк использует актуальную схему: резолвер шарда
> `feedback-bt.wildberries.ru/feedback/api/v2/host` → `feedback-view-NN.wb.ru/feedbacks/v2/{imtId}`
> (с CRC16/ARC-fallback по imtId, как в самом фронте WB). Прокси для WB не требуется.

## Инструменты

1. **wb_search** — поиск товаров. Название, цена (в рублях, числом), старая цена, рейтинг, число отзывов, бренд, продавец, картинка, ссылка.
2. **wb_product_details** — карточка по артикулу (nm) или ссылке. Цена, наличие, рейтинг, продавец, цвета, фото, характеристики, описание.
3. **wb_product_reviews** — отзывы покупателей: автор, оценка, текст, плюсы, минусы, дата, цвет/размер.

## Установка в Claude Code

Сервер запускается из исходников через `node` (в опубликованном Docker-образе upstream правок отзывов нет).

### 1. Склонировать и установить зависимости

```bash
git clone https://github.com/Jerardx/wb-mcp-server.git
cd wb-mcp-server
npm install
```

Нужен `curl` в системе (Node-fetch WB отбивает по TLS-фингерпринту, curl проходит) — на Windows/macOS/Linux он есть из коробки.

### 2. Добавить в Claude Code

Через CLI (подставьте абсолютный путь до `src/index.js`):

```bash
claude mcp add wb --scope user -- node /absolute/path/to/wb-mcp-server/src/index.js
```

Или вручную в `.mcp.json` в корне проекта:

```json
{
  "mcpServers": {
    "wb": {
      "command": "node",
      "args": ["/absolute/path/to/wb-mcp-server/src/index.js"]
    }
  }
}
```

> Windows: путь в `args` пишите с двойными слэшами, например
> `"D:\\Projects\\wb-mcp-server\\src\\index.js"`.

### 3. Проверить

```bash
claude mcp list
```

Должны появиться три инструмента: `wb_search`, `wb_product_details`, `wb_product_reviews`.

## Как это работает

- `src/wb.js` — HTTP-клиент к публичному API WB через системный `curl`. Троттлинг между запросами + ретрай с джиттером на 429/403. Отзывы: резолв шард-хоста → `/feedbacks/v2/{imtId}`.
- `src/parse.js` — чистые парсеры JSON (search / detail / card.json / feedbacks). Без сети.
- `src/index.js` — MCP-сервер по stdio. Логи только в stderr (stdout занят протоколом JSON-RPC).

**Важно:** WB режет частые запросы (429/403) — сервер сам делает паузу и повторяет. Артикул (nm) для отзывов не годится: отзывы лежат по `root` (imtId) из ответа деталей.

## Локальная разработка

```bash
npm install
node src/index.js          # MCP-сервер по stdio
```
