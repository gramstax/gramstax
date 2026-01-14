# Bank System Bot

## Overview

Gramstax example bot that manages balances, deposits, withdrawals, and transfers using precise bigint math.

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

- `/start`: Open the inline menu
- `/balance`: Show current balance
- `/deposit <amount>`: Add funds (6 decimals max)
- `/withdraw <amount>`: Deduct funds
- `/transfer <amount> <user>`: Transfer to user id or @username
- `/history`: Show recent transactions

## File Structure

- `src/index.ts`: Application entry point
- `src/env.ts`: Environment configuration
- `src/core/`: Bot, context, and store setup
- `src/pages/`: Menu and transaction pages
