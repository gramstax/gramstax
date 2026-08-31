import { LmdbSchema, t, type KeyOf, type ValueOf } from "@gramstax/lmdb"

export type IKUser = KeyOf<typeof UserSchema>
export type IVUser = ValueOf<typeof UserSchema>
export class UserSchema extends LmdbSchema {
  static db = `user`
  static key = t.number()
  static value = {
    tgId: t.number(),
    username: t.string(),
    firstName: t.string(),
    lastName: t.string(),
    languageCode: t.string(),
    createdAt: t.number(),
    updatedAt: t.number()
  }
}