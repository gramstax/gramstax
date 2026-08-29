import {type KeyOf, LmdbSchema, t, type ValueOf} from "@gramstax/lmdb"

export type IKItem = KeyOf<typeof ItemSchema>
export type IVItem = ValueOf<typeof ItemSchema>
export class ItemSchema extends LmdbSchema {
  static db = `items`
  static key = t.string()
  static value = {
    id: t.string(),
    title: t.string(),
    description: t.string(),
    status: t.string(),
    createdAt: t.number(),
    updatedAt: t.number()
  }
}
