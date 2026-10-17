/**
 * Case 10: Unknown Block Passthrough
 *
 * This POC proves that unrecognized tags (`<g-evil>`, `<script>`, <x>`
 * style markup) are treated as inert static text: the validator flags
 * them via `validateNamesBlock`, and the compiler renders them literally
 * instead of interpreting them. There is no tag that smuggles code
 * through the block pipeline except the documented code blocks
 * (`<g-script>`, `{~ ~}`), which require template-source authorship.
 *
 * Expected: validator reports every unknown block; output contains them
 * literally; no code executes.
 */

import {TemplateEngine} from "../src/template/engine.js"

console.log(`--- CASE 10: UNKNOWN BLOCK PASSTHROUGH ---`)

const store = globalThis as unknown as Record<string, unknown>
store.__poc10 = false
store.setFlag = () => {
  store.__poc10 = true
}

const tick = String.fromCharCode(96)
const hostile = `${tick} + globalThis.setFlag() + ${tick}\${store.__poc10}`

const template = `<g-base><g-message><g-evil>${hostile}</g-evil><script>alert(1)</script></g-message></g-base>`

const validation = TemplateEngine.validateNamesBlock(template)
console.log(`Validator errors:`, JSON.stringify(validation.errors))
const flaggedEvil = validation.errors.some((e) => e.message.includes(`g-evil`))
const flaggedScript = validation.errors.some((e) => e.message.includes(`script`))

const render = TemplateEngine.compileBlockGMessage(template).default?.default
if (!render) throw new Error(`compile produced no default message`)
const {text: out} = render({})
console.log(`Output:`, JSON.stringify(out))

if (store.__poc10 === true) {
  console.log(`VULNERABLE: unknown block executed code`)
  process.exit(1)
} else if (!validation.valid && flaggedEvil && flaggedScript && out.includes(`<g-evil>`) && out.includes(`<script>`)) {
  console.log(`SAFE: unknown blocks flagged and rendered literally, no code executed`)
} else {
  console.log(`UNEXPECTED: validator or output mismatch`)
  process.exit(1)
}
