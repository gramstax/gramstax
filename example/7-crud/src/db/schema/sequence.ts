import {type KeyOf, LmdbSchema, type ValueOf, t} from "@gramstax/lmdb"

export type IKSequence = KeyOf<typeof SequenceSchema>
export type IVSequence = ValueOf<typeof SequenceSchema>
export class SequenceSchema extends LmdbSchema {
  static db = `sequence`
  static key = t.number()
  static value = {
    seq: t.number(),
    count: t.number()
  }
}
