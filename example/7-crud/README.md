# CRUD Cache Bot

## Overview

Gramstax example that implements CRUD (create, read, update, delete) using an in-memory cache store.

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

- `/start`: Open CRUD menu
- Create: Add a new item (title + description)
- List: View all items in cache
- Detail: View a single item by ID
- Update: Modify an item by ID
- Delete: Remove an item by ID

## File Structure

- `src/index.ts`: Application entry point
- `src/env.ts`: Environment configuration
- `src/core/`: Bot and context setup
- `src/store/`: In-memory CRUD store
- `src/pages/`: CRUD handlers and templates
