/**
 * Case 4: Untrusted Template Input (RCE)
 *
 * This POC demonstrates the MOST DANGEROUS scenario: building the template
 * string itself using untrusted user input. Templates are code — only
 * `data` values are untrusted input — so a `<g-script>` tag smuggled into
 * the template source executes with full server control.
 *
 * Expected: the injected `process.exit()` terminates this process,
 * proving Remote Code Execution. Reaching the line after `render({})`
 * means the injection failed.
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

console.log(`UNEXPECTED: injected process.exit() did not run`)
process.exit(1)
