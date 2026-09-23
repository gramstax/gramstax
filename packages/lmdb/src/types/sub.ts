import type {ILmdbKey} from "./key"

/**
 * Parsed composite index query — point, prefix, or explicit bounds.
 *
 * @remarks
 * Points carry the full tuple; prefixes carry the short tuple for seeks;
 * ranges carry optional start/end bound tuples.
 *
 * @internal
 */
export type IParsedCompositeQuery = {kind: `point`; tuple: Array<ILmdbKey>} | {kind: `prefix`; tuple: Array<ILmdbKey>} | {kind: `range`; start: Array<ILmdbKey> | undefined; end: Array<ILmdbKey> | undefined}

/**
 * Prefix/range half of a parsed composite query.
 *
 * @remarks
 * Points ride the standard driver path — only prefix and range queries
 * need dedicated cursor scans.
 *
 * @internal
 */
export type ICompositeRangeQuery = Extract<IParsedCompositeQuery, {kind: `prefix` | `range`}>
