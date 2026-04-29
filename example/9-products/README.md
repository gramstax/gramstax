# 9-products

## Overview

Gramstax example bot that integrates with [DummyJSON API](https://dummyjson.com) to showcase a product catalog with browsing, search, categories, and cart functionality.

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

- `/start`: Open main menu
- **Products**: Browse all products with pagination
- **Categories**: Browse products by category
- **Search**: Search products by keyword
- **Cart**: View cart (add products from product detail)

## Features

- 📦 Product listing with pagination
- 🔍 Product search
- 📂 Category browsing
- 🛒 Shopping cart (in-memory)
- 🌐 Multi-language support (EN/ID)

## API Integration

Uses [DummyJSON](https://dummyjson.com) free REST API:
- `GET /products` - List products
- `GET /products/{id}` - Product detail
- `GET /products/search?q={query}` - Search products
- `GET /products/categories` - List categories
- `GET /products/category/{slug}` - Products by category

## File Structure

- `src/index.ts`: Application entry point
- `src/env.ts`: Environment configuration
- `src/core/`: Bot and context setup
- `src/core/services/api.ts`: DummyJSON API client
- `src/pages/`: Bot pages and handlers
- `src/guards/`: Route guards
- `src/base/`: Base classes
- `src/blocks/`: Keyboard blocks