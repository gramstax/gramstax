# Complex Example Bot

## Overview

Demonstrates a full-featured Gramstax bot with multiple pages, guards, templates, and worker threads.

## Requirements

- Bun runtime
- Telegram bot token

## Setup

1. Install dependencies from repo root: `bun install`
2. Update `src/env.ts` with your `BOT_TOKEN` and deploy mode

## Environment Variables

- `BOT_TOKEN`: Telegram bot token used by Gramstax
- `BOT_DEPLOY`: Deployment mode (`polling`, `webhook`, `serverless`) — webhook/serverless details live in `optionsDeploy` in code

## Run Scripts

- `bun start`: Run the bot
- `bun dev`: Run with watch mode

## Commands and Usage

- `/start`: Open the main menu and navigation examples
- Use the inline menus to explore templates, media replies, and keyboard patterns

## File Structure

- `gramstax.config.ts`: composition (token, deploy, caches) — `gramstax start` boots from this, no entry file
- `src/env.ts`: Environment configuration
- `src/core/`: Bot and context setup
- `src/pages/`: Page handlers and templates
