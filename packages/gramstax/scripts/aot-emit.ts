/**
 * aot-emit.ts
 *
 * AOT emitter: turns JIT-compiled template structures (collected while
 * `TemplateEngine.__emitHook` is installed) into importable JS modules.
 *
 * Shape decision (024 contract): each key emits `<safeKey>.g.js` with a
 * single `export const template` matching `ITCompiledTemplate` (absent
 * blocks omitted), so consumers can `_registerCompiled(key, template)`
 * directly. `gen/manifest.js` re-exports per-key modules as
 * `{templates: Record<key, ITCompiledTemplate>}`; `pages` stays in userland
 * source (023 `manifest.js`) in AOT v1.
 *
 * Hybrid emission (why): message/keyboard-style leaves ARE `_compileToFunction`
 * products, so they freeze into named inline functions plus a `(data)` arity
 * wrapper under the stable id. Media-style leaves are hand-written engine
 * closures around those functions (opaque to any deep walk), so those fields
 * rebuild at import: the module pre-registers every collected body in a Map
 * keyed `${isArray}:${body}`, sets `__linkHook` to a throwing-on-miss lookup,
 * re-runs the same block compilers on the embedded raw template (closing over
 * real inline functions, zero codegen), then clears the hook. Output is
 * identical either way (same compiler, same input), and the build-guard still
 * inspects every collected body.
 *
 * Edge-safety invariant: emitted files contain zero codegen tokens — no
 * `new Function`, `Function(`, or `eval(` — so they load where the
 * `Function` constructor is unavailable (Workers). Bodies are already
 * `return ...` statements (valid function bodies); `with(`-bodies are
 * rejected by `detectWith` before emit, which is what makes inline emission
 * semantics-preserving versus `new Function`.
 *
 * Key sanitizing (`safeKey`) maps any non-identifier character to `_` and
 * prefixes a leading digit. Collisions between distinct keys mapping to one
 * filename (e.g. `a/b` vs `a_b`) are caller-visible — keep keys distinct.
 */

import {TemplateEngine} from "../src/template/engine"

const RECOMPILE_FIELDS: Record<string, string> = {
  dice: `compileBlockGDice`,
  inlineButton: `compileBlockGInlineButton`,
  invoice: `compileBlockGInvoice`,
  media: `compileBlockGMedia`,
  paidMedia: `compileBlockGPaidMedia`,
  poll: `compileBlockGPoll`,
  venue: `compileBlockGVenue`
}

export class AotEmitter {
  _bodies = new Map<string, string>()
  _flags = new Map<string, boolean>()
  _counter = 0

  beginCollect(): void {
    this._bodies = new Map<string, string>()
    this._flags = new Map<string, boolean>()
    this._counter = 0
    TemplateEngine.__emitHook = (body: string, meta: {isArray: boolean}): ((...args: unknown[]) => unknown) => this._record(body, meta.isArray)
  }

  endCollect(): void {
    TemplateEngine.__emitHook = undefined
  }

  collectBodies(compiled: unknown): Map<string, string> {
    const found = new Map<string, string>()
    const walk = (node: unknown, block: string): void => {
      if (typeof node === `function`) {
        const id = (node as unknown as {__aotId?: unknown}).__aotId
        if (typeof id !== `string` || this._bodies.has(id) === false) {
          throw new Error(`AOT cannot emit ${block === `` ? `template` : `block "${block}"`}: function was not collected through __emitHook (JIT-only value cannot be emitted)`)
        }
        found.set(id, this._bodies.get(id)!)
        return
      }
      if (Array.isArray(node)) {
        node.forEach((item, index) => {
          walk(item, `${block}[${index}]`)
        })
        return
      }
      if (node !== null && typeof node === `object`) {
        const proto = Object.getPrototypeOf(node)
        if (proto !== Object.prototype && proto !== null) {
          throw new Error(`AOT cannot emit block "${block}": non-plain object leaf (only functions and JSON-safe values are emit-able)`)
        }
        for (const [childKey, child] of Object.entries(node)) walk(child, block === `` ? childKey : `${block}.${childKey}`)
        return
      }
      if (node !== undefined && node !== null && typeof node !== `string` && typeof node !== `number` && typeof node !== `boolean`) {
        throw new Error(`AOT cannot emit block "${block}": non-JSON leaf of type ${typeof node} (only functions and JSON-safe values are emit-able)`)
      }
    }
    walk(compiled, ``)
    return found
  }

