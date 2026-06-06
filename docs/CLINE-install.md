# Установка в Cline

Cline — расширение для VS Code (`saoudrizwan.claude-dev`).

## Путь к файлу

- macOS: `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`
- Linux: `~/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`
- Windows: `%APPDATA%\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json`

Открыть через интерфейс: иконка MCP Servers в Cline → вкладка Configure → Configure MCP Servers.

## Конфигурация

```json
{
  "mcpServers": {
    "wb": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "--init", "eduard256/wb-mcp-server:latest"],
      "disabled": false,
      "alwaysAllow": []
    }
  }
}
```

`disabled` — выключить сервер не удаляя. `alwaysAllow` — список инструментов, которые вызываются без подтверждения. Чтобы не подтверждать каждый вызов:

```json
"alwaysAllow": ["wb_search", "wb_product_details", "wb_product_reviews"]
```
