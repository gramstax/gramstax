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

export {InputMediaBuilder} from "grammy"

import {DEFAULT_FILTERS, TemplateEngine} from "./template/engine"

/**
 * Runtime escape helper for AOT-generated template code.
 *
 * @remarks
 * Same function the JIT path closes over (`__esc` in generated bodies).
 *
 * @public
 */
export const __esc = TemplateEngine._escapeData

/**
 * Runtime filter table for AOT-generated template code.
 *
 * @remarks
 * Same table the JIT path closes over (`FILTERS` in generated bodies).
 * Generated code only reads it — never mutate at runtime.
 *
 * @public
 */
export const FILTERS: Record<string, (value: unknown, ...args: string[]) => unknown> = DEFAULT_FILTERS

export * from "./blocks/g-keyboard"
export * from "./cache/external"
export * from "./core/bot"
export * from "./core/ctx"
export * from "./core/session-lock"
export * from "./e2e/helper"
export * from "./helpers/log"
export * from "./helpers/metrics"
export * from "./labels/g-keyboard"
export * from "./mock/telegram-server"
export * from "./page/manager"
export * from "./page/manifest"
export * from "./template/engine"
export * from "./template/manager"
// type
export type {GramstaxConfig} from "./cli/config"
export * from "./types/t.bot"
export * from "./types/t.ctx"
export * from "./types/t.e2e"
export * from "./types/t.template"
export * from "./webhook/queue"
