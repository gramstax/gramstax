# Gramstax

- **Type:** Class
- **Description:** The main application class.

## Constructor

### `new Gramstax(params)`

- **Description:** Initializes the Gramstax bot framework.
- **Params:**
  - `params.token`: `[string]` - Telegram bot token.
  - `params.deploy`: `[string]` - Deployment mode ('polling', 'webhook', etc.).
  - `params.log`: `[LoggingPretty | boolean]` - Logger configuration or boolean.
  - `params.cacheData`: `[CacheExternal]` - Data cache adapter.
  - `params.cacheSession`: `[CacheExternal]` - Session cache adapter.
  - `params.templateManager`: `[TemplateManager]` - Template manager instance.
- **Returns:** `Gramstax` instance.
- **Example:** `const app = new Gramstax({ token: "...", deploy: "polling" });`

## Properties

### `bot`

- **Type:** `Bot`
- **Description:** The internal Grammy Bot instance.
- **Example:** `app.bot.start();`

### `pages`

- **Type:** `Object`
- **Description:** Registry of loaded Page classes and routing maps.
- **Example:** `const allPages = app.pages.list;`

## Methods

### `createBot(token)`

- **Description:** Factory method to create the Grammy bot.
- **Params:**
  - `token`: `[string]` - Bot token.
- **Returns:** `Bot`
- **Example:** `const bot = this.createBot(token);`

### `runPolling()`

- **Description:** Starts the bot in polling mode.
- **Params:** None.
- **Returns:** `void`
- **Example:** `app.runPolling();`

### `runWebhook(fullUrl)`

- **Description:** Starts the bot in webhook mode with an internal server.
- **Params:**
  - `fullUrl`: `[string]` - The public URL for the webhook.
- **Returns:** `Promise<void>`
- **Example:** `await app.runWebhook("https://mysite.com/hook");`

### `hookBeforeRoute(ctx, listenerName)`

- **Description:** Intercepts requests before routing.
- **Params:**
  - `ctx`: `[Ctx]` - The request context.
  - `listenerName`: `[string]` - The name of the event listener triggered.
- **Returns:** `Promise<boolean>` - Return false to stop processing.
- **Example:** `if (ctx.userId === 0) return false;`

### `onStart(botInfo, method, data)`

- **Description:** Lifecycle handler called after successful connection.
- **Params:**
  - `botInfo`: `[UserFromGetMe]` - Information about the bot user.
  - `method`: `[string]` - Deployment method used.
  - `data`: `[any]` - Additional startup data.
- **Returns:** `Promise<void>`
- **Example:** `// Internal use`
