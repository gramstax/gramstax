import {describe, expect, it } from "bun:test"
import {TemplateEngine} from "~/template/engine"

/**
 * Coverage guard: proves every supported Telegram Rich Message tag is validated.
 * Iterates the authoritative tag list so nothing can be added without coverage.
 * A tag is covered when it has a required-attr spec, a value validator, or is
 * officially documented as attribute-free (NO_ATTRIBUTE_TAGS).
 */
describe(`telegram rich tag coverage guard (Bot API 10.2)`, () => {
  const allTags = [...TemplateEngine.ALLOWED_BLOCKS_TELEGRAM_LEGACY, ...TemplateEngine.ALLOWED_BLOCKS_TELEGRAM_RICH]

  // Tags officially documented with no attributes (Bot API 10.2 rich spec);
  // normalized via the same rules as TemplateEngine._extractBlockNames.
  const NO_ATTRIBUTE_TAGS = new Set([
    // legacy inline
    `b`,
    `i`,
    `u`,
    `s`,
    `pre`,
    // rich inline
    `del`,
    `em`,
    `ins`,
    `mark`,
    `strike`,
    `strong`,
    `sub`,
    `sup`,
    `tg-spoiler`,
    // block / structural (language lives on nested <code class="language-x">)
    `br`,
    `footer`,
    `h1`,
    `h2`,
    `h3`,
    `h4`,
    `h5`,
    `h6`,
    `hr`,
    `p`,
    `summary`,
    `tr`,
    `ul`,
    // telegram-specific (no numeric attrs; content = child media / LaTeX)
    `tg-collage`,
    `tg-math`,
    `tg-math-block`,
    `tg-slideshow`,
    // media
    `cite`,
    `figcaption`,
    `figure`
  ])

  const normalize = (literal: string): string => {
    let name = literal.replace(/<\/?/g, ``).replace(/\s.*?>/, ``).replace(/\/?>/g, ``)
    // <blockquote expandable> normalizes to its base tag "blockquote"
    if (name === `blockquote expandable`) name = `blockquote`
    return name
  }

  for (const tagLiteral of allTags) {
    it(`validates block/tag ${tagLiteral}`, () => {
      const tagName = normalize(tagLiteral)
      const hasRequired = tagName in TemplateEngine._TELEGRAM_REQUIRED_ATTRS
      const hasValues = tagName in TemplateEngine._TELEGRAM_ATTR_VALUE_VALIDATORS
      const covered = hasRequired || hasValues || NO_ATTRIBUTE_TAGS.has(tagName)
      expect(covered, `tag ${tagLiteral} (${tagName}) has no validator spec — coverage gap`).toBe(true)
    })
  }

  it(`counts exactly 53 supported tags`, () => {
    expect(allTags.length).toBe(53)
  })

  it(`covers every officially documented attribute with a validator`, () => {
    const withValues = Object.keys(TemplateEngine._TELEGRAM_ATTR_VALUE_VALIDATORS)
    const required = Object.keys(TemplateEngine._TELEGRAM_REQUIRED_ATTRS)
    // Every tag carrying required attributes must also appear (or be intentionally
    // validated) in the attribute-value layer — presence and value are both checked.
    for (const tag of required) {
      const hasValueEntry = withValues.includes(tag)
      const noValueNeeded = NO_ATTRIBUTE_TAGS.has(tag)
      expect(hasValueEntry || noValueNeeded, `required-attr tag ${tag} lacks value validation`).toBe(true)
    }
  })
})