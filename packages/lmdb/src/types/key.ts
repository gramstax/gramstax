import type {Key} from "lmdb"

/**
 * Anything that can be used as a key in LMDB.
 *
 * @remarks
 * LMDB natively accepts strings, numbers, Buffers, and arrays of primitives
 * (ordered-binary composite keys). The array form enables multi-tenant
 * / namespaced keys like `["tenant-a", 42]` that sort lexicographically.
 * Re-exported from `lmdb` for convenience.
 *
 * @public
 */
export type ILmdbKey = Key
