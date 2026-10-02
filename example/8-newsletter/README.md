# 8-newsletter

## Overview

Gramstax example that implements a newsletter bot with inline keyboards only.

## Requirements

- Bun runtime
- Telegram bot token

## Setup

1. Install dependencies from repo root: `bun install`
2. Update `src/env.ts` with your `BOT_TOKEN` and `ADMIN_IDS`

## Environment Variables

- `DB_PATH`: LMDB store path (e.g. `./example/8-newsletter/data`)
- `BOT_TOKEN`: Telegram bot token used by Gramstax
- `BOT_DEPLOY`: Deployment mode (`polling`, `webhook`, `serverless`) — webhook/serverless details live in `optionsDeploy` in code
- `ADMIN_IDS`: Array of admin user IDs

## Run Scripts

- `bun start`: Run the bot
- `bun dev`: Run with watch mode

## Usage

- Open the bot chat and send any text to see the menu
- Subscribe/unsubscribe via inline buttons
- Admins can broadcast messages to all subscribers

## File Structure

- `gramstax.config.ts`: composition (token, deploy, caches) — `gramstax start` boots from this, no entry file
- `src/env.ts`: Environment configuration
- `src/core/`: Bot and context setup
- `src/db/`: LMDB store
- `src/pages/`: Newsletter pages and templates
