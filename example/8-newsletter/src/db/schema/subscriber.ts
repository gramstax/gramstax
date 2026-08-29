import {type KeyOf, LmdbSchema, t, type ValueOf} from "@gramstax/lmdb"

export type IKSubscriber = KeyOf<typeof SubscriberSchema>
export type IVSubscriber = ValueOf<typeof SubscriberSchema>
export class SubscriberSchema extends LmdbSchema {
  static db = `subscriber`
  static key = t.number()
  static value = {
    id: t.number(),
    userName: t.string().nullable(),
    fullName: t.string().nullable(),
    language: t.string().nullable(),
    joinedAt: t.number()
  }
}
