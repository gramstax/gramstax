/**
 * @gramstax/lmdb — LMDB-backed key-value database with OOP Repository pattern.
 *
 * @remarks
 * Multi-runtime (Bun, Node.js >=18). Provides a typed Repository abstraction
 * over LMDB sub-databases, with cross-repository transactions.
 *
 * @packageDocumentation
 * @public
 */

export * from "./codec"
export * from "./env"
export * from "./errors"
export * from "./repository"
export * from "./transaction"
export * from "./types"
