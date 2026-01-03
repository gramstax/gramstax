import type {Keyboard, Context, InlineKeyboard} from "grammy"

export type IInlineKb = InlineKeyboard
export type IBottomKb = Keyboard
export type IKb = IBottomKb | IInlineKb
export type ICt = Context
export type IOptReply = Parameters<Context[`reply`]>[1]
export type IOptReplyPhoto = Parameters<Context[`replyWithPhoto`]>[1]
export type IOptReplyVideo = Parameters<Context[`replyWithVideo`]>[1]
export type IOptReplyAudio = Parameters<Context[`replyWithAudio`]>[1]
export type IOptReplyDocument = Parameters<Context[`replyWithDocument`]>[1]
export type IOptReplyAnimation = Parameters<Context[`replyWithAnimation`]>[1]
export type IOptReplyVoice = Parameters<Context[`replyWithVoice`]>[1]
export type IOptReplyVideoNote = Parameters<Context[`replyWithVideoNote`]>[1]
export type IOptReplySticker = Parameters<Context[`replyWithSticker`]>[1]
export type IOptReplyLocation = Parameters<Context[`replyWithLocation`]>[2]
export type IOptReplyContact = Parameters<Context[`replyWithContact`]>[2]
export type IOptEdit = Parameters<Context[`editMessageText`]>[1]
export type IOptEditMedia1 = Parameters<Context[`editMessageMedia`]>[0]
export type IOptEditMedia2 = Parameters<Context[`editMessageMedia`]>[1]

export type ITypeReplyAction = Parameters<Context[`replyWithChatAction`]>[0]
export type IData = Record<string, any>
