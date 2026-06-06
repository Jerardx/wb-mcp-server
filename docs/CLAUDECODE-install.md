# Установка в Claude Code

Самый быстрый способ — команда `claude mcp add`. После `--` идёт команда запуска сервера как есть.

## Через CLI

Глобально (во всех проектах):

```bash
claude mcp add wb --scope user -- docker run -i --rm --init eduard256/wb-mcp-server:latest
```

Только в текущем проекте (запишется в `.mcp.json`, можно коммитить в git):

```bash
claude mcp add wb --scope project -- docker run -i --rm --init eduard256/wb-mcp-server:latest
```

## Вручную через .mcp.json

Файл `.mcp.json` в корне проекта:

```json
{
  "mcpServers": {
    "wb": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "--init", "eduard256/wb-mcp-server:latest"]
    }
  }
}
```

## Проверка

```bash
claude mcp list
```

Сервер с проектным scope требует одобрения при первом запуске `claude` в папке проекта. Подтвердите — появятся три инструмента: `wb_search`, `wb_product_details`, `wb_product_reviews`.

Удалить:

```bash
claude mcp remove wb
```
