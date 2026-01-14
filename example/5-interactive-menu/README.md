# Interactive Menu Bot

## Overview

Advanced Gramstax example showcasing inline keyboards, pagination, and reply keyboards with stateful navigation.

## Requirements

- Bun runtime
- Telegram bot token

## Setup

1. Install dependencies from repo root: `bun install`
2. Update `src/env.ts` with your `TELEGRAM_BOT_TOKEN`

## Environment Variables

- `TELEGRAM_BOT_TOKEN`: Telegram bot token used by Gramstax
- `TELEGRAM_BOT_DEPLOY`: Deployment mode (`polling`, `webhook:<url>`, `serverless:<adapter>`)

## Run Scripts

- `bun start`: Run the bot
- `bun dev`: Run with watch mode

## Commands and Usage

- `/start`: Opens the interactive menu
- Inline buttons: Navigate categories, lists, and item details
- Bottom keyboard: Quick actions for Menu, Browse, Help, Reset

## File Structure

- `src/index.ts`: Application entry point
- `src/env.ts`: Environment configuration
- `src/core/`: Bot and context setup
- `src/components/` and `src/data/`: Keyboard helpers and catalog data
- `src/pages/`: Menu, pagination, and detail pages
