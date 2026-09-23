import type {LmdbEnv} from "../env"
import {CdcHub} from "./hub"
import {CdcStore} from "./store"

export * from "./hub"
export * from "./store"
export * from "../types/cdc"

/**
 * Per-env CDC entry point (store plus hub).
 *
 * @remarks
 * A class of statics (rather than a bare `cdcFor` function) so every helper
 * in `src` lives on a class. The per-env state rides a `WeakMap`, created
 * on first use. No instance state — never construct it.
 *
 * @internal
 */
export class Cdc {
  /**
   * Per-env CDC state keyed by env instance.
   *
   * @remarks
   * A `WeakMap` so closed envs drop their entry automatically — no manual
   * cleanup, no cross-env leakage.
   *
   * @internal
   */
  private static _entries = new WeakMap<LmdbEnv, {store: CdcStore; hub: CdcHub}>()

  /**
   * Per-env CDC state (store plus hub), created on first use.
   *
   * @param env - The env to fetch CDC state for.
   * @returns The cached `{store, hub}` pair for the env.
   */
  static for(env: LmdbEnv): {store: CdcStore; hub: CdcHub} {
    let entry = Cdc._entries.get(env)
    if (entry === undefined) {
      const store = new CdcStore(env)
      entry = {store, hub: new CdcHub(env, store)}
      Cdc._entries.set(env, entry)
    }
    return entry
  }
}
