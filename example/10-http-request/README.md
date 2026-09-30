# HTTP Request Bot

## Overview

Gramstax bot that makes HTTP requests to any user-provided URL and displays the response status, headers, and body.

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

- `/start`: Welcome message and main menu
- `/help`: List available commands
- Click "🌐 New Request" → send a URL → receive HTTP response details

## File Structure

- `src/index.ts`: Application entry point
- `src/env.ts`: Environment configuration
- `src/core/`: Bot and context setup
- `src/services/http.ts`: HTTP request service
- `src/pages/`: Page handlers for start/help/http-request
