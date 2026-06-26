/**
 * @gramstax/gramstax — declarative Telegram bot framework.
 *
 * @remarks
 * Provides template-driven page routing, session management, inline
 * keyboard helpers, caching, and mock Telegram server for testing.
 * Built on top of the Telegram Bot API framework with page-based routing.
 *
 * @packageDocumentation
 * @public
 */

export * from "./helpers/log"
export * from "./cache/external"
export * from "./core/bot"
export * from "./core/ctx"
export * from "./template/engine"
export * from "./template/manager"
export * from "./page/manager"
export * from "./blocks/keyboard"
export * from "./labels/keyboard"
export * from "./mock/telegram-server"
export * from "./webhook/queue"

// type
export * from "./types/t.bot"
export * from "./types/t.ctx"
export * from "./types/t.template"
