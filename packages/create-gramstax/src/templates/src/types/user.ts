/**
 * The user fields the scaffolded repository accepts before storage.
 *
 * `IVUser` (from the schema) also carries `createdAt` and `updatedAt`; this
 * profile is deliberately narrower so callers cannot supply timestamps.
 */
export interface IUserProfile {
  username: string
  firstName: string
  lastName?: string
  languageCode?: string
}
