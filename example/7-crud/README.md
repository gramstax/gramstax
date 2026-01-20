# CRUD Bot with LMDB

## Overview

Gramstax example bot demonstrating CRUD operations backed by LMDB database. Create, read, update, and delete todo items with persistent storage.

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

- `/start` or `/menu`: Open main menu
- Inline keyboard buttons: List, Create, Update, Delete, Help
- Use "Cancel" button to abort any operation

### Input Flows

**Create Todo:**
Multi-step input with inline Cancel buttons on each step:
- Step 1: Enter title (required)
- Step 2: Enter description (optional)

**Update Todo:**
Multi-step input with inline Cancel buttons on each step:
- Step 1: Enter todo ID (validates ID exists)
- Step 2: Enter new title (required)
- Step 3: Enter new description (optional)

**Delete Todo:**
No manual input. Inline keyboard shows all todos:
- Click "Delete" to view inline keyboard with todo IDs
- Click any todo button to delete it immediately

## Database Persistence

- LMDB database files are stored in `db/` directory
- Created automatically on first run
- All data persists across bot restarts
- Delete the `db/` folder to reset all data

## File Structure

- `src/index.ts`: Application entry point
- `src/env.ts`: Environment configuration
- `src/core/bot.ts`: Gramstax bot extension
- `src/core/ctx.ts`: Context with CrudStore
- `src/core/store.ts`: LMDB-backed CRUD store with indexing
- `src/pages/`: CRUD operation pages
- `src/base/`: Base page and guard classes
- `src/blocks/`: Keyboard definitions
- `src/utils/`: Logging utilities
- `src/guards/`: Guard examples

## Features

- ✅ Create todos with multi-step input (title → description)
- ✅ List all todos with improved `<map>` formatting
- ✅ Update existing todos with multi-step input (ID → title → description)
- ✅ Delete todos via inline keyboard selection (no manual ID input)
- ✅ Persistent LMDB storage with indexing
- ✅ Error handling and validation per step
- ✅ Inline Cancel buttons on all input steps
- ✅ Session-based multi-step input flow
