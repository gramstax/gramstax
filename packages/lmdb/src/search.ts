import type {ILmdbKey} from "./types/key"

/**
 * Full-text search primitives for `@gramstax/lmdb`.
 *
 * @remarks
 * The search index is an inverted table per searched column
 * (`{db}:search:{column}`, dupSort): each term maps to the primary keys of
 * the rows containing it. Posting maintenance rides the embedded-index write
 * path (same writer transaction); ranking happens at read time in
 * {@link LmdbEnvSub.search}.
 *
 * Tokenization is deliberately minimal for v1 (lowercase + split on
 * non-alphanumerics, no stemming, ASCII fold-free) — non-ASCII letters act
 * as separators.
 *
 * A class of pure statics (rather than bare functions) so every helper in
 * `src` lives on a class. No instance state — never construct it.
 *
 * @public
 */
export class LmdbSearch {
  /**
   * Split text into lowercase alphanumeric terms.
   *
   * @param text - Raw field text.
   * @returns Lowercase terms (`a-z`, `0-9`); `[]` for empty/punctuation-only input.
   * @public
   */
  static tokenize(text: string): Array<string> {
    return text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((term) => term.length > 0)
  }

  /**
   * Tokenize a searched-column field value.
   *
   * @remarks
   * Non-string values (absent fields, `null`, or off-kind rows written around
   * the type system) contribute no terms — mirroring how `null`/`undefined`
   * extracts skip embedded indexes.
   *
   * @param value - The raw field value.
   * @returns Terms for strings, `[]` otherwise.
   * @public
   */
  static tokenizeField(value: unknown): Array<string> {
    return typeof value === `string` ? LmdbSearch.tokenize(value) : []
  }

  /**
   * Fingerprint a primary key by value for score-map lookups.
   *
   * @remarks
   * `Map` keys use reference identity, which breaks for array/buffer primary
   * keys (each read materializes a fresh object). The fingerprint is a stable
   * string encoding of the key's VALUE so the same logical key always maps to
   * the same entry.
   *
   * @param pk - The primary key.
   * @returns A stable string fingerprint of the key value.
   * @public
   */
  static fingerprintPk(pk: ILmdbKey): string {
    if (typeof pk === `string`) return `s:${pk}`
    if (typeof pk === `number` || typeof pk === `boolean` || typeof pk === `bigint`) return `v:${typeof pk}:${String(pk)}`
    if (typeof pk === `symbol`) return `y:${String(pk)}`
    if (pk instanceof Uint8Array) return `x:${Buffer.from(pk).toString(`hex`)}`
    if (Array.isArray(pk)) return `a:[${pk.map((entry) => LmdbSearch.fingerprintPk(entry as ILmdbKey)).join(`,`)}]`
    return `j:${JSON.stringify(pk) ?? String(pk)}`
  }
}
