# Interactive Menu Bot

## Overview

Advanced Gramstax example showcasing inline keyboards, pagination, and reply keyboards with stateful navigation.

## Requirements

- Bun runtime
- Telegram bot token

## Setup

1. Install dependencies from repo root: `bun install`
2. Update `src/env.ts` with your `BOT_TOKEN`

## Environment Variables

- `BOT_TOKEN`: Telegram bot token used by Gramstax
- `BOT_DEPLOY`: Deployment mode (`polling`, `webhook`, `serverless`) — webhook/serverless details live in `optionsDeploy` in code

## Run Scripts

- `bun start`: Run the bot
- `bun dev`: Run with watch mode

## Commands and Usage

- `/start`: Opens the interactive menu
- Inline buttons: Navigate categories, lists, and item details
- Bottom keyboard: Quick actions for Menu, Browse, Help, Reset
