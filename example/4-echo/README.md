# Echo Bot

## Overview

Beginner-friendly Gramstax bot that welcomes users, provides help, and echoes text messages.

## Requirements

- Bun runtime
- Telegram bot token

## Setup

1. Install dependencies from repo root: `bun install`
2. Update `src/env.ts` with your `TELEGRAM_BOT_TOKEN`

## Environment Variables

- `TELEGRAM_BOT_TOKEN`: Telegram bot token used by Gramstax
- `TELEGRAM_BOT_DEPLOY`: Deployment mode (`polling`, `webhook`, `serverless`) — webhook/serverless details live in `optionsDeploy` in code

## Run Scripts

- `bun start`: Run the bot
- `bun dev`: Run with watch mode

## Commands and Usage

- `/start`: Welcome message and navigation
- `/help`: List available commands
- Send any text to receive the echoed reply

## File Structure

- `src/index.ts`: Application entry point
- `src/env.ts`: Environment configuration
- `src/core/`: Bot and context setup
- `src/pages/`: Page handlers for start/help/echo
