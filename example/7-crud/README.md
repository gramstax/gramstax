# 7-crud

## Overview

Gramstax example that implements CRUD (create, read, update, delete) using an in-memory cache store.

## Requirements

- Bun runtime
- Telegram bot token

## Setup

1. Install dependencies from repo root: `bun install`
2. Update `src/env.ts` with your `BOT_TOKEN`

## Environment Variables

- `STORE_PATH`: LMDB store path (e.g. `./example/7-crud/data/store.lmdb`)
- `BOT_TOKEN`: Telegram bot token used by Gramstax
- `BOT_DEPLOY`: Deployment mode (`polling`, `webhook`, `serverless`) — webhook/serverless details live in `optionsDeploy` in code

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

- `gramstax.config.ts`: composition (token, deploy, caches) — `gramstax start` boots from this, no entry file
- `src/env.ts`: Environment configuration
- `src/core/`: Bot and context setup
- `src/store/`: In-memory CRUD store
- `src/pages/`: CRUD handlers and templates
