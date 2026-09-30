/**
 * RPC cache request structure.
 *
 * @remarks
 * JSON-RPC-ish envelope used between instances to forward a cache
 * operation. Produced wherever a cache call is serialized for transport
 * and consumed wherever the receiving side dispatches it back onto a
 * `CacheExternal` handle. The fixed fields carry the dispatch target
 * while the index signature leaves room for transport-level extras.
 *
 * @public
 */
export type ICacheRpc = {
  /** Cache operation name or namespaced path. Accepted values: a single method name or an array of path segments. */
  method: string | string[]
  /** Named arguments for the cache operation. Accepted values: any string-keyed payload object. */
  params: Record<string, unknown>
  /** Extra envelope fields (transport metadata). Accepted values: any `unknown` or `string` value per key. */
  [moreRoot: string]: unknown | string
}
