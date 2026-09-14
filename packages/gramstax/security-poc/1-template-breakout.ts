/**
 * Case 1: Template Breakout via Backticks
 *
 * This POC proves that raw backticks (`) in the template string can no
 * longer break out of the generated code. Static segments are emitted as
 * `JSON.stringify` concatenation parts (never raw backtick literals), so
 * the payload below renders as inert text.
 *
 * Expected: no code executes; the payload prints literally.
 */

import {TemplateEngine} from "../src/template/engine.js"

console.log(`--- CASE 1: BACKTICK BREAKOUT ---`)

const store = globalThis as unknown as Record<string, unknown>
store.__poc1 = false

// The template contains a backtick followed by code execution logic.
// It must render literally instead of executing.
const maliciousTemplate = `
  <g-base>
    <g-message>
      Safe Text \` + (function(){
        (globalThis as unknown as Record<string, unknown>).__poc1 = true;
        return "[CODE EXECUTED]";
      })() + \` More Safe Text
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

if (store.__poc1 === true) {
  console.log(`VULNERABLE: backtick breakout executed code`)
  process.exit(1)
} else {
  console.log(`SAFE: backtick payload rendered literally, no code executed`)
}
