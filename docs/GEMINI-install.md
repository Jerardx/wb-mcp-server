# Установка в Gemini CLI

## Путь к файлу

- Глобально: `~/.gemini/settings.json`
- В проекте: `.gemini/settings.json`

## Конфигурация

```json
{
  "mcpServers": {
    "wb": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "--init", "eduard256/wb-mcp-server:latest"],
      "timeout": 30000,
      "trust": false
    }
  }
}
```

`trust: false` — Gemini спросит подтверждение перед вызовом инструмента. Поставьте `true`, чтобы вызывать без подтверждения. `timeout` — в миллисекундах.

## Через CLI

```bash
gemini mcp add wb -- docker run -i --rm --init eduard256/wb-mcp-server:latest
```
