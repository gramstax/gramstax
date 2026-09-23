import type {LmdbEnv} from "../env"

/**
 * Raw sub-DB handle shape for the CDC internal sub-DBs.
 *
 * @remarks
 * Taken from `env.getDb` — the CDC log/meta sub-DBs bypass the schema
 * wrapper and work directly on raw handles (sequence-keyed puts, key walks).
 *
 * @internal
 */
export type IRawDb = ReturnType<LmdbEnv[`getDb`]>
