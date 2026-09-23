import type {ICodec} from "./types/codec"

/**
 * Schema-aware positional record codec for `@gramstax/lmdb`.
 *
 * @remarks
 * Rows encode as positional arrays in column declaration order — field
 * names never reach disk — and decode back to row objects. The codec rides
 * the existing `hookBeforeWrite`/`hookBeforeRead` slot, so no read/write
 * path changes: validation, defaults, enums, indexes, TTL envelopes, and
 * search maintenance all operate on typed rows pre-encoding.
 *
 * Absent optional columns encode as `undefined` cells and decode back to
 * absent (never present-`undefined`), preserving row shape exactly.
 * Non-array stored values decode through untouched, so rows written before
 * the codec (or raw bytes via `putBinary`) still read.
 *
 * Implements {@link ICodec} directly, so a registration installs it with
 * `new RecordCodec(columns)` — the column order doubles as the codec's
 * configuration, which is why this is a class; the dotted-path helpers
 * ride as statics on it (alongside the {@link Search} statics).
 *
 * @public
 */
export class RecordCodec implements ICodec<unknown> {
  /**
   * Create a codec for a fixed column order.
   *
   * @param columns - Value column names in declaration order; doubles as
   * the positional layout and the codec's configuration.
   */
  constructor(public readonly columns: Array<string>) {}

  /**
   * Read a column from a row, walking dotted paths (`"profile.email"`).
   *
   * @remarks
   * Mirrors the auto-resolved index extractor's walk, but returns `undefined`
   * for absent paths instead of throwing — an absent optional parent is a
   * missing cell, not a write error. Reused by composite tuple extraction.
   *
   * @param row - The decoded row object.
   * @param column - Column name or dotted path.
   * @returns The cell value, or `undefined` for absent paths.
   *
   * @internal
   */
  static _getPath(row: Record<string, unknown>, column: string): unknown {
    if (!column.includes(`.`)) return row[column]
    let current: unknown = row
    for (const part of column.split(`.`)) {
      if (current === null || typeof current !== `object`) return undefined
      current = (current as Record<string, unknown>)[part]
    }
    return current
  }

  /**
   * Write a cell back into a row, rebuilding dotted paths as needed.
   *
   * @param row - The row under construction (mutated in place).
   * @param column - Column name or dotted path.
   * @param cell - The positional cell value.
   *
   * @internal
   */
  static _setPath(row: Record<string, unknown>, column: string, cell: unknown): void {
    if (!column.includes(`.`)) {
      row[column] = cell
      return
    }
    const parts = column.split(`.`)
    let current = row
    for (let i = 0; i < parts.length - 1; i++) {
      const next = current[parts[i]!]
      if (next === null || typeof next !== `object`) {
        const fresh: Record<string, unknown> = {}
        current[parts[i]!] = fresh
        current = fresh
      } else {
        current = next as Record<string, unknown>
      }
    }
    current[parts[parts.length - 1]!] = cell
  }

  /**
   * Encode a typed row to its positional array form.
   *
   * @param value - The row object (passes through untouched when it is not
   * an object).
   * @returns Positional cells in column declaration order.
   *
   * @public
   */
  hookBeforeWrite(value: unknown): unknown {
    if (value === null || typeof value !== `object`) return value
    // Single narrow cast at the codec boundary — the hook contract is
    // `unknown`, and every caller passes the typed row object.
    const row = value as Record<string, unknown>
    return this.columns.map((column) => RecordCodec._getPath(row, column))
  }

  /**
   * Decode a positional array back to a typed row.
   *
   * @param raw - The stored value (passes through untouched when it is not
   * an array, so pre-codec rows still read).
   * @returns The rebuilt row with `undefined` cells left absent.
   *
   * @public
   */
  hookBeforeRead(raw: unknown): unknown {
    if (!Array.isArray(raw)) return raw
    const cells = raw as Array<unknown>
    const row: Record<string, unknown> = {}
    for (let i = 0; i < this.columns.length; i++) {
      const cell = cells[i]
      if (cell !== undefined) RecordCodec._setPath(row, this.columns[i]!, cell)
    }
    return row
  }
}
