# 9-substore-bot

## Overview

Gramstax example bot for selling digital subscription products through Telegram inline keyboards.

## Features

- Paginated product catalog with 4 products per page
- Product detail pages with Buy Now and Add to Cart
- Cart actions for increase, decrease, remove, clear, continue shopping, and checkout
- Free-text checkout contact and order notes
- Order confirmation with generated order ID and payment instructions

## Requirements

- Bun runtime
- Telegram bot token

## Environment Variables

- `BOT_TOKEN`: Telegram bot token used by Gramstax
- `STORE_ADMIN_USERNAME`: Optional support/admin username shown in checkout help

## Run Scripts

- `bun start`: Run the bot
- `bun dev`: Run with watch mode
- `bun test`: Run example tests

## Usage

- Send `/start` to open the store home page
- Use inline buttons to browse products, paginate the catalog, add items to cart, and checkout
- During checkout, send contact information and optional notes in one message

## File Structure

- `gramstax.config.ts`: composition (token, deploy, caches) — `gramstax start` boots from this, no entry file
- `src/core/`: Bot and context setup
- `src/data/`: Sample products, cart helpers, and order helpers
- `src/pages/`: Store pages and templates
