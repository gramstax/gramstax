import type {Gramstax} from "gramstax"

/** Data Gramstax passes to `hookErrorPage`. */
export type IErrorPageData = NonNullable<Parameters<NonNullable<Gramstax[`hookErrorPage`]>>[1]>

/** Session fields used while the sum-number page walks its two inputs. */
export type ISumNumberStep = `l` | `r` | `s`

export interface ISumNumberSession {
  step?: ISumNumberStep
  left?: number
}