  detectWith(key: string, bodies: Map<string, string>): void {
    for (const [id, body] of bodies) {
      const at = body.search(/\bwith\s*\(/)
      if (at >= 0) {
        const snippet = body.slice(Math.max(0, at - 40), at + 40).replace(/\s+/g, ` `)
        throw new Error(
          `AOT blocked for template "${key}" (${id}): body contains \`with(\` — \`with\` is forbidden in ESM strict mode, so the emitted module could not load. Move the logic into the page class (a method returning plain data) instead of \`{~~ ... ~~}\` / \`<g-script>\`. Snippet: ${snippet}`
        )
      }
    }
  }

  emitModule(key: string, rawTemplate: string, compiled: unknown): string {
    const defs: string[] = []
    for (const [id, body] of this._bodies) {
      defs.push(`function __${id}(data, __esc, FILTERS) {${body}}`)
      defs.push(`const ${id} = (data) => __${id}(data, __esc, FILTERS)`)
    }
    const parts: string[] = []
    const rebuilt: Array<string> = []
    for (const [field, subtree] of Object.entries(compiled as Record<string, unknown>)) {
      const compiler = RECOMPILE_FIELDS[field]
      if (compiler !== undefined && this._hasUntagged(subtree)) {
        rebuilt.push(`${field}: ${compiler}`)
        continue
      }
      const fieldBodies = this.collectBodies({[field]: subtree})
      parts.push(`${field}: ${this._renderValue(subtree, fieldBodies, key)}`)
    }
    this.detectWith(key, this._bodies)
    const lines: Array<string> = [`import {__esc, FILTERS${rebuilt.length > 0 ? `, TemplateEngine` : ``}} from "gramstax"`]
    for (const def of defs) lines.push(def)
    if (rebuilt.length > 0) {
      lines.push(`const __raw = ${JSON.stringify(rawTemplate)}`)
      const seenKeys = new Set<string>()
      const pairs: Array<string> = []
      for (const [id, body] of this._bodies) {
        const linkKey = `${this._flags.get(id) === true ? 1 : 0}:${body}`
        if (seenKeys.has(linkKey)) continue
        seenKeys.add(linkKey)
        pairs.push(`[${JSON.stringify(linkKey)}, ${id}]`)
      }
      lines.push(`const __link = new Map([${pairs.join(`, `)}])`)
      lines.push(`TemplateEngine.__linkHook = (body, isArray) => {`)
      lines.push(`  const hit = __link.get(\`\${isArray ? 1 : 0}:\${body}\`)`)
      lines.push(`  if (hit === undefined) throw new Error(\`AOT link miss for template "${key}": body not collected at build time (regenerate the module)\`)`)
      lines.push(`  return hit`)
      lines.push(`}`)
      for (const entry of rebuilt) {
        const [field] = entry.split(`: `) as [string, string]
        lines.push(`let __rebuilt_${field}`)
      }
      lines.push(`try {`)
      for (const entry of rebuilt) {
        const [field, compiler] = entry.split(`: `) as [string, string]
        lines.push(`  __rebuilt_${field} = TemplateEngine.${compiler}(__raw)`)
      }
      lines.push(`} finally {`)
      lines.push(`  TemplateEngine.__linkHook = undefined`)
      lines.push(`}`)
      for (const entry of rebuilt) {
        const [field] = entry.split(`: `) as [string, string]
        parts.push(`${field}: __rebuilt_${field}`)
      }
    }
    return `${lines.join(`\n`)}\nexport const template = {${parts.join(`, `)}}\n`
  }

  safeKey(key: string): string {
    const safe = key.replace(/[^A-Za-z0-9_]/g, `_`)
    return /^[0-9]/.test(safe) ? `_${safe}` : safe
  }

  _hasUntagged(node: unknown): boolean {
    if (typeof node === `function`) {
      const id = (node as unknown as {__aotId?: unknown}).__aotId
      return typeof id !== `string` || this._bodies.has(id) === false
    }
    if (Array.isArray(node)) return node.some((item) => this._hasUntagged(item))
    if (node !== null && typeof node === `object`) return Object.values(node).some((child) => this._hasUntagged(child))
    return false
  }

  _renderValue(node: unknown, bodies: Map<string, string>, key: string): string {
    if (typeof node === `function`) {
      const id = (node as unknown as {__aotId?: string}).__aotId
      if (typeof id !== `string` || bodies.has(id) === false) {
        throw new Error(`AOT cannot emit template "${key}": function reference without collected body (JIT-only value cannot be emitted)`)
      }
      return id
    }
    if (node === undefined) return `undefined`
    if (Array.isArray(node)) return `[${node.map((item) => this._renderValue(item, bodies, key)).join(`, `)}]`
    if (node !== null && typeof node === `object`) {
      const proto = Object.getPrototypeOf(node)
      if (proto !== Object.prototype && proto !== null) {
        throw new Error(`AOT cannot emit template "${key}": non-plain object leaf (only functions and JSON-safe values are emit-able)`)
      }
      const entries = Object.entries(node).map(([childKey, child]) => `${JSON.stringify(childKey)}: ${this._renderValue(child, bodies, key)}`)
      return `{${entries.join(`, `)}}`
    }
    try {
      return JSON.stringify(node) ?? `undefined`
    } catch {
      throw new Error(`AOT cannot emit template "${key}": value is not JSON-safe (only functions and JSON-safe values are emit-able)`)
    }
  }

  _record(body: string, isArray: boolean): (...args: unknown[]) => unknown {
    const id = `fn${this._counter}`
    this._counter += 1
    this._bodies.set(id, body)
    this._flags.set(id, isArray)
    const stub = (): unknown => {
      throw new Error(`AOT stub ${id} called at runtime — stubs only exist during collect and must never render`)
    }
    ;(stub as unknown as {__aotId: string}).__aotId = id
    return stub
  }
}
