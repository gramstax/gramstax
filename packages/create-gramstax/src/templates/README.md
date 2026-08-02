# {{projectName}}

A Telegram bot built with Gramstax framework.

## Getting Started

1. Install dependencies:

```bash
{{installCmd}}
```

2. Set up your environment variables:

Edit `.env` and add your Telegram bot token:

```bash
TELEGRAM_BOT_TOKEN="<...your_bot_token_here...>"
```

3. Run the development server:

```bash
{{runDevCmd}}
```

4. Run the bot in production:

```bash
{{runStartCmd}}
```

## Project Structure

- `src/base/` - Base classes for your bot components
- `src/blocks/` - Block data builder classes
- `src/core/` - Core bot configuration and hooks
- `src/guards/` - Route guards and middleware
- `src/helpers/` - Helper function
- `src/pages/` - Bot pages/screens
- `src/utils/` - Utility functions (e.g., array helpers)
- `logs/` - Application logs (created automatically)

## Configuration

### Environment Variables

- `TELEGRAM_BOT_TOKEN` - Your Telegram bot token (required)
- `TELEGRAM_BOT_DEPLOY` - Your Telegram bot deploy (required)
- `TELEGRAM_CACHE_SESSION` - Cache type configuration (optional)

## Learn More

- [Gramstax Documentation](https://github.com/gramstax/gramstax)
