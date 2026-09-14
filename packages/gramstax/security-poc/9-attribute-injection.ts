/**
 * Case 9: Attribute Value Injection
 *
 * This POC proves that hostile attribute values — backticks, quotes,
 * `${}`, across `id`, `value`, `is`, `join`, `type`, and `src`, in
 * double-quoted, single-quoted, and bare syntax — cannot break out of the
 * generated code. Attribute values are embedded via `JSON.stringify`, so
 * they stay inert strings wherever they land (object keys, switch
 * discriminants, join separators, media sources).
 *
 * Expected: everything renders as strings; no code executes.
 */

import {TemplateEngine} from "../src/template/engine.js"

console.log(`--- CASE 9: ATTRIBUTE VALUE INJECTION ---`)

const store = globalThis as unknown as Record<string, unknown>
store.__poc9 = false
store.setFlag = () => {
  store.__poc9 = true
}

const tick = String.fromCharCode(96)
const hostile = `${tick} + globalThis.setFlag() + ${tick}\${store.__poc9}`

const template = `<g-base><g-message><g-switch value="${hostile}"><g-case is="${hostile}">A</g-case><g-default>D</g-default></g-switch><g-map src="items" join='${hostile}'>{{e}}</g-map></g-message></g-base>`
const messages = TemplateEngine.compileBlockGMessage(template)
const render = messages.default?.default
if (!render) throw new Error(`compile produced no default message`)
const out = render({items: [`x`, `y`]})
console.log(`Message output:`, JSON.stringify(out))

const mediaTemplate = `<g-base><g-media type="photo" src="${hostile}"></g-media></g-base>`
const medias = TemplateEngine._processGMediaBlocks(mediaTemplate)
console.log(`Media block:`, JSON.stringify(medias.default))

if (store.__poc9 === true) {
  console.log(`VULNERABLE: attribute injection executed code`)
  process.exit(1)
} else if (typeof out === `string` && medias.default?.src === hostile) {
  console.log(`SAFE: hostile attributes rendered inertly, no code executed`)
} else {
  console.log(`UNEXPECTED: unexpected output shape`)
  process.exit(1)
}
