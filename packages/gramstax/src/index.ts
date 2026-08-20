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

export * from "./blocks/keyboard"
export * from "./cache/external"
export * from "./core/bot"
export * from "./core/ctx"
export * from "./core/session-lock"
export * from "./e2e/helper"
export * from "./helpers/log"
export * from "./helpers/metrics"
export * from "./labels/keyboard"
export * from "./mock/telegram-server"
export * from "./page/manager"
export * from "./template/engine"
export * from "./template/manager"
export {InputMediaBuilder} from "grammy"
// type
export * from "./types/t.bot"
export * from "./types/t.ctx"
export * from "./types/t.e2e"
export * from "./types/t.template"
export * from "./webhook/queue"
