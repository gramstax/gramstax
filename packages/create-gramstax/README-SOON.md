# create-gramstax

The easiest way to get started with Gramstax is by using `create-gramstax`. This CLI tool enables you to quickly start building a new Telegram bot application with everything set up for you.

## Usage

To create a new Gramstax bot, run one of the following commands:

### Using Bun (recommended)

```bash
bun create gramstax my-bot
```

### Using npm

```bash
npx create-gramstax my-bot
```

### Using pnpm

```bash
pnpm create gramstax my-bot
```

### Using yarn

```bash
yarn create gramstax my-bot
```

## Options

- `--use-bun` - Use Bun as the package manager
- `--use-npm` - Use npm as the package manager
- `--use-pnpm` - Use pnpm as the package manager
- `--use-yarn` - Use yarn as the package manager
- `-y, --yes` - Skip all prompts and use default values

## Example

```bash
# Create a new bot with default settings
bun create gramstax my-telegram-bot

# Navigate to the project
cd my-telegram-bot

# Install dependencies
bun install

# Set up your bot token in .env
echo "BOT_TOKEN=your_bot_token_here" > .env

# Start the development server
bun dev
```

## What's Included?

Your new Gramstax bot project includes:

- **TypeScript** - Full TypeScript support with strict type checking
- **Gramstax Framework** - Powerful bot framework
- **Project Structure** - Pre-configured folder structure with:
  - `src/base/` - Base classes for components
  - `src/core/` - Core bot configuration
  - `src/pages/` - Bot pages/screens
  - `src/guards/` - Route guards and middleware
  - `src/services/` - Business logic layer
  - `src/repositories/` - Data access layer
  - `src/templates/` - Message templates
  - `src/utils/` - Utility functions
- **Example Pages** - Start and Help pages to get you started
- **Error Handling** - Built-in error pages and handlers
- **Hot Reload** - Development server with automatic reload

## Learn More

- [Gramstax Documentation](https://github.com/gramstax/gramstax)
- [Grammy Documentation](https://grammy.dev/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
