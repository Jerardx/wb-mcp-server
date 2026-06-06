# Установка в Continue.dev

У Continue свой формат: предпочтительно YAML, серверы заданы списком, у каждого поле `name`.

## Путь к файлу

- Глобально (YAML, рекомендуется): `~/.continue/config.yaml`
- Глобально (JSON, устаревший): `~/.continue/config.json`
- В проекте: `.continue/mcpServers/mcp.json`

## Конфигурация (YAML)

```yaml
mcpServers:
  - name: wb
    command: docker
    args:
      - run
      - -i
      - --rm
      - --init
      - eduard256/wb-mcp-server:latest
```

## Конфигурация (JSON, устаревший формат)

```json
{
  "mcpServers": [
    {
      "name": "wb",
      "command": "docker",
      "args": ["run", "-i", "--rm", "--init", "eduard256/wb-mcp-server:latest"]
    }
  ]
}
```

Серверы здесь — массив, а не объект с ключами. Поле `name` обязательно.
