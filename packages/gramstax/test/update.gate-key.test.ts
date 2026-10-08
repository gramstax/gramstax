import {describe, expect, it} from "bun:test"
import {resolveGateKey} from "../src/update/gate-key"

const msg = (chatId: number, fromId = 1) => ({update_id: 1, message: {chat: {id: chatId}, from: {id: fromId}}})

describe("resolveGateKey", () => {
  it("prefers chat id so all traffic for one chat serializes", () => {
    expect(resolveGateKey(msg(-1001) as never)).toBe(`c:-1001`)
    expect(resolveGateKey(msg(-1001, 7) as never)).toBe(`c:-1001`)
    // different user, same chat -> same key (this is the point)
    expect(resolveGateKey(msg(-1001, 7) as never)).toBe(resolveGateKey(msg(-1001, 8) as never))
  })

  it("covers every chat-bearing update type", () => {
    expect(resolveGateKey({update_id: 1, edited_message: {chat: {id: -2}}} as never)).toBe(`c:-2`)
    expect(resolveGateKey({update_id: 1, channel_post: {chat: {id: -3}}} as never)).toBe(`c:-3`)
    expect(resolveGateKey({update_id: 1, edited_channel_post: {chat: {id: -4}}} as never)).toBe(`c:-4`)
    expect(resolveGateKey({update_id: 1, callback_query: {message: {chat: {id: -5}} as never} as never} as never)).toBe(`c:-5`)
    expect(resolveGateKey({update_id: 1, business_message: {chat: {id: -6}}} as never)).toBe(`c:-6`)
    expect(resolveGateKey({update_id: 1, edited_business_message: {chat: {id: -7}}} as never)).toBe(`c:-7`)
    expect(resolveGateKey({update_id: 1, guest_message: {chat: {id: -8}}} as never)).toBe(`c:-8`)
  })

  it("falls back to from.id for chat-less user updates", () => {
    expect(resolveGateKey({update_id: 1, inline_query: {from: {id: 42}} as never} as never)).toBe(`u:42`)
    expect(resolveGateKey({update_id: 1, chosen_inline_result: {from: {id: 43}} as never} as never)).toBe(`u:43`)
    expect(resolveGateKey({update_id: 1, poll_answer: {user: {id: 44}} as never} as never)).toBe(`u:44`)
    expect(resolveGateKey({update_id: 1, join_request: {from: {id: 45}} as never} as never)).toBe(`u:45`)
    expect(resolveGateKey({update_id: 1, chat_member: {from: {id: 46}} as never} as never)).toBe(`u:46`)
    expect(resolveGateKey({update_id: 1, chat_join_request: {from: {id: 47}} as never} as never)).toBe(`u:47`)
    expect(resolveGateKey({update_id: 1, my_chat_member: {from: {id: 48}} as never} as never)).toBe(`u:48`)
  })

  it("uses voter_chat.id for an anonymous poll voter", () => {
    expect(resolveGateKey({update_id: 1, poll_answer: {voter_chat: {id: 51}} as never} as never)).toBe(`u:51`)
  })

  it("gives a poll its own slot — Bot API 7.0 removed Poll.user", () => {
    expect(resolveGateKey({update_id: 52, poll: {id: `p`, total_voter_count: 1}} as never)).toBe(`u:52`)
  })

  it("uses callback_query.from when there is no message", () => {
    expect(resolveGateKey({update_id: 1, callback_query: {from: {id: 50}} as never} as never)).toBe(`u:50`)
  })

  it("gives every remaining update its own slot instead of over-serializing", () => {
    expect(resolveGateKey({update_id: 77} as never)).toBe(`u:77`)
    expect(resolveGateKey({update_id: 78} as never)).toBe(`u:78`)
    expect(resolveGateKey({} as never)).toBeUndefined()
  })

  it("never collides a chat id with a user id of the same number", () => {
    expect(resolveGateKey(msg(-1001) as never)).not.toBe(resolveGateKey({update_id: 9, inline_query: {from: {id: -1001}} as never} as never))
  })
})