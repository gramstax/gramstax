/**
 * @gramstax/lmdb — LMDB-backed key-value database with typed collections.
 *
 * @remarks
 * Multi-runtime (Bun, Node.js >=18). Provides typed collection handles
 * over LMDB sub-databases, with cross-collection transactions.
 *
 */

export * from "./backup"
export * from "./cdc"
export * from "./codec"
export * from "./env"
export * from "./errors"
export * from "./queue"
export * from "./reader"
export * from "./schema"
export * from "./search"
export * from "./sub"
export * from "./sync"
export * from "./transaction"
export * from "./types/codec"
export type {ICompressionOptions, ILmdbEncoding, ILmdbEnvOptions, ILmdbEnvState} from "./types/env"
export * from "./types/indexes"
export * from "./types/key"
export * from "./types/range"
export * from "./types/search"
export * from "./types/sub-state"
