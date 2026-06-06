# Установка в Junie

Junie — отдельный агентный CLI от JetBrains, у него есть файловый конфиг (в отличие от AI Assistant).

## Путь к файлу

- Глобально: `~/.junie/mcp/mcp.json`
- В проекте: `.junie/mcp/mcp.json`

## Конфигурация

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
