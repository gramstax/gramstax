# Complex Example Bot

## Overview

Demonstrates a full-featured Gramstax bot with multiple pages, guards, templates, and worker threads.

## Requirements

- Bun runtime
- Telegram bot token

## Setup

1. Install dependencies from repo root: `bun install`
2. Update `src/env.ts` with your `TELEGRAM_BOT_TOKEN` and deploy mode

## Environment Variables

- `TELEGRAM_BOT_TOKEN`: Telegram bot token used by Gramstax
- `TELEGRAM_BOT_DEPLOY`: Deployment mode (`polling`, `webhook:<url>`, `serverless:<adapter>`)

## Run Scripts

- `bun start`: Run the bot
- `bun dev`: Run with watch mode

## Commands and Usage

- `/start`: Open the main menu and navigation examples
- Use the inline menus to explore templates, media replies, and keyboard patterns

## File Structure

- `src/index.ts`: Application entry point
- `src/env.ts`: Environment configuration
- `src/core/`: Bot and context setup
- `src/pages/`: Page handlers and templates
