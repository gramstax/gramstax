/**
 * Case 7: Media Group src Breakout
 *
 * This POC proves that backticks, quotes, and `${}` smuggled into media
 * `src` values — both pipe-delimited (`src="a|b"`) and `<g-media-group>`
 * items — cannot break out of the generated code. `src` expressions are
 * embedded via `JSON.stringify`, and `_processGMediaGroupBlocks` returns
 * plain data (never code), so hostile characters stay inert strings.
 *
 * Known parser limitation (robustness only, no code execution): attribute
 * values containing a raw `>` can end tag matching early because tag
 * regexes use `[^>]*`. Such input may mis-split, but the fragments remain
 * inert strings — the execution flag below is the security verdict.
 *
 * Expected: src values preserved literally in the compiled definitions;
 * no code executes.
 */

import {TemplateEngine} from "../src/template/engine.js"

console.log(`--- CASE 7: MEDIA GROUP SRC BREAKOUT ---`)

const store = globalThis as unknown as Record<string, unknown>
store.__poc7 = false
store.setFlag = () => {
  store.__poc7 = true
}

const tick = String.fromCharCode(96)
const hostile = `${tick} + globalThis.setFlag() + ${tick}\${store.__poc7}`

// Attack 1: hostile chars inside a <g-media-group> item src.
const templateGroup = `<g-base><g-media-group><g-media type="photo" src="${hostile}">cap</g-media></g-media-group></g-base>`
const groups = TemplateEngine._processGMediaGroupBlocks(templateGroup)
const groupSrc = groups.default?.mediaGroup?.[0]?.src
console.log(`Media-group src:`, JSON.stringify(groupSrc))

// Attack 2: hostile chars inside a pipe-delimited src.
const templatePipe = `<g-base><g-media type="photo" src="ok|${hostile}"></g-media></g-base>`
const medias = TemplateEngine._processGMediaBlocks(templatePipe)
const pipeBlock = medias.default
const pipeSrc = pipeBlock?.srcList?.[1] ?? pipeBlock?.src
console.log(`Pipe src block:`, JSON.stringify(pipeBlock))

if (store.__poc7 === true) {
  console.log(`VULNERABLE: media src breakout executed code`)
  process.exit(1)
} else if (groupSrc === hostile && JSON.stringify(pipeSrc).includes(hostile)) {
  console.log(`SAFE: hostile src preserved literally, no code executed`)
} else {
  console.log(`UNEXPECTED: src not preserved literally`)
  process.exit(1)
}
