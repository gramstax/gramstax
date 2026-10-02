# Bank System Bot

## Overview

Gramstax example bot that manages balances, deposits, withdrawals, and transfers using precise bigint math.

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

- `/start`: Open the inline menu
- Inline menu buttons: Balance, Deposit, Withdraw, Transfer, History
- After selecting an action, send the required input (amount or amount + user)

## File Structure

- `gramstax.config.ts`: composition (token, deploy, caches) — `gramstax start` boots from this, no entry file
- `src/env.ts`: Environment configuration
- `src/core/`: Bot, context, and store setup
- `src/pages/`: Menu and transaction pages
