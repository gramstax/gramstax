import type {Update} from "grammy/types"

/**
 * Legacy pre-Bot-API-7.2 alias for {@link Update.chat_join_request}.
 *
 * @remarks
 * Bot API 7.2 renamed `join_request` to `chat_join_request` and grammY dropped
 * the old field from `Update`. Read defensively so a webhook body still
 * carrying the legacy name is gated by its requester instead of falling through
 * to the private `update_id` slot.
 *
 * @internal
 */
type ILegacyUpdate = Update & {join_request?: {from?: {id?: number}}}

/**
 * Resolve the concurrency-gate key for an update.
 *
 * @remarks
 * Layered, narrowest-resource-first. The gate exists because session writes are
 * last-write-wins with no compare-and-swap, so two updates touching the same
 * logical resource must never run at once.
 *
 * 1. `chat.id` — all traffic for one chat serializes regardless of sender.
 * 2. `from.id` — chat-less user-originated updates (`inline_query`,
 *    `chosen_inline_result`, `poll_answer`, `join_request`, `my_chat_member`,
 *    `chat_member`, `chat_join_request`, and `callback_query` without a message).
 *    For an anonymous poll voter `poll_answer.voter_chat.id` stands in.
 * 3. `update_id` — globally unique, so each such update gets a private slot.
 *    This degrades to "no serialization" rather than over-serializing unrelated
 *    updates against each other.
 *
 * Note: `poll` carries no actor — Bot API 7.0 removed `Poll.user`, so a poll
 * change reaches this function's step 3 and gets a private slot.
 *
 * Returns `undefined` only when the update carries no `update_id`, in which case
 * the caller must not gate it.
 *
 * @public
 */
export function resolveGateKey(update: Update): string | undefined {
  const chatId =
    update.message?.chat?.id ??
    update.edited_message?.chat?.id ??
    update.channel_post?.chat?.id ??
    update.edited_channel_post?.chat?.id ??
    update.business_message?.chat?.id ??
    update.edited_business_message?.chat?.id ??
    update.guest_message?.chat?.id ??
    update.callback_query?.message?.chat?.id
  if (chatId !== undefined && chatId !== null) {
    return `c:${chatId}`
  }

  const fromId =
    update.callback_query?.from?.id ??
    update.inline_query?.from?.id ??
    update.chosen_inline_result?.from?.id ??
    update.poll_answer?.user?.id ??
    update.poll_answer?.voter_chat?.id ??
    update.my_chat_member?.from?.id ??
    update.chat_member?.from?.id ??
    update.chat_join_request?.from?.id ??
    (update as ILegacyUpdate).join_request?.from?.id
  if (fromId !== undefined && fromId !== null) {
    return `u:${fromId}`
  }

  return typeof update.update_id === `number` ? `u:${update.update_id}` : undefined
}