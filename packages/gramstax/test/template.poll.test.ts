import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {existsSync} from "node:fs"
import {mkdir, rm} from "node:fs/promises"
import {join} from "node:path"
import {TemplateEngine} from "~/template/engine"
import {TemplateManager} from "~/template/manager"

const TEST_DIR = join(import.meta.dir, `views-poll`)

const regularTemplate = `<g-base>
  <g-poll>
    <g-question>Pick one</g-question>
    <g-option>Alpha</g-option>
    <g-option>Beta</g-option>
  </g-poll>
</g-base>`

const quizTemplate = `<g-base>
  <g-poll type="quiz" correct="0" explanation="Because {{reason}}">
    <g-question>What is {{topic}}?</g-question>
    <g-option>Answer A</g-option>
    <g-option>{{choice|upper}}</g-option>
  </g-poll>
</g-base>`

const wrap = (inner: string): string => `<g-base>
  <g-poll${inner}>
</g-base>`

describe(`poll-parser`, () => {
  it(`parses a regular poll with defaults`, () => {
    const polls = TemplateEngine._processGPollBlocks(regularTemplate)
    expect(polls.default?.type).toBe(`regular`)
    expect(polls.default?.question).toBe(`Pick one`)
    expect(polls.default?.options).toEqual([`Alpha`, `Beta`])
    expect(polls.default?.anonymous).toBe(true)
    expect(polls.default?.correct).toBeUndefined()
  })

  it(`parses quiz grading fields and boolean attrs`, () => {
    const polls = TemplateEngine._processGPollBlocks(quizTemplate)
    expect(polls.default?.type).toBe(`quiz`)
    expect(polls.default?.correct).toBe(0)
    expect(polls.default?.explanation).toBe(`Because {{reason}}`)
  })

  it(`parses anonymous false and multiple true`, () => {
    const polls = TemplateEngine._processGPollBlocks(
      wrap(` anonymous="false" multiple="true">
    <g-question>Q?</g-question>
    <g-option>A</g-option>
    <g-option>B</g-option>
  </g-poll>`)
    )
    expect(polls.default?.anonymous).toBe(false)
    expect(polls.default?.multiple).toBe(true)
  })

  it(`keys polls by lang with last block winning`, () => {
    const polls = TemplateEngine._processGPollBlocks(`<g-base><g-poll lang="id"><g-question>Q?</g-question><g-option>A</g-option><g-option>B</g-option></g-poll></g-base>`)
    expect(Object.keys(polls)).toEqual([`id`])
  })
})

describe(`poll-validator`, () => {
  it(`accepts a valid regular poll`, () => {
    expect(TemplateEngine.validateTemplate(regularTemplate).valid).toBe(true)
  })

  it(`accepts a valid quiz poll`, () => {
    expect(TemplateEngine.validateTemplate(quizTemplate).valid).toBe(true)
  })

  it(`rejects a missing question`, () => {
    const result = TemplateEngine.validateBlockGPollAttributes(
      wrap(`>
    <g-option>A</g-option>
    <g-option>B</g-option>
  </g-poll>`)
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`exactly one <g-question>`))).toBe(true)
  })

  it(`rejects a single option`, () => {
    const result = TemplateEngine.validateBlockGPollAttributes(
      wrap(`>
    <g-question>Q?</g-question>
    <g-option>Only</g-option>
  </g-poll>`)
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`2-10`))).toBe(true)
  })

  it(`rejects eleven options`, () => {
    const options = Array.from({length: 11}, (_, i) => `<g-option>O${i}</g-option>`).join(``)
    const result = TemplateEngine.validateBlockGPollAttributes(
      wrap(`>
    <g-question>Q?</g-question>
    ${options}
  </g-poll>`)
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`2-10`))).toBe(true)
  })

  it(`rejects correct on regular`, () => {
    const result = TemplateEngine.validateBlockGPollAttributes(
      wrap(` correct="0">
    <g-question>Q?</g-question>
    <g-option>A</g-option>
    <g-option>B</g-option>
  </g-poll>`)
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`only allowed for type="quiz"`))).toBe(true)
  })

  it(`rejects multiple on quiz`, () => {
    const result = TemplateEngine.validateBlockGPollAttributes(
      wrap(` type="quiz" correct="0" multiple="true">
    <g-question>Q?</g-question>
    <g-option>A</g-option>
    <g-option>B</g-option>
  </g-poll>`)
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`only allowed for type="regular"`))).toBe(true)
  })

  it(`rejects explanation on regular`, () => {
    const result = TemplateEngine.validateBlockGPollAttributes(
      wrap(` explanation="why">
    <g-question>Q?</g-question>
    <g-option>A</g-option>
    <g-option>B</g-option>
  </g-poll>`)
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`"explanation"`))).toBe(true)
  })

  it(`rejects quiz without correct`, () => {
    const result = TemplateEngine.validateBlockGPollAttributes(
      wrap(` type="quiz">
    <g-question>Q?</g-question>
    <g-option>A</g-option>
    <g-option>B</g-option>
  </g-poll>`)
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`"correct"`))).toBe(true)
  })

  it(`rejects correct out of range`, () => {
    const result = TemplateEngine.validateBlockGPollAttributes(
      wrap(` type="quiz" correct="5">
    <g-question>Q?</g-question>
    <g-option>A</g-option>
    <g-option>B</g-option>
  </g-poll>`)
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`option index 0-1`))).toBe(true)
  })

  it(`rejects an unknown attr`, () => {
    const result = TemplateEngine.validateBlockGPollAttributes(
      wrap(` foo="1">
    <g-question>Q?</g-question>
    <g-option>A</g-option>
    <g-option>B</g-option>
  </g-poll>`)
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`Unknown attribute`))).toBe(true)
  })

  it(`rejects a bad type value`, () => {
    const result = TemplateEngine.validateBlockGPollAttributes(
      wrap(` type="multi">
    <g-question>Q?</g-question>
    <g-option>A</g-option>
    <g-option>B</g-option>
  </g-poll>`)
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`must be "regular" or "quiz"`))).toBe(true)
  })

  it(`rejects static question overflow`, () => {
    const long = `Q`.repeat(301)
    const result = TemplateEngine.validateBlockGPollAttributes(
      wrap(`>
    <g-question>${long}</g-question>
    <g-option>A</g-option>
    <g-option>B</g-option>
  </g-poll>`)
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`1-300`))).toBe(true)
  })

  it(`rejects static option overflow`, () => {
    const long = `O`.repeat(101)
    const result = TemplateEngine.validateBlockGPollAttributes(
      wrap(`>
    <g-question>Q?</g-question>
    <g-option>${long}</g-option>
    <g-option>B</g-option>
  </g-poll>`)
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`1-100`))).toBe(true)
  })

  it(`rejects static explanation overflow`, () => {
    const long = `E`.repeat(201)
    const result = TemplateEngine.validateBlockGPollAttributes(
      wrap(` type="quiz" correct="0" explanation="${long}">
    <g-question>Q?</g-question>
    <g-option>A</g-option>
    <g-option>B</g-option>
  </g-poll>`)
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes(`at most 200`))).toBe(true)
  })
})

describe(`poll-compiler`, () => {
  it(`interpolates question options and explanation with filters`, () => {
    const compiled = TemplateEngine.compileBlockGPoll(quizTemplate)
    const poll = compiled.default?.default?.({topic: `math`, reason: `it is`, choice: `b variant`})
    expect(poll?.question).toBe(`What is math?`)
    expect(poll?.options).toEqual([`Answer A`, `B VARIANT`])
    expect(poll?.explanation).toBe(`Because it is`)
    expect(poll?.type).toBe(`quiz`)
    expect(poll?.correct).toBe(0)
  })

  it(`defaults anonymous to true`, () => {
    const compiled = TemplateEngine.compileBlockGPoll(regularTemplate)
    expect(compiled.default?.default?.({})?.anonymous).toBe(true)
  })
})

describe(`poll-manager`, () => {
  beforeEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, {recursive: true, force: true})
    }
    await mkdir(TEST_DIR, {recursive: true})
  })

  afterEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, {recursive: true, force: true})
    }
  })

  it(`compiles and serves a poll via getGPoll`, () => {
    const manager = new TemplateManager({path: [TEST_DIR]})
    manager.compile(`quiz`, quizTemplate)
    const poll = manager.getGPoll(`quiz`, `default`, `default`, {topic: `math`, reason: `it is`, choice: `b`})
    expect(poll.question).toBe(`What is math?`)
    expect(poll.options).toEqual([`Answer A`, `B`])
    expect(poll.explanation).toBe(`Because it is`)
  })

  it(`throws for a missing poll`, () => {
    const manager = new TemplateManager({path: [TEST_DIR]})
    manager.compile(`empty`, `<g-base><g-message>Hi</g-message></g-base>`)
    expect(() => manager.getGPoll(`empty`)).toThrow(/Poll function not found/)
  })

  it(`throws on an invalid poll template`, () => {
    const manager = new TemplateManager({path: [TEST_DIR]})
    expect(() =>
      manager.compile(
        `bad`,
        wrap(`>
    <g-option>A</g-option>
  </g-poll>`)
      )
    ).toThrow(/exactly one <g-question>/)
  })
})
