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
export * from "./template/engine"
export * from "./template/manager"
export * from "./types/bot"
export * from "./types/cache"
export * from "./types/cli"

// type
export type {GramstaxConfig} from "./types/config"
export * from "./types/config"
export * from "./types/ctx"
export * from "./types/e2e"
export * from "./types/manifest"
export * from "./types/manifest"
export * from "./types/metrics"
export * from "./types/mock"
export * from "./types/session-lock"
export * from "./types/template"
export * from "./webhook/queue"
