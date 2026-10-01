# HTTP Request Bot

## Overview

Gramstax bot that makes HTTP requests to any user-provided URL and displays the response status, headers, and body.

## Requirements

- Bun runtime
- Telegram bot token

## Setup

1. Install dependencies from repo root: `bun install`
2. Update `src/env.ts` with your `BOT_TOKEN`

## Environment Variables

- `BOT_TOKEN`: Telegram bot token used by Gramstax
- `BOT_DEPLOYment mode (`polling`, `webhook`, `serverless`) — webhook/serverless details live in `optionsDeploy` in code

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
