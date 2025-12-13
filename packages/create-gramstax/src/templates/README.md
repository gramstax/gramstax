# {{projectName}}

A Telegram bot built with Gramstax framework.

## Getting Started

### Development

1. Install dependencies:

```bash
{{installCmd}}
```

2. Set up your environment variables:

Copy `.env.example` to `.env` and add your Telegram bot token:

```bash
BOT_TOKEN=your_bot_token_here
```

3. Run the development server:

```bash
{{runDevCmd}}
```

### Production

#### Using PM2 (Recommended)

PM2 is a production process manager for Node.js applications with built-in load balancer.

1. Install dependencies:

```bash
{{installCmd}}
```

2. Set up production environment:

```bash
cp .env.example .env
# Edit .env with your production BOT_TOKEN
```

3. Start with PM2:

```bash
{{runPm2StartCmd}}
```

4. PM2 Management Commands:

```bash
# View logs
{{runPm2LogsCmd}}

# Monitor processes
{{runPm2MonitCmd}}

# Restart bot
{{runPm2RestartCmd}}

# Stop bot
{{runPm2StopCmd}}

# Delete from PM2
{{runPm2DeleteCmd}}
```

5. Setup PM2 to start on system boot:

```bash
pm2 startup
pm2 save
```

#### Using Bun directly

```bash
{{runStartCmd}}
```

## Project Structure

- `src/base/` - Base classes for your bot components
- `src/core/` - Core bot configuration and hooks
- `src/pages/` - Bot pages/screens
- `src/guards/` - Route guards and middleware
- `src/services/` - Business logic services
- `src/repositories/` - Data access layer
- `src/templates/` - Message templates
- `src/utils/` - Utility functions
- `logs/` - Application logs (created automatically)

## Configuration

### Environment Variables

- `BOT_TOKEN` - Your Telegram bot token (required)
- `CACHE_SESSION` - Cache type configuration (optional)

### PM2 Configuration

The `ecosystem.config.js` file contains PM2 configuration:

- **instances**: Number of instances (default: 1)
- **exec_mode**: Execution mode (cluster/fork)
- **max_memory_restart**: Auto-restart if memory exceeds limit
- **autorestart**: Auto-restart on crash
- **error_file/out_file**: Log file locations

## Learn More

- [Gramstax Documentation](https://github.com/gramstax/gramstax)
- [Grammy Documentation](https://grammy.dev/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [PM2 Documentation](https://pm2.keymetrics.io/)
