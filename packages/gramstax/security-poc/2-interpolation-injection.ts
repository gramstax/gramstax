/**
 * Case 2: Template Literal Interpolation Injection
 *
 * This POC proves that `${}` smuggled into top-level static template text
 * is rendered literally instead of being evaluated. Non-generated spans
 * are emitted as `JSON.stringify` string literals, so only code produced
 * by the block/scope processors ever runs.
 *
 * Expected: no code executes; the payload prints literally.
 */

import {TemplateEngine} from "../src/template/engine.js"

console.log(`--- CASE 2: INTERPOLATION INJECTION ---`)

const store = globalThis as unknown as Record<string, unknown>
store.__poc2 = false

// The payload sits directly in the message block. It must stay literal.
const maliciousTemplate = `
  <g-base>
    <g-message>
      Server Time: \${((globalThis as unknown as Record<string, unknown>).__poc2 = true, new Date())}
    </g-message>
  </g-base>
`

console.log(`Compiling template...`)
const messages = TemplateEngine.compileBlockGMessage(maliciousTemplate)

console.log(`Executing compiled function...`)
const render = messages.default?.default
if (!render) throw new Error(`compile produced no default message`)
const result = render({})
console.log(`Final Result:`, result)

if (store.__poc2 === true) {
  console.log(`VULNERABLE: interpolation injection executed code`)
  process.exit(1)
} else {
  console.log(`SAFE: interpolation payload rendered literally, no code executed`)
}
