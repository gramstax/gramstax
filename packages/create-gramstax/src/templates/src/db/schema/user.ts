import type {KeyOf, ValueOf} from "@gramstax/lmdb"
import {LmdbSchema, t} from "@gramstax/lmdb"

export type IKUser = KeyOf<typeof UserSchema>
export type IVUser = ValueOf<typeof UserSchema>

export class UserSchema extends LmdbSchema {
  static db = `user`

  // The primary key already carries the Telegram id, so there is deliberately
  // no `tgId` column — a mirrored copy would store every id twice and let the
  // two drift apart.
  static key = t.number()

  static value = {
    username: t.string(),
    firstName: t.string(),
    // Telegram omits these often, so they stay optional instead of becoming
    // empty strings — "no last name" is not the same as a last name of "".
    lastName: t.string().optional(),
    languageCode: t.string().optional(),
    // Filled at write time when the caller omits it, so no call site has to
    // pass a timestamp.
    createdAt: t.date().$defaultFn(() => new Date()),
    // Maintained by the repository on update, hence optional.
    updatedAt: t.date().optional()
  }
}