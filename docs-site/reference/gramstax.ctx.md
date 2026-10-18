---
title: "Ctx"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md)

## Ctx class

The context/page base class that provides access to user data, session management, template rendering, and reply methods.

**Signature:**

```typescript
declare class Ctx extends Context 
```
**Extends:** Context

## Remarks

Extend this class to create page handlers. Define static `template` property for HTML-like templates and static `data` via `Ctx.buildData` for routing configuration.

## Example 1

Basic Without PageBase

```typescript
import {Ctx} from "gramstax" // not recommended, use PageBase with extends Ctx instead
import {Menu1Page} from "./menu1"
import {Menu2Page} from "./menu2"

class StartPage extends Ctx {
  async handleCallbackQueryData() {
    const kb = this.inlineKeyboardT([Menu1Page, Menu2Page])
    await this.renderText({keyboard: kb})
  }

  static template = `
    <g-base>
      <g-keyboard>Button 1, Button 2</g-keyboard>
      <g-message>Hello {{name}}!</g-message>
    </g-base>
  `
}
```

## Example 2

Multi Base Id

```typescript
import {Ctx} from "gramstax"
import {Menu1Page} from "./menu1"
import {Menu2Page} from "./menu2"

class StartPage extends Ctx {
  async handleCallbackQueryData() {
    const kb = this.inlineKeyboardT([Menu1Page, Menu2Page], "2", "special-kb")
    await this.renderText()
  }

  static template = `
    <g-base id="special-kb">
      <g-keyboard>Button 1, Button 2</g-keyboard>
    </g-base>
    <g-base>
      <g-message>Hello {{name}}!</g-message>
    </g-base>
  `
}
```

## Constructors

<table><thead><tr><th>

Constructor


</th><th>

Modifiers


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[(constructor)(params)](./gramstax.ctx._constructor_.md)


</td><td>


</td><td>

Creates a new Ctx instance.

\*\*note:\*\* For most pages do not define a constructor


</td></tr>
</tbody></table>

## Properties

<table><thead><tr><th>

Property


</th><th>

Modifiers


</th><th>

Type


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[ANSWER\_API\_METHODS](./gramstax.ctx.answer_api_methods.md)


</td><td>

`static`

`readonly`


</td><td>

Set&lt;string&gt;


</td><td>

Set of API methods whose responses are marked as "answered" (`temp.isAnswer = true`).


</td></tr>
<tr><td>

[businessConnection](./gramstax.ctx.businessconnection.md)


</td><td>

`readonly`


</td><td>

NonNullable&lt;Context\[\`businessConnection\`\]&gt;


</td><td>

The full [Ctx.businessConnection](./gramstax.ctx.businessconnection.md) object from Telegram (non-nullable).

Alias for `ctx.update.business_connection`.


</td></tr>
<tr><td>

[businessMessage](./gramstax.ctx.businessmessage.md)


</td><td>

`readonly`


</td><td>

NonNullable&lt;Context\[\`businessMessage\`\]&gt;


</td><td>

The full [Ctx.businessMessage](./gramstax.ctx.businessmessage.md) object from Telegram (non-nullable).

Alias for `ctx.update.business_message`.


</td></tr>
<tr><td>

[cacheKeyboard](./gramstax.ctx.cachekeyboard.md)


</td><td>


</td><td>

Map&lt;string, unknown&gt;


</td><td>

Cache for keyboard instances.


</td></tr>
<tr><td>

[cacheSession](./gramstax.ctx.cachesession.md)


</td><td>


</td><td>

[CacheExternal](./gramstax.cacheexternal.md)&lt;[ICacheRpc](./gramstax.icacherpc.md)&gt;


</td><td>

External cache for session storage.


</td></tr>
<tr><td>

[callbackQuery](./gramstax.ctx.callbackquery.md)


</td><td>

`readonly`


</td><td>

NonNullable&lt;Context\[\`callbackQuery\`\]&gt;


</td><td>

The full [Ctx.callbackQuery](./gramstax.ctx.callbackquery.md) object from Telegram (non-nullable).

Alias for `ctx.update.callback_query`.


</td></tr>
<tr><td>

[callbackQueryDataArg](./gramstax.ctx.callbackquerydataarg.md)


</td><td>

`readonly`


</td><td>

string


</td><td>

The first arg token parsed from callback data.


</td></tr>
<tr><td>

[callbackQueryDataArgs](./gramstax.ctx.callbackquerydataargs.md)


</td><td>

`readonly`


</td><td>

string\[\]


</td><td>

All arg tokens parsed from callback data.


</td></tr>
<tr><td>

[channelPost](./gramstax.ctx.channelpost.md)


</td><td>

`readonly`


</td><td>

NonNullable&lt;Context\[\`channelPost\`\]&gt;


</td><td>

The full [Ctx.channelPost](./gramstax.ctx.channelpost.md) object from Telegram (non-nullable).

Alias for `ctx.update.channel_post`.


</td></tr>
<tr><td>

[chat](./gramstax.ctx.chat.md)


</td><td>

`readonly`


</td><td>

NonNullable&lt;Context\[\`chat\`\]&gt;


</td><td>

The full [Ctx.chat](./gramstax.ctx.chat.md) object from Telegram (non-nullable).


</td></tr>
<tr><td>

[chatBoost](./gramstax.ctx.chatboost.md)


</td><td>

`readonly`


</td><td>

NonNullable&lt;Context\[\`chatBoost\`\]&gt;


</td><td>

The full [Ctx.chatBoost](./gramstax.ctx.chatboost.md) object from Telegram (non-nullable).

Alias for `ctx.update.chat_boost`.


</td></tr>
<tr><td>

[chatJoinRequest](./gramstax.ctx.chatjoinrequest.md)


</td><td>

`readonly`


</td><td>

NonNullable&lt;Context\[\`chatJoinRequest\`\]&gt;


</td><td>

The full [Ctx.chatJoinRequest](./gramstax.ctx.chatjoinrequest.md) object from Telegram (non-nullable).

Alias for `ctx.update.chat_join_request`.


</td></tr>
<tr><td>

[chatMember](./gramstax.ctx.chatmember.md)


</td><td>

`readonly`


</td><td>

NonNullable&lt;Context\[\`chatMember\`\]&gt;


</td><td>

The full [Ctx.chatMember](./gramstax.ctx.chatmember.md) object from Telegram (non-nullable).

Alias for `ctx.update.chat_member`.


</td></tr>
<tr><td>

[chosenInlineResult](./gramstax.ctx.choseninlineresult.md)


</td><td>

`readonly`


</td><td>

NonNullable&lt;Context\[\`chosenInlineResult\`\]&gt;


</td><td>

The full [Ctx.chosenInlineResult](./gramstax.ctx.choseninlineresult.md) object from Telegram (non-nullable).

Alias for `ctx.update.chosen_inline_result`.


</td></tr>
<tr><td>

[data](./gramstax.ctx.data.md)


</td><td>

`readonly`


</td><td>

[IPageData](./gramstax.ipagedata.md)


</td><td>

Instance-level access to the page routing data.


</td></tr>
<tr><td>

[data?](./gramstax.ctx.data.md)


</td><td>

`static`


</td><td>

[IPageDataBase](./gramstax.ipagedatabase.md)


</td><td>

_(Optional)_ /\*\* Page routing data created by `Ctx.buildData`.


</td></tr>
<tr><td>

[deletedBusinessMessages](./gramstax.ctx.deletedbusinessmessages.md)


</td><td>

`readonly`


</td><td>

NonNullable&lt;Context\[\`deletedBusinessMessages\`\]&gt;


</td><td>

The full [Ctx.deletedBusinessMessages](./gramstax.ctx.deletedbusinessmessages.md) object from Telegram (non-nullable).

Alias for `ctx.update.deleted_business_messages`.


</td></tr>
<tr><td>

[DICE\_EMOJI](./gramstax.ctx.dice_emoji.md)


</td><td>

`static`

`readonly`


</td><td>

ReadonlySet&lt;string&gt;


</td><td>

Bot API dice emoji values accepted by `sendDice`.


</td></tr>
<tr><td>

[editedBusinessMessage](./gramstax.ctx.editedbusinessmessage.md)


</td><td>

`readonly`


</td><td>

NonNullable&lt;Context\[\`editedBusinessMessage\`\]&gt;


</td><td>

The full [Ctx.editedBusinessMessage](./gramstax.ctx.editedbusinessmessage.md) object from Telegram (non-nullable).

Alias for `ctx.update.edited_business_message`.


</td></tr>
<tr><td>

[editedChannelPost](./gramstax.ctx.editedchannelpost.md)


</td><td>

`readonly`


</td><td>

NonNullable&lt;Context\[\`editedChannelPost\`\]&gt;


</td><td>

The full [Ctx.editedChannelPost](./gramstax.ctx.editedchannelpost.md) object from Telegram (non-nullable).

Alias for `ctx.update.edited_channel_post`.


</td></tr>
<tr><td>

[editedMessage](./gramstax.ctx.editedmessage.md)


</td><td>

`readonly`


</td><td>

NonNullable&lt;Context\[\`editedMessage\`\]&gt;


</td><td>

The full [Ctx.editedMessage](./gramstax.ctx.editedmessage.md) object from Telegram (non-nullable).

Alias for `ctx.update.edited_message`.


</td></tr>
<tr><td>

[FALLBACK\_TEXT](./gramstax.ctx.fallback_text.md)


</td><td>

`static`

`readonly`


</td><td>

(not declared)


</td><td>

Framework default fallback text sent when a media send fails with a `fallback-text` error and no per-page `fallbackText` override is set.


</td></tr>
<tr><td>

[fallbackText?](./gramstax.ctx.fallbacktext.md)


</td><td>


</td><td>

string \| null


</td><td>

_(Optional)_ Per-page fallback text override for media-send failures.


</td></tr>
<tr><td>

[from](./gramstax.ctx.from.md)


</td><td>

`readonly`


</td><td>

NonNullable&lt;Context\[\`from\`\]&gt;


</td><td>

The full [Ctx.from](./gramstax.ctx.from.md) object from Telegram (non-nullable).


</td></tr>
<tr><td>

[fromFullName](./gramstax.ctx.fromfullname.md)


</td><td>

`readonly`


</td><td>

string


</td><td>

The combined first and last name from the user's Telegram profile.


</td></tr>
<tr><td>

[guestMessage](./gramstax.ctx.guestmessage.md)


</td><td>

`readonly`


</td><td>

NonNullable&lt;Context\[\`guestMessage\`\]&gt;


</td><td>

The full [Ctx.guestMessage](./gramstax.ctx.guestmessage.md) object from Telegram (non-nullable).

Alias for `ctx.update.guest_message`.


</td></tr>
<tr><td>

[inlineQuery](./gramstax.ctx.inlinequery.md)


</td><td>

`readonly`


</td><td>

NonNullable&lt;Context\[\`inlineQuery\`\]&gt;


</td><td>

The full [Ctx.inlineQuery](./gramstax.ctx.inlinequery.md) object from Telegram (non-nullable).

Alias for `ctx.update.inline_query`.


</td></tr>
<tr><td>

[INVOICE\_DESCRIPTION\_LIMIT](./gramstax.ctx.invoice_description_limit.md)


</td><td>

`static`

`readonly`


</td><td>

(not declared)


</td><td>

Bot API invoice description limit in characters (`sendInvoice` description 1–255).


</td></tr>
<tr><td>

[INVOICE\_PAYLOAD\_LIMIT](./gramstax.ctx.invoice_payload_limit.md)


</td><td>

`static`

`readonly`


</td><td>

(not declared)


</td><td>

Bot API invoice payload limit in bytes (`sendInvoice` payload 1–128 bytes).


</td></tr>
<tr><td>

[INVOICE\_PRICES\_MIN](./gramstax.ctx.invoice_prices_min.md)


</td><td>

`static`

`readonly`


</td><td>

(not declared)


</td><td>

Minimum `<g-price>` line items per invoice (Bot API requires 1 or more).


</td></tr>
<tr><td>

[INVOICE\_TITLE\_LIMIT](./gramstax.ctx.invoice_title_limit.md)


</td><td>

`static`

`readonly`


</td><td>

(not declared)


</td><td>

Bot API invoice title limit in characters (`sendInvoice` title 1–32).


</td></tr>
<tr><td>

[log](./gramstax.ctx.log.md)


</td><td>


</td><td>

[LoggingHelper](./gramstax.logginghelper.md) \| null \| undefined


</td><td>

Logger instance from Gramstax, for runtime warnings.


</td></tr>
<tr><td>

[managedBot](./gramstax.ctx.managedbot.md)


</td><td>

`readonly`


</td><td>

NonNullable&lt;Context\[\`managedBot\`\]&gt;


</td><td>

The full [Ctx.managedBot](./gramstax.ctx.managedbot.md) object from Telegram (non-nullable).

Alias for `ctx.update.managed_bot`.


</td></tr>
<tr><td>

[MEDIA\_CAPTION\_LIMIT](./gramstax.ctx.media_caption_limit.md)


</td><td>

`static`

`readonly`


</td><td>

(not declared)


</td><td>

Bot API caption limit in characters (caption-carrying types + media groups).


</td></tr>
<tr><td>

[MEDIA\_CAPTION\_TYPES](./gramstax.ctx.media_caption_types.md)


</td><td>

`static`

`readonly`


</td><td>

ReadonlySet&lt;string&gt;


</td><td>

Media types that carry a caption (caption length is enforced for these).


</td></tr>
<tr><td>

[MEDIA\_GROUP\_LIMIT](./gramstax.ctx.media_group_limit.md)


</td><td>

`static`

`readonly`


</td><td>

(not declared)


</td><td>

Bot API media-group limit in items (also applies to pipe-delimited `srcList`).


</td></tr>
<tr><td>

[MEDIA\_TYPES](./gramstax.ctx.media_types.md)


</td><td>

`static`

`readonly`


</td><td>

ReadonlySet&lt;string&gt;


</td><td>

All sendable single-media types (`ITMediaBlock` minus `group`).


</td></tr>
<tr><td>

[MEDIA\_UPLOAD\_LIMITS](./gramstax.ctx.media_upload_limits.md)


</td><td>

`static`

`readonly`


</td><td>

Record&lt;string, number&gt;


</td><td>

Bot API upload size limits in bytes, per media type.


</td></tr>
<tr><td>

[mediaRoots?](./gramstax.ctx.mediaroots.md)


</td><td>


</td><td>

string\[\] \| null


</td><td>

_(Optional)_ Opt-in local-path jail for media uploads (Q8 option b).


</td></tr>
<tr><td>

[message](./gramstax.ctx.message.md)


</td><td>

`readonly`


</td><td>

NonNullable&lt;Context\[\`message\`\]&gt;


</td><td>

The full [Ctx.message](./gramstax.ctx.message.md) object from Telegram (non-nullable).

Alias for `ctx.update.message`.


</td></tr>
<tr><td>

[messageReaction](./gramstax.ctx.messagereaction.md)


</td><td>

`readonly`


</td><td>

NonNullable&lt;Context\[\`messageReaction\`\]&gt;


</td><td>

The full [Ctx.messageReaction](./gramstax.ctx.messagereaction.md) object from Telegram (non-nullable).

Alias for `ctx.update.message_reaction`.


</td></tr>
<tr><td>

[msg](./gramstax.ctx.msg.md)


</td><td>

`readonly`


</td><td>

NonNullable&lt;Context\[\`msg\`\]&gt;


</td><td>

The full [Ctx.msg](./gramstax.ctx.msg.md) object from Telegram (non-nullable).

Shorthand for `this.message` with fallback across message-like update fields.


</td></tr>
<tr><td>

[msgCaptionArg](./gramstax.ctx.msgcaptionarg.md)


</td><td>

`readonly`


</td><td>

string


</td><td>

The first arg token from caption text.


</td></tr>
<tr><td>

[msgCaptionArgs](./gramstax.ctx.msgcaptionargs.md)


</td><td>

`readonly`


</td><td>

string\[\]


</td><td>

All arg tokens parsed from caption text.


</td></tr>
<tr><td>

[msgCommandCaptionArg](./gramstax.ctx.msgcommandcaptionarg.md)


</td><td>

`readonly`


</td><td>

string


</td><td>

The first arg token from a caption command.


</td></tr>
<tr><td>

[msgCommandCaptionArgs](./gramstax.ctx.msgcommandcaptionargs.md)


</td><td>

`readonly`


</td><td>

string\[\]


</td><td>

All arg tokens from a caption command.


</td></tr>
<tr><td>

[msgTextArg](./gramstax.ctx.msgtextarg.md)


</td><td>

`readonly`


</td><td>

string


</td><td>

The first arg token parsed from message text.


</td></tr>
<tr><td>

[msgTextArgs](./gramstax.ctx.msgtextargs.md)


</td><td>

`readonly`


</td><td>

string\[\]


</td><td>

All arg tokens parsed from message text.


</td></tr>
<tr><td>

[msgTextCommandArg](./gramstax.ctx.msgtextcommandarg.md)


</td><td>

`readonly`


</td><td>

string


</td><td>

The first arg token from a command message.


</td></tr>
<tr><td>

[msgTextCommandArgs](./gramstax.ctx.msgtextcommandargs.md)


</td><td>

`readonly`


</td><td>

string\[\]


</td><td>

All arg tokens from a command message.


</td></tr>
<tr><td>

[onSendError?](./gramstax.ctx.onsenderror.md)


</td><td>


</td><td>

[ISendErrorHook](./gramstax.isenderrorhook.md) \| null


</td><td>

_(Optional)_ Best-effort send-error hook (Q9 option b).


</td></tr>
<tr><td>

[PAID\_MEDIA\_ITEMS\_MAX](./gramstax.ctx.paid_media_items_max.md)


</td><td>

`static`

`readonly`


</td><td>

(not declared)


</td><td>

Maximum `<g-media>` items per paid-media paywall (Bot API `sendPaidMedia` media limit).


</td></tr>
<tr><td>

[PAID\_MEDIA\_ITEMS\_MIN](./gramstax.ctx.paid_media_items_min.md)


</td><td>

`static`

`readonly`


</td><td>

(not declared)


</td><td>

Minimum `<g-media>` items per paid-media paywall (Bot API requires 1 or more).


</td></tr>
<tr><td>

[PAID\_MEDIA\_STARS\_MAX](./gramstax.ctx.paid_media_stars_max.md)


</td><td>

`static`

`readonly`


</td><td>

(not declared)


</td><td>

Maximum Stars price for a `<g-paid-media>` paywall.


</td></tr>
<tr><td>

[PAID\_MEDIA\_STARS\_MIN](./gramstax.ctx.paid_media_stars_min.md)


</td><td>

`static`

`readonly`


</td><td>

(not declared)


</td><td>

Minimum Stars price for a `<g-paid-media>` paywall.


</td></tr>
<tr><td>

[POLL\_EXPLANATION\_LIMIT](./gramstax.ctx.poll_explanation_limit.md)


</td><td>

`static`

`readonly`


</td><td>

(not declared)


</td><td>

Bot API quiz explanation limit in characters.


</td></tr>
<tr><td>

[POLL\_OPTION\_LIMIT](./gramstax.ctx.poll_option_limit.md)


</td><td>

`static`

`readonly`


</td><td>

(not declared)


</td><td>

Bot API poll option limit in characters (per option).


</td></tr>
<tr><td>

[POLL\_OPTIONS\_MAX](./gramstax.ctx.poll_options_max.md)


</td><td>

`static`

`readonly`


</td><td>

(not declared)


</td><td>

Bot API poll option count bounds (2–10 options).


</td></tr>
<tr><td>

[POLL\_OPTIONS\_MIN](./gramstax.ctx.poll_options_min.md)


</td><td>

`static`

`readonly`


</td><td>

(not declared)


</td><td>

Bot API poll option count bounds (2–10 options).


</td></tr>
<tr><td>

[POLL\_QUESTION\_LIMIT](./gramstax.ctx.poll_question_limit.md)


</td><td>

`static`

`readonly`


</td><td>

(not declared)


</td><td>

Bot API poll question limit in characters.


</td></tr>
<tr><td>

[poll](./gramstax.ctx.poll.md)


</td><td>

`readonly`


</td><td>

NonNullable&lt;Context\[\`poll\`\]&gt;


</td><td>

The full [Ctx.poll](./gramstax.ctx.poll.md) object from Telegram (non-nullable).

Alias for `ctx.update.poll`.


</td></tr>
<tr><td>

[pollAnswer](./gramstax.ctx.pollanswer.md)


</td><td>

`readonly`


</td><td>

NonNullable&lt;Context\[\`pollAnswer\`\]&gt;


</td><td>

The full [Ctx.pollAnswer](./gramstax.ctx.pollanswer.md) object from Telegram (non-nullable).

Alias for `ctx.update.poll_answer`.


</td></tr>
<tr><td>

[preCheckoutQuery](./gramstax.ctx.precheckoutquery.md)


</td><td>

`readonly`


</td><td>

NonNullable&lt;Context\[\`preCheckoutQuery\`\]&gt;


</td><td>

The full [Ctx.preCheckoutQuery](./gramstax.ctx.precheckoutquery.md) object from Telegram (non-nullable).

Alias for `ctx.update.pre_checkout_query`.


</td></tr>
<tr><td>

[purchasedPaidMedia](./gramstax.ctx.purchasedpaidmedia.md)


</td><td>

`readonly`


</td><td>

NonNullable&lt;Context\[\`purchasedPaidMedia\`\]&gt;


</td><td>

The full [Ctx.purchasedPaidMedia](./gramstax.ctx.purchasedpaidmedia.md) object from Telegram (non-nullable).

Alias for `ctx.update.purchased_paid_media`.


</td></tr>
<tr><td>

[removedChatBoost](./gramstax.ctx.removedchatboost.md)


</td><td>

`readonly`


</td><td>

NonNullable&lt;Context\[\`removedChatBoost\`\]&gt;


</td><td>

The full [Ctx.removedChatBoost](./gramstax.ctx.removedchatboost.md) object from Telegram (non-nullable).

Alias for `ctx.update.removed_chat_boost`.


</td></tr>
<tr><td>

[senderChat](./gramstax.ctx.senderchat.md)


</td><td>

`readonly`


</td><td>

NonNullable&lt;Context\[\`senderChat\`\]&gt;


</td><td>

The full [Ctx.senderChat](./gramstax.ctx.senderchat.md) object from Telegram (non-nullable).


</td></tr>
<tr><td>

[STORY\_PERIODS](./gramstax.ctx.story_periods.md)


</td><td>

`static`

`readonly`


</td><td>

ReadonlySet&lt;number&gt;


</td><td>

Story `active_period` values accepted by `postBusinessStory` (seconds).


</td></tr>
<tr><td>

[temp](./gramstax.ctx.temp.md)


</td><td>


</td><td>

[ITemp](./gramstax.itemp.md)


</td><td>

Temporary state storage for the current request.


</td></tr>
<tr><td>

[template?](./gramstax.ctx.template.md)


</td><td>

`static`


</td><td>

string


</td><td>

_(Optional)_ HTML-like template string for the page.


</td></tr>
<tr><td>

[templateManager](./gramstax.ctx.templatemanager.md)


</td><td>


</td><td>

[TemplateManager](./gramstax.templatemanager.md)


</td><td>

Template manager for message rendering.


</td></tr>
</tbody></table>

## Methods

<table><thead><tr><th>

Method


</th><th>

Modifiers


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[addArgs(str, mtd, pld)](./gramstax.ctx.addargs.md)


</td><td>


</td><td>

Appends arg values to a string using the specified separator.


</td></tr>
<tr><td>

[answerPreCheckout(ok, errorMessage)](./gramstax.ctx.answerprecheckout.md)


</td><td>


</td><td>

Answers the current pre-checkout query, approving or rejecting payment.


</td></tr>
<tr><td>

[assertContact(phone, firstName)](./gramstax.ctx.assertcontact.md)


</td><td>

`static`


</td><td>

Require non-empty `phone` + `first_name` for contacts (replaces non-null assertions).


</td></tr>
<tr><td>

[assertDiceEmoji(emoji)](./gramstax.ctx.assertdiceemoji.md)


</td><td>

`static`


</td><td>

Fail-fast checks for a `renderDice` emoji against the Bot API set.


</td></tr>
<tr><td>

[assertInvoice(invoice)](./gramstax.ctx.assertinvoice.md)


</td><td>

`static`


</td><td>

Fail-fast checks for a compiled `<g-invoice>` block against Bot API limits.


</td></tr>
<tr><td>

[assertLivePeriod(live)](./gramstax.ctx.assertliveperiod.md)


</td><td>

`static`


</td><td>

Parse and check a `<g-media type="location">` `live` period (seconds → `live_period`).


</td></tr>
<tr><td>

[assertLocation(latitude, longitude)](./gramstax.ctx.assertlocation.md)


</td><td>

`static`


</td><td>

Parse and range-check `latitude`/`longitude` (replaces bare `parseInt`).


</td></tr>
<tr><td>

[assertMediaCaption(type, caption)](./gramstax.ctx.assertmediacaption.md)


</td><td>

`static`


</td><td>

Throw when `caption` exceeds `MEDIA_CAPTION_LIMIT` for caption-carrying types.


</td></tr>
<tr><td>

[assertMediaGroupItems(items)](./gramstax.ctx.assertmediagroupitems.md)


</td><td>

`static`


</td><td>

Fail-fast checks for a `<g-media-group>` item list: group size limit, per-item group type, upload size, and caption length.


</td></tr>
<tr><td>

[assertMediaPreconditions(type, med)](./gramstax.ctx.assertmediapreconditions.md)


</td><td>

`static`


</td><td>

Fail-fast pre-send checks for one single-media payload (programmer errors always throw, never fall back): unknown type, upload size, voice caption, caption length.


</td></tr>
<tr><td>

[assertMediaSize(type, bytes)](./gramstax.ctx.assertmediasize.md)


</td><td>

`static`


</td><td>

Throw when `bytes` exceeds the `MEDIA_UPLOAD_LIMITS` entry for `type`.


</td></tr>
<tr><td>

[assertMediaSrcList(type, srcList)](./gramstax.ctx.assertmediasrclist.md)


</td><td>

`static`


</td><td>

Fail-fast checks for a pipe-delimited `srcList`: group size limit + upload size.


</td></tr>
<tr><td>

[assertMediaSrcSize(type, src)](./gramstax.ctx.assertmediasrcsize.md)


</td><td>

`static`


</td><td>

Size-check a media `src` when its bytes are knowable, else skip.


</td></tr>
<tr><td>

[assertPaidMedia(paidMedia)](./gramstax.ctx.assertpaidmedia.md)


</td><td>

`static`


</td><td>

Fail-fast validation for a compiled `<g-paid-media>` paywall.


</td></tr>
<tr><td>

[assertPoll(poll)](./gramstax.ctx.assertpoll.md)


</td><td>

`static`


</td><td>

Fail-fast checks for a compiled `<g-poll>` block against Bot API limits.


</td></tr>
<tr><td>

[assertVenue(venue)](./gramstax.ctx.assertvenue.md)


</td><td>

`static`


</td><td>

Venue fields accepted by [Ctx.renderVenue()](./gramstax.ctx.rendervenue.md) from the compiled `<g-venue>` block.


</td></tr>
<tr><td>

[bottomKeyboard(callback, params)](./gramstax.ctx.bottomkeyboard.md)


</td><td>


</td><td>

Creates a bottom (reply) keyboard using a builder callback.


</td></tr>
<tr><td>

[bottomKeyboardT(layout, AGBaseId, data)](./gramstax.ctx.bottomkeyboardt.md)


</td><td>


</td><td>

Creates a bottom keyboard with template-based text buttons.


</td></tr>
<tr><td>

[bottomKeyboardT(PageDest, layout, AGBaseId, data)](./gramstax.ctx.bottomkeyboardt_1.md)


</td><td>


</td><td>


</td></tr>
<tr><td>

[buildData(callbackQueryData)](./gramstax.ctx.builddata.md)


</td><td>

`static`


</td><td>

Creates page routing data configuration with a callback function.


</td></tr>
<tr><td>

[buildData(options)](./gramstax.ctx.builddata_1.md)


</td><td>

`static`


</td><td>

Creates page routing data configuration with options.


</td></tr>
<tr><td>

[buildData(options)](./gramstax.ctx.builddata_2.md)


</td><td>

`static`


</td><td>

Creates page routing data configuration without a callback arg.


</td></tr>
<tr><td>

[buildData()](./gramstax.ctx.builddata_3.md)


</td><td>

`static`


</td><td>

Creates default page routing data configuration.


</td></tr>
<tr><td>

[classifySendError(err)](./gramstax.ctx.classifysenderror.md)


</td><td>

`static`


</td><td>

Classify a send failure as `fallback-text` (content rejected, reply with fallback text) or `retryable` (rate limit, server, network, or unknown — rethrow the original error untouched, fail-loud default).


</td></tr>
<tr><td>

[clearSession()](./gramstax.ctx.clearsession.md)


</td><td>


</td><td>

Clears session data for the current user.


</td></tr>
<tr><td>

[cloneMediaInput(value, \_roots)](./gramstax.ctx.clonemediainput.md)


</td><td>

`static`


</td><td>

Clone a resolved media input so parallel broadcast sends never share one mutable instance.


</td></tr>
<tr><td>

[deleteBusinessStory(businessConnectionId, storyId)](./gramstax.ctx.deletebusinessstory.md)


</td><td>


</td><td>

Deletes a story previously posted on behalf of a managed business account.


</td></tr>
<tr><td>

[download(path)](./gramstax.ctx.download.md)


</td><td>


</td><td>

Downloads the file attached to the current message.


</td></tr>
<tr><td>

[editBusinessStory(businessConnectionId, storyId, content, options)](./gramstax.ctx.editbusinessstory.md)


</td><td>


</td><td>

Edits a story previously posted on behalf of a managed business account.


</td></tr>
<tr><td>

[ephemeralParams(receiverUserId, callbackQueryId, replace)](./gramstax.ctx.ephemeralparams.md)


</td><td>


</td><td>

Instance version of the static `ephemeralParams` method.


</td></tr>
<tr><td>

[ephemeralParams(receiverUserId, callbackQueryId, replace)](./gramstax.ctx.ephemeralparams.md)


</td><td>

`static`


</td><td>

Build `EphemeralMessageParameters` for Bot API 10.3 ephemeral messages.


</td></tr>
<tr><td>

[getArgs(str, mtd, positionStart)](./gramstax.ctx.getargs.md)


</td><td>


</td><td>

Extracts arg values from a string.


</td></tr>
<tr><td>

[getIntent(str, mtd, positionEnd)](./gramstax.ctx.getintent.md)


</td><td>


</td><td>

Extracts the intent portion from a string containing args.


</td></tr>
<tr><td>

[getSeperatorTag(mtd)](./gramstax.ctx.getseperatortag.md)


</td><td>


</td><td>

Gets the separator character for the specified method.


</td></tr>
<tr><td>

[getSession()](./gramstax.ctx.getsession.md)


</td><td>


</td><td>

Retrieves session data for the current user.


</td></tr>
<tr><td>

[getStarTransactions(options)](./gramstax.ctx.getstartransactions.md)


</td><td>


</td><td>

Lists Stars transactions for the bot (admin reconciliation).


</td></tr>
<tr><td>

[handleArgsCallbackQueryData()?](./gramstax.ctx.handleargscallbackquerydata.md)


</td><td>


</td><td>

_(Optional)_ Route handler for callback queries with args matching `intentCallbackQueryData`.


</td></tr>
<tr><td>

[handleArgsText()?](./gramstax.ctx.handleargstext.md)


</td><td>


</td><td>

_(Optional)_ Route handler for text messages with args match intent `intentText`.


</td></tr>
<tr><td>

[handleCallbackQueryData()?](./gramstax.ctx.handlecallbackquerydata.md)


</td><td>


</td><td>

_(Optional)_ Route handler for callback queries without args matching `intentCallbackQueryData`.


</td></tr>
<tr><td>

[handleCaptionAnimation()?](./gramstax.ctx.handlecaptionanimation.md)


</td><td>


</td><td>

_(Optional)_ Route function for animationCaption match intent `this.data.name`


</td></tr>
<tr><td>

[handleCaptionArgsAnimation()?](./gramstax.ctx.handlecaptionargsanimation.md)


</td><td>


</td><td>

_(Optional)_ Route function for `handleCaptionArgsAnimation` with arg match intent `this.data.name`


</td></tr>
<tr><td>

[handleCaptionArgsAudio()?](./gramstax.ctx.handlecaptionargsaudio.md)


</td><td>


</td><td>

_(Optional)_ Route function for `handleCaptionArgsAudio` with arg match intent `this.data.name`


</td></tr>
<tr><td>

[handleCaptionArgsDocument()?](./gramstax.ctx.handlecaptionargsdocument.md)


</td><td>


</td><td>

_(Optional)_ Route function for `handleCaptionArgsDocument` with arg match intent `this.data.name`


</td></tr>
<tr><td>

[handleCaptionArgsPhoto()?](./gramstax.ctx.handlecaptionargsphoto.md)


</td><td>


</td><td>

_(Optional)_ Route function for photoCaption with arg match intent `this.data.name`


</td></tr>
<tr><td>

[handleCaptionArgsVideo()?](./gramstax.ctx.handlecaptionargsvideo.md)


</td><td>


</td><td>

_(Optional)_ Route function for `handleCaptionArgsVideo` with arg match intent `this.data.name`


</td></tr>
<tr><td>

[handleCaptionArgsVoice()?](./gramstax.ctx.handlecaptionargsvoice.md)


</td><td>


</td><td>

_(Optional)_ Route function for `handleCaptionArgsVoice` with arg match intent `this.data.name`


</td></tr>
<tr><td>

[handleCaptionAudio()?](./gramstax.ctx.handlecaptionaudio.md)


</td><td>


</td><td>

_(Optional)_ Route function for audioCaption match intent `this.data.name`


</td></tr>
<tr><td>

[handleCaptionDocument()?](./gramstax.ctx.handlecaptiondocument.md)


</td><td>


</td><td>

_(Optional)_ Route function for `handleCaptionDocument` match intent `this.data.name`


</td></tr>
<tr><td>

[handleCaptionPhoto()?](./gramstax.ctx.handlecaptionphoto.md)


</td><td>


</td><td>

_(Optional)_ Route function for photoCaptio match intent `this.data.name`


</td></tr>
<tr><td>

[handleCaptionVideo()?](./gramstax.ctx.handlecaptionvideo.md)


</td><td>


</td><td>

_(Optional)_ Route function for videoCaption match intent `this.data.name`


</td></tr>
<tr><td>

[handleCaptionVoice()?](./gramstax.ctx.handlecaptionvoice.md)


</td><td>


</td><td>

_(Optional)_ Route function for voiceCaption match intent `this.data.name`


</td></tr>
<tr><td>

[handleChatMemberOutIn()?](./gramstax.ctx.handlechatmemberoutin.md)


</td><td>


</td><td>

_(Optional)_ User joins the chat (kicked/left → member/admin/creator).


</td></tr>
<tr><td>

[handleCommandArgsText()?](./gramstax.ctx.handlecommandargstext.md)


</td><td>


</td><td>

_(Optional)_ Route handler for command messages with args match intent `intentCommandText`.


</td></tr>
<tr><td>

[handleCommandCaptionAnimation()?](./gramstax.ctx.handlecommandcaptionanimation.md)


</td><td>


</td><td>

_(Optional)_ Route function for animationCaption with slash command match intent `this.data.name`


</td></tr>
<tr><td>

[handleCommandCaptionArgsAnimation()?](./gramstax.ctx.handlecommandcaptionargsanimation.md)


</td><td>


</td><td>

_(Optional)_ Route function for `handleCommandCaptionArgsAnimation` with slash command and arg match intent `this.data.name`


</td></tr>
<tr><td>

[handleCommandCaptionArgsAudio()?](./gramstax.ctx.handlecommandcaptionargsaudio.md)


</td><td>


</td><td>

_(Optional)_ Route function for `handleCommandCaptionArgsAudio` with slash command and arg match intent `this.data.name`


</td></tr>
<tr><td>

[handleCommandCaptionArgsDocument()?](./gramstax.ctx.handlecommandcaptionargsdocument.md)


</td><td>


</td><td>

_(Optional)_ Route function for `handleCommandCaptionArgsDocument` with slash command and arg match intent `this.data.name`


</td></tr>
<tr><td>

[handleCommandCaptionArgsPhoto()?](./gramstax.ctx.handlecommandcaptionargsphoto.md)


</td><td>


</td><td>

_(Optional)_ Route function for `handleCommandCaptionArgsPhoto` with slash command and arg match intent `this.data.name`


</td></tr>
<tr><td>

[handleCommandCaptionArgsVideo()?](./gramstax.ctx.handlecommandcaptionargsvideo.md)


</td><td>


</td><td>

_(Optional)_ Route function for `handleCommandCaptionArgsVideo` with slash command and arg match intent `this.data.name`


</td></tr>
<tr><td>

[handleCommandCaptionArgsVoice()?](./gramstax.ctx.handlecommandcaptionargsvoice.md)


</td><td>


</td><td>

_(Optional)_ Route function for `handleCommandCaptionArgsVoice` with slash command and arg match intent `this.data.name`


</td></tr>
<tr><td>

[handleCommandCaptionAudio()?](./gramstax.ctx.handlecommandcaptionaudio.md)


</td><td>


</td><td>

_(Optional)_ Route function for `handleCommandCaptionAudio` with slash command match intent `this.data.name`


</td></tr>
<tr><td>

[handleCommandCaptionDocument()?](./gramstax.ctx.handlecommandcaptiondocument.md)


</td><td>


</td><td>

_(Optional)_ Route function for `handleCommandCaptionDocument` with slash command match intent `this.data.name`


</td></tr>
<tr><td>

[handleCommandCaptionPhoto()?](./gramstax.ctx.handlecommandcaptionphoto.md)


</td><td>


</td><td>

_(Optional)_ Route function for photoCaption with slash command match intent `this.data.name`


</td></tr>
<tr><td>

[handleCommandCaptionVideo()?](./gramstax.ctx.handlecommandcaptionvideo.md)


</td><td>


</td><td>

_(Optional)_ Route function for videoCaption with slash command match intent `this.data.name`


</td></tr>
<tr><td>

[handleCommandCaptionVoice()?](./gramstax.ctx.handlecommandcaptionvoice.md)


</td><td>


</td><td>

_(Optional)_ Route function for voiceCaption with slash command match intent `this.data.name`


</td></tr>
<tr><td>

[handleCommandText()?](./gramstax.ctx.handlecommandtext.md)


</td><td>


</td><td>

_(Optional)_ Route handler for command messages match intent `intentCommandText`.


</td></tr>
<tr><td>

[handleFree()?](./gramstax.ctx.handlefree.md)


</td><td>


</td><td>

_(Optional)_ Fallback route handler for any unmatched update.


</td></tr>
<tr><td>

[handleFreeAnimation()?](./gramstax.ctx.handlefreeanimation.md)


</td><td>


</td><td>

_(Optional)_ Route handler for free-form animation input.


</td></tr>
<tr><td>

[handleFreeAudio()?](./gramstax.ctx.handlefreeaudio.md)


</td><td>


</td><td>

_(Optional)_ Route handler for free-form audio input.


</td></tr>
<tr><td>

[handleFreeContact()?](./gramstax.ctx.handlefreecontact.md)


</td><td>


</td><td>

_(Optional)_ Route handler for free-form contact input.


</td></tr>
<tr><td>

[handleFreeDocument()?](./gramstax.ctx.handlefreedocument.md)


</td><td>


</td><td>

_(Optional)_ Route handler for free-form document input.


</td></tr>
<tr><td>

[handleFreeLocation()?](./gramstax.ctx.handlefreelocation.md)


</td><td>


</td><td>

_(Optional)_ Route handler for free-form location input.


</td></tr>
<tr><td>

[handleFreePhoto()?](./gramstax.ctx.handlefreephoto.md)


</td><td>


</td><td>

_(Optional)_ Route handler for free-form photo input.


</td></tr>
<tr><td>

[handleFreeSticker()?](./gramstax.ctx.handlefreesticker.md)


</td><td>


</td><td>

_(Optional)_ Route handler for free-form sticker input.


</td></tr>
<tr><td>

[handleFreeText()?](./gramstax.ctx.handlefreetext.md)


</td><td>


</td><td>

_(Optional)_ Route handler for free-form text input.


</td></tr>
<tr><td>

[handleFreeVideo()?](./gramstax.ctx.handlefreevideo.md)


</td><td>


</td><td>

_(Optional)_ Route handler for free-form video input.


</td></tr>
<tr><td>

[handleFreeVideoNote()?](./gramstax.ctx.handlefreevideonote.md)


</td><td>


</td><td>

_(Optional)_ Route handler for free-form video note input.


</td></tr>
<tr><td>

[handleFreeVoice()?](./gramstax.ctx.handlefreevoice.md)


</td><td>


</td><td>

_(Optional)_ Route handler for free-form voice input.


</td></tr>
<tr><td>

[handleMyChatMemberAdminRegular()?](./gramstax.ctx.handlemychatmemberadminregular.md)


</td><td>


</td><td>

_(Optional)_ Bot is demoted from administrator.


</td></tr>
<tr><td>

[handleMyChatMemberOutAdmin()?](./gramstax.ctx.handlemychatmemberoutadmin.md)


</td><td>


</td><td>

_(Optional)_ Bot is added to the chat as an administrator.


</td></tr>
<tr><td>

[handleMyChatMemberOutRegular()?](./gramstax.ctx.handlemychatmemberoutregular.md)


</td><td>


</td><td>

_(Optional)_ Bot is added to the chat as a regular member.


</td></tr>
<tr><td>

[handleMyChatMemberRegularAdmin()?](./gramstax.ctx.handlemychatmemberregularadmin.md)


</td><td>


</td><td>

_(Optional)_ Bot is promoted to administrator.


</td></tr>
<tr><td>

[handleSessionArgsCallbackQueryData()?](./gramstax.ctx.handlesessionargscallbackquerydata.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionArgsCallbackQueryData` route handler declaration.


</td></tr>
<tr><td>

[handleSessionArgsText()?](./gramstax.ctx.handlesessionargstext.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionArgsText` route handler declaration.


</td></tr>
<tr><td>

[handleSessionCallbackQueryData()?](./gramstax.ctx.handlesessioncallbackquerydata.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionCallbackQueryData` route handler declaration.


</td></tr>
<tr><td>

[handleSessionCaptionAnimation()?](./gramstax.ctx.handlesessioncaptionanimation.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionCaptionAnimation` route handler declaration.


</td></tr>
<tr><td>

[handleSessionCaptionArgsAnimation()?](./gramstax.ctx.handlesessioncaptionargsanimation.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionCaptionArgsAnimation` route handler declaration.


</td></tr>
<tr><td>

[handleSessionCaptionArgsAudio()?](./gramstax.ctx.handlesessioncaptionargsaudio.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionCaptionArgsAudio` route handler declaration.


</td></tr>
<tr><td>

[handleSessionCaptionArgsDocument()?](./gramstax.ctx.handlesessioncaptionargsdocument.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionCaptionArgsDocument` route handler declaration.


</td></tr>
<tr><td>

[handleSessionCaptionArgsPhoto()?](./gramstax.ctx.handlesessioncaptionargsphoto.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionCaptionArgsPhoto` route handler declaration.


</td></tr>
<tr><td>

[handleSessionCaptionArgsVideo()?](./gramstax.ctx.handlesessioncaptionargsvideo.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionCaptionArgsVideo` route handler declaration.


</td></tr>
<tr><td>

[handleSessionCaptionArgsVoice()?](./gramstax.ctx.handlesessioncaptionargsvoice.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionCaptionArgsVoice` route handler declaration.


</td></tr>
<tr><td>

[handleSessionCaptionAudio()?](./gramstax.ctx.handlesessioncaptionaudio.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionCaptionAudio` route handler declaration.


</td></tr>
<tr><td>

[handleSessionCaptionDocument()?](./gramstax.ctx.handlesessioncaptiondocument.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionCaptionDocument` route handler declaration.


</td></tr>
<tr><td>

[handleSessionCaptionPhoto()?](./gramstax.ctx.handlesessioncaptionphoto.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionCaptionPhoto` route handler declaration.


</td></tr>
<tr><td>

[handleSessionCaptionVideo()?](./gramstax.ctx.handlesessioncaptionvideo.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionCaptionVideo` route handler declaration.


</td></tr>
<tr><td>

[handleSessionCaptionVoice()?](./gramstax.ctx.handlesessioncaptionvoice.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionCaptionVoice` route handler declaration.


</td></tr>
<tr><td>

[handleSessionCommandArgsText()?](./gramstax.ctx.handlesessioncommandargstext.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionCommandArgsText` route handler declaration.


</td></tr>
<tr><td>

[handleSessionCommandCaptionAnimation()?](./gramstax.ctx.handlesessioncommandcaptionanimation.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionCommandCaptionAnimation` route handler declaration.


</td></tr>
<tr><td>

[handleSessionCommandCaptionArgsAnimation()?](./gramstax.ctx.handlesessioncommandcaptionargsanimation.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionCommandCaptionArgsAnimation` route handler declaration.


</td></tr>
<tr><td>

[handleSessionCommandCaptionArgsAudio()?](./gramstax.ctx.handlesessioncommandcaptionargsaudio.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionCommandCaptionArgsAudio` route handler declaration.


</td></tr>
<tr><td>

[handleSessionCommandCaptionArgsDocument()?](./gramstax.ctx.handlesessioncommandcaptionargsdocument.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionCommandCaptionArgsDocument` route handler declaration.


</td></tr>
<tr><td>

[handleSessionCommandCaptionArgsPhoto()?](./gramstax.ctx.handlesessioncommandcaptionargsphoto.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionCommandCaptionArgsPhoto` route handler declaration.


</td></tr>
<tr><td>

[handleSessionCommandCaptionArgsVideo()?](./gramstax.ctx.handlesessioncommandcaptionargsvideo.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionCommandCaptionArgsVideo` route handler declaration.


</td></tr>
<tr><td>

[handleSessionCommandCaptionArgsVoice()?](./gramstax.ctx.handlesessioncommandcaptionargsvoice.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionCommandCaptionArgsVoice` route handler declaration.


</td></tr>
<tr><td>

[handleSessionCommandCaptionAudio()?](./gramstax.ctx.handlesessioncommandcaptionaudio.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionCommandCaptionAudio` route handler declaration.


</td></tr>
<tr><td>

[handleSessionCommandCaptionDocument()?](./gramstax.ctx.handlesessioncommandcaptiondocument.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionCommandCaptionDocument` route handler declaration.


</td></tr>
<tr><td>

[handleSessionCommandCaptionPhoto()?](./gramstax.ctx.handlesessioncommandcaptionphoto.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionCommandCaptionPhoto` route handler declaration.


</td></tr>
<tr><td>

[handleSessionCommandCaptionVideo()?](./gramstax.ctx.handlesessioncommandcaptionvideo.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionCommandCaptionVideo` route handler declaration.


</td></tr>
<tr><td>

[handleSessionCommandCaptionVoice()?](./gramstax.ctx.handlesessioncommandcaptionvoice.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionCommandCaptionVoice` route handler declaration.


</td></tr>
<tr><td>

[handleSessionCommandText()?](./gramstax.ctx.handlesessioncommandtext.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionCommandText` route handler declaration.


</td></tr>
<tr><td>

[handleSessionFree()?](./gramstax.ctx.handlesessionfree.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionFree` route handler declaration.


</td></tr>
<tr><td>

[handleSessionFreeAnimation()?](./gramstax.ctx.handlesessionfreeanimation.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionFreeAnimation` route handler declaration.


</td></tr>
<tr><td>

[handleSessionFreeAudio()?](./gramstax.ctx.handlesessionfreeaudio.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionFreeAudio` route handler declaration.


</td></tr>
<tr><td>

[handleSessionFreeContact()?](./gramstax.ctx.handlesessionfreecontact.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionFreeContact` route handler declaration.


</td></tr>
<tr><td>

[handleSessionFreeDocument()?](./gramstax.ctx.handlesessionfreedocument.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionFreeDocument` route handler declaration.


</td></tr>
<tr><td>

[handleSessionFreeLocation()?](./gramstax.ctx.handlesessionfreelocation.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionFreeLocation` route handler declaration.


</td></tr>
<tr><td>

[handleSessionFreePhoto()?](./gramstax.ctx.handlesessionfreephoto.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionFreePhoto` route handler declaration.


</td></tr>
<tr><td>

[handleSessionFreeSticker()?](./gramstax.ctx.handlesessionfreesticker.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionFreeSticker` route handler declaration.


</td></tr>
<tr><td>

[handleSessionFreeText()?](./gramstax.ctx.handlesessionfreetext.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionFreeText` route handler declaration.


</td></tr>
<tr><td>

[handleSessionFreeVideo()?](./gramstax.ctx.handlesessionfreevideo.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionFreeVideo` route handler declaration.


</td></tr>
<tr><td>

[handleSessionFreeVideoNote()?](./gramstax.ctx.handlesessionfreevideonote.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionFreeVideoNote` route handler declaration.


</td></tr>
<tr><td>

[handleSessionFreeVoice()?](./gramstax.ctx.handlesessionfreevoice.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionFreeVoice` route handler declaration.


</td></tr>
<tr><td>

[handleSessionText()?](./gramstax.ctx.handlesessiontext.md)


</td><td>


</td><td>

_(Optional)_ Optional `handleSessionText` route handler declaration.


</td></tr>
<tr><td>

[handleText()?](./gramstax.ctx.handletext.md)


</td><td>


</td><td>

_(Optional)_ Route handler for text messages matching `intentText`.


</td></tr>
<tr><td>

[haveArgs(str, mtd)](./gramstax.ctx.haveargs.md)


</td><td>


</td><td>

Checks if a string contains arg separators.


</td></tr>
<tr><td>

[hookAfterRoute()?](./gramstax.ctx.hookafterroute.md)


</td><td>


</td><td>

_(Optional)_ Page-level hook after a route handler execution.


</td></tr>
<tr><td>

[hookBeforeRoute()?](./gramstax.ctx.hookbeforeroute.md)


</td><td>


</td><td>

_(Optional)_ Page-level hook before route handler execution.


</td></tr>
<tr><td>

[inlineKeyboard(callback, params)](./gramstax.ctx.inlinekeyboard.md)


</td><td>


</td><td>

Creates an inline keyboard using a builder callback.


</td></tr>
<tr><td>

[inlineKeyboardT(PageDest, layout, AGBaseId, data)](./gramstax.ctx.inlinekeyboardt.md)


</td><td>


</td><td>

Creates an inline keyboard with template-based buttons linked to page destinations.


</td></tr>
<tr><td>

[isPathUnderRoots(src, roots)](./gramstax.ctx.ispathunderroots.md)


</td><td>

`static`


</td><td>

Check whether a local path sits under one of the jail roots.


</td></tr>
<tr><td>

[keyboardCols(k, l, layout, cb)](./gramstax.ctx.keyboardcols.md)


</td><td>


</td><td>

Helper method to arrange keyboard buttons in a grid layout.


</td></tr>
<tr><td>

[methodSession(prefix, name)](./gramstax.ctx.methodsession.md)


</td><td>


</td><td>

\[LOW-LEVEL\] Session method name builders.


</td></tr>
<tr><td>

[methodSessionArgsCallbackQueryData(name)](./gramstax.ctx.methodsessionargscallbackquerydata.md)


</td><td>


</td><td>

Session method key builder for `handleSessionArgsCallbackQueryData`.


</td></tr>
<tr><td>

[methodSessionArgsText(name)](./gramstax.ctx.methodsessionargstext.md)


</td><td>


</td><td>

Session method key builder for `handleSessionArgsText`.


</td></tr>
<tr><td>

[methodSessionCallbackQueryData(name)](./gramstax.ctx.methodsessioncallbackquerydata.md)


</td><td>


</td><td>

Session method key builder for `handleSessionCallbackQueryData`.


</td></tr>
<tr><td>

[methodSessionCaptionAnimation(name)](./gramstax.ctx.methodsessioncaptionanimation.md)


</td><td>


</td><td>

Session method key builder for `handleSessionCaptionAnimation`.


</td></tr>
<tr><td>

[methodSessionCaptionArgsAnimation(name)](./gramstax.ctx.methodsessioncaptionargsanimation.md)


</td><td>


</td><td>

Session method key builder for `handleSessionCaptionArgsAnimation`.


</td></tr>
<tr><td>

[methodSessionCaptionArgsAudio(name)](./gramstax.ctx.methodsessioncaptionargsaudio.md)


</td><td>


</td><td>

Session method key builder for `handleSessionCaptionArgsAudio`.


</td></tr>
<tr><td>

[methodSessionCaptionArgsDocument(name)](./gramstax.ctx.methodsessioncaptionargsdocument.md)


</td><td>


</td><td>

Session method key builder for `handleSessionCaptionArgsDocument`.


</td></tr>
<tr><td>

[methodSessionCaptionArgsPhoto(name)](./gramstax.ctx.methodsessioncaptionargsphoto.md)


</td><td>


</td><td>

Session method key builder for `handleSessionCaptionArgsPhoto`.


</td></tr>
<tr><td>

[methodSessionCaptionArgsVideo(name)](./gramstax.ctx.methodsessioncaptionargsvideo.md)


</td><td>


</td><td>

Session method key builder for `handleSessionCaptionArgsVideo`.


</td></tr>
<tr><td>

[methodSessionCaptionArgsVoice(name)](./gramstax.ctx.methodsessioncaptionargsvoice.md)


</td><td>


</td><td>

Session method key builder for `handleSessionCaptionArgsVoice`.


</td></tr>
<tr><td>

[methodSessionCaptionAudio(name)](./gramstax.ctx.methodsessioncaptionaudio.md)


</td><td>


</td><td>

Session method key builder for `handleSessionCaptionAudio`.


</td></tr>
<tr><td>

[methodSessionCaptionDocument(name)](./gramstax.ctx.methodsessioncaptiondocument.md)


</td><td>


</td><td>

Session method key builder for `handleSessionCaptionDocument`.


</td></tr>
<tr><td>

[methodSessionCaptionPhoto(name)](./gramstax.ctx.methodsessioncaptionphoto.md)


</td><td>


</td><td>

Session method key builder for `handleSessionCaptionPhoto`.


</td></tr>
<tr><td>

[methodSessionCaptionVideo(name)](./gramstax.ctx.methodsessioncaptionvideo.md)


</td><td>


</td><td>

Session method key builder for `handleSessionCaptionVideo`.


</td></tr>
<tr><td>

[methodSessionCaptionVoice(name)](./gramstax.ctx.methodsessioncaptionvoice.md)


</td><td>


</td><td>

Session method key builder for `handleSessionCaptionVoice`.


</td></tr>
<tr><td>

[methodSessionChatMemberOutIn(name)](./gramstax.ctx.methodsessionchatmemberoutin.md)


</td><td>


</td><td>

Session method key builder for `handleSessionChatMemberOutIn`.


</td></tr>
<tr><td>

[methodSessionCommandArgsText(name)](./gramstax.ctx.methodsessioncommandargstext.md)


</td><td>


</td><td>

Session method key builder for `handleSessionCommandArgsText`.


</td></tr>
<tr><td>

[methodSessionCommandCaptionAnimation(name)](./gramstax.ctx.methodsessioncommandcaptionanimation.md)


</td><td>


</td><td>

Session method key builder for `handleSessionCommandCaptionAnimation`.


</td></tr>
<tr><td>

[methodSessionCommandCaptionArgsAnimation(name)](./gramstax.ctx.methodsessioncommandcaptionargsanimation.md)


</td><td>


</td><td>

Session method key builder for `handleSessionCommandCaptionArgsAnimation`.


</td></tr>
<tr><td>

[methodSessionCommandCaptionArgsAudio(name)](./gramstax.ctx.methodsessioncommandcaptionargsaudio.md)


</td><td>


</td><td>

Session method key builder for `handleSessionCommandCaptionArgsAudio`.


</td></tr>
<tr><td>

[methodSessionCommandCaptionArgsDocument(name)](./gramstax.ctx.methodsessioncommandcaptionargsdocument.md)


</td><td>


</td><td>

Session method key builder for `handleSessionCommandCaptionArgsDocument`.


</td></tr>
<tr><td>

[methodSessionCommandCaptionArgsPhoto(name)](./gramstax.ctx.methodsessioncommandcaptionargsphoto.md)


</td><td>


</td><td>

Session method key builder for `handleSessionCommandCaptionArgsPhoto`.


</td></tr>
<tr><td>

[methodSessionCommandCaptionArgsVideo(name)](./gramstax.ctx.methodsessioncommandcaptionargsvideo.md)


</td><td>


</td><td>

Session method key builder for `handleSessionCommandCaptionArgsVideo`.


</td></tr>
<tr><td>

[methodSessionCommandCaptionArgsVoice(name)](./gramstax.ctx.methodsessioncommandcaptionargsvoice.md)


</td><td>


</td><td>

Session method key builder for `handleSessionCommandCaptionArgsVoice`.


</td></tr>
<tr><td>

[methodSessionCommandCaptionAudio(name)](./gramstax.ctx.methodsessioncommandcaptionaudio.md)


</td><td>


</td><td>

Session method key builder for `handleSessionCommandCaptionAudio`.


</td></tr>
<tr><td>

[methodSessionCommandCaptionDocument(name)](./gramstax.ctx.methodsessioncommandcaptiondocument.md)


</td><td>


</td><td>

Session method key builder for `handleSessionCommandCaptionDocument`.


</td></tr>
<tr><td>

[methodSessionCommandCaptionPhoto(name)](./gramstax.ctx.methodsessioncommandcaptionphoto.md)


</td><td>


</td><td>

Session method key builder for `handleSessionCommandCaptionPhoto`.


</td></tr>
<tr><td>

[methodSessionCommandCaptionVideo(name)](./gramstax.ctx.methodsessioncommandcaptionvideo.md)


</td><td>


</td><td>

Session method key builder for `handleSessionCommandCaptionVideo`.


</td></tr>
<tr><td>

[methodSessionCommandCaptionVoice(name)](./gramstax.ctx.methodsessioncommandcaptionvoice.md)


</td><td>


</td><td>

Session method key builder for `handleSessionCommandCaptionVoice`.


</td></tr>
<tr><td>

[methodSessionCommandText(name)](./gramstax.ctx.methodsessioncommandtext.md)


</td><td>


</td><td>

Session method key builder for `handleSessionCommandText`.


</td></tr>
<tr><td>

[methodSessionFreeAnimation(name)](./gramstax.ctx.methodsessionfreeanimation.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeAnimation`.


</td></tr>
<tr><td>

[methodSessionFreeAudio(name)](./gramstax.ctx.methodsessionfreeaudio.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeAudio`.


</td></tr>
<tr><td>

[methodSessionFreeBusinessConnection(name)](./gramstax.ctx.methodsessionfreebusinessconnection.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeBusinessConnection`.


</td></tr>
<tr><td>

[methodSessionFreeBusinessMessage(name)](./gramstax.ctx.methodsessionfreebusinessmessage.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeBusinessMessage`.


</td></tr>
<tr><td>

[methodSessionFreeChannelChatCreated(name)](./gramstax.ctx.methodsessionfreechannelchatcreated.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeChannelChatCreated`.


</td></tr>
<tr><td>

[methodSessionFreeChannelPost(name)](./gramstax.ctx.methodsessionfreechannelpost.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeChannelPost`.


</td></tr>
<tr><td>

[methodSessionFreeChatBackgroundSet(name)](./gramstax.ctx.methodsessionfreechatbackgroundset.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeChatBackgroundSet`.


</td></tr>
<tr><td>

[methodSessionFreeChatBoost(name)](./gramstax.ctx.methodsessionfreechatboost.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeChatBoost`.


</td></tr>
<tr><td>

[methodSessionFreeChatJoinRequest(name)](./gramstax.ctx.methodsessionfreechatjoinrequest.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeChatJoinRequest`.


</td></tr>
<tr><td>

[methodSessionFreeChatShared(name)](./gramstax.ctx.methodsessionfreechatshared.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeChatShared`.


</td></tr>
<tr><td>

[methodSessionFreeChosenInlineResult(name)](./gramstax.ctx.methodsessionfreechoseninlineresult.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeChosenInlineResult`.


</td></tr>
<tr><td>

[methodSessionFreeCommunityChatJoined(name)](./gramstax.ctx.methodsessionfreecommunitychatjoined.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeCommunityChatJoined`.


</td></tr>
<tr><td>

[methodSessionFreeConnectedWebsite(name)](./gramstax.ctx.methodsessionfreeconnectedwebsite.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeConnectedWebsite`.


</td></tr>
<tr><td>

[methodSessionFreeContact(name)](./gramstax.ctx.methodsessionfreecontact.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeContact`.


</td></tr>
<tr><td>

[methodSessionFreeDeleteChatPhoto(name)](./gramstax.ctx.methodsessionfreedeletechatphoto.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeDeleteChatPhoto`.


</td></tr>
<tr><td>

[methodSessionFreeDeletedBusinessMessages(name)](./gramstax.ctx.methodsessionfreedeletedbusinessmessages.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeDeletedBusinessMessages`.


</td></tr>
<tr><td>

[methodSessionFreeDocument(name)](./gramstax.ctx.methodsessionfreedocument.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeDocument`.


</td></tr>
<tr><td>

[methodSessionFreeEdit(name)](./gramstax.ctx.methodsessionfreeedit.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeEdit`.


</td></tr>
<tr><td>

[methodSessionFreeEditChannelPost(name)](./gramstax.ctx.methodsessionfreeeditchannelpost.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeEditChannelPost`.


</td></tr>
<tr><td>

[methodSessionFreeEditedBusinessMessage(name)](./gramstax.ctx.methodsessionfreeeditedbusinessmessage.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeEditedBusinessMessage`.


</td></tr>
<tr><td>

[methodSessionFreeForumTopicClosed(name)](./gramstax.ctx.methodsessionfreeforumtopicclosed.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeForumTopicClosed`.


</td></tr>
<tr><td>

[methodSessionFreeForumTopicCreated(name)](./gramstax.ctx.methodsessionfreeforumtopiccreated.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeForumTopicCreated`.


</td></tr>
<tr><td>

[methodSessionFreeForumTopicEdited(name)](./gramstax.ctx.methodsessionfreeforumtopicedited.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeForumTopicEdited`.


</td></tr>
<tr><td>

[methodSessionFreeForumTopicReopened(name)](./gramstax.ctx.methodsessionfreeforumtopicreopened.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeForumTopicReopened`.


</td></tr>
<tr><td>

[methodSessionFreeGeneralForumTopicHidden(name)](./gramstax.ctx.methodsessionfreegeneralforumtopichidden.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeGeneralForumTopicHidden`.


</td></tr>
<tr><td>

[methodSessionFreeGeneralForumTopicUnhidden(name)](./gramstax.ctx.methodsessionfreegeneralforumtopicunhidden.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeGeneralForumTopicUnhidden`.


</td></tr>
<tr><td>

[methodSessionFreeGiveaway(name)](./gramstax.ctx.methodsessionfreegiveaway.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeGiveaway`.


</td></tr>
<tr><td>

[methodSessionFreeGiveawayCompleted(name)](./gramstax.ctx.methodsessionfreegiveawaycompleted.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeGiveawayCompleted`.


</td></tr>
<tr><td>

[methodSessionFreeGiveawayCreated(name)](./gramstax.ctx.methodsessionfreegiveawaycreated.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeGiveawayCreated`.


</td></tr>
<tr><td>

[methodSessionFreeGiveawayWinners(name)](./gramstax.ctx.methodsessionfreegiveawaywinners.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeGiveawayWinners`.


</td></tr>
<tr><td>

[methodSessionFreeGroupChatCreated(name)](./gramstax.ctx.methodsessionfreegroupchatcreated.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeGroupChatCreated`.


</td></tr>
<tr><td>

[methodSessionFreeInlineQuery(name)](./gramstax.ctx.methodsessionfreeinlinequery.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeInlineQuery`.


</td></tr>
<tr><td>

[methodSessionFreeLeftChatMember(name)](./gramstax.ctx.methodsessionfreeleftchatmember.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeLeftChatMember`.


</td></tr>
<tr><td>

[methodSessionFreeLocation(name)](./gramstax.ctx.methodsessionfreelocation.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeLocation`.


</td></tr>
<tr><td>

[methodSessionFreeMessageAutoDeleteTimerChanged(name)](./gramstax.ctx.methodsessionfreemessageautodeletetimerchanged.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeMessageAutoDeleteTimerChanged`.


</td></tr>
<tr><td>

[methodSessionFreeMessageReactionCount(name)](./gramstax.ctx.methodsessionfreemessagereactioncount.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeMessageReactionCount`.


</td></tr>
<tr><td>

[methodSessionFreeNewChatMembers(name)](./gramstax.ctx.methodsessionfreenewchatmembers.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeNewChatMembers`.


</td></tr>
<tr><td>

[methodSessionFreeNewChatPhoto(name)](./gramstax.ctx.methodsessionfreenewchatphoto.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeNewChatPhoto`.


</td></tr>
<tr><td>

[methodSessionFreeNewChatTitle(name)](./gramstax.ctx.methodsessionfreenewchattitle.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeNewChatTitle`.


</td></tr>
<tr><td>

[methodSessionFreePassportData(name)](./gramstax.ctx.methodsessionfreepassportdata.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreePassportData`.


</td></tr>
<tr><td>

[methodSessionFreePhoto(name)](./gramstax.ctx.methodsessionfreephoto.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreePhoto`.


</td></tr>
<tr><td>

[methodSessionFreePinMessage(name)](./gramstax.ctx.methodsessionfreepinmessage.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreePinMessage`.


</td></tr>
<tr><td>

[methodSessionFreePoll(name)](./gramstax.ctx.methodsessionfreepoll.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreePoll`.


</td></tr>
<tr><td>

[methodSessionFreePollAnswer(name)](./gramstax.ctx.methodsessionfreepollanswer.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreePollAnswer`.


</td></tr>
<tr><td>

[methodSessionFreePreCheckoutQuery(name)](./gramstax.ctx.methodsessionfreeprecheckoutquery.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreePreCheckoutQuery`.


</td></tr>
<tr><td>

[methodSessionFreeProximityAlertTriggered(name)](./gramstax.ctx.methodsessionfreeproximityalerttriggered.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeProximityAlertTriggered`.


</td></tr>
<tr><td>

[methodSessionFreeReaction(name)](./gramstax.ctx.methodsessionfreereaction.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeReaction`.


</td></tr>
<tr><td>

[methodSessionFreeRefundedPayment(name)](./gramstax.ctx.methodsessionfreerefundedpayment.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeRefundedPayment`.


</td></tr>
<tr><td>

[methodSessionFreeRemovedChatBoost(name)](./gramstax.ctx.methodsessionfreeremovedchatboost.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeRemovedChatBoost`.


</td></tr>
<tr><td>

[methodSessionFreeShippingQuery(name)](./gramstax.ctx.methodsessionfreeshippingquery.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeShippingQuery`.


</td></tr>
<tr><td>

[methodSessionFreeSticker(name)](./gramstax.ctx.methodsessionfreesticker.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeSticker`.


</td></tr>
<tr><td>

[methodSessionFreeStoppedGeneration(name)](./gramstax.ctx.methodsessionfreestoppedgeneration.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeStoppedGeneration`.


</td></tr>
<tr><td>

[methodSessionFreeSuccessfulPayment(name)](./gramstax.ctx.methodsessionfreesuccessfulpayment.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeSuccessfulPayment`.


</td></tr>
<tr><td>

[methodSessionFreeSupergroupChatCreated(name)](./gramstax.ctx.methodsessionfreesupergroupchatcreated.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeSupergroupChatCreated`.


</td></tr>
<tr><td>

[methodSessionFreeText(name)](./gramstax.ctx.methodsessionfreetext.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeText`.


</td></tr>
<tr><td>

[methodSessionFreeUserShared(name)](./gramstax.ctx.methodsessionfreeusershared.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeUserShared`.


</td></tr>
<tr><td>

[methodSessionFreeVideo(name)](./gramstax.ctx.methodsessionfreevideo.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeVideo`.


</td></tr>
<tr><td>

[methodSessionFreeVideoChatEnded(name)](./gramstax.ctx.methodsessionfreevideochatended.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeVideoChatEnded`.


</td></tr>
<tr><td>

[methodSessionFreeVideoChatParticipantsInvited(name)](./gramstax.ctx.methodsessionfreevideochatparticipantsinvited.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeVideoChatParticipantsInvited`.


</td></tr>
<tr><td>

[methodSessionFreeVideoChatScheduled(name)](./gramstax.ctx.methodsessionfreevideochatscheduled.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeVideoChatScheduled`.


</td></tr>
<tr><td>

[methodSessionFreeVideoChatStarted(name)](./gramstax.ctx.methodsessionfreevideochatstarted.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeVideoChatStarted`.


</td></tr>
<tr><td>

[methodSessionFreeVideoNote(name)](./gramstax.ctx.methodsessionfreevideonote.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeVideoNote`.


</td></tr>
<tr><td>

[methodSessionFreeVoice(name)](./gramstax.ctx.methodsessionfreevoice.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeVoice`.


</td></tr>
<tr><td>

[methodSessionFreeWebAppData(name)](./gramstax.ctx.methodsessionfreewebappdata.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeWebAppData`.


</td></tr>
<tr><td>

[methodSessionFreeWriteAccessAllowed(name)](./gramstax.ctx.methodsessionfreewriteaccessallowed.md)


</td><td>


</td><td>

Session method key builder for `handleSessionFreeWriteAccessAllowed`.


</td></tr>
<tr><td>

[methodSessionMyChatMemberAdminRegular(name)](./gramstax.ctx.methodsessionmychatmemberadminregular.md)


</td><td>


</td><td>

Session method key builder for `handleSessionMyChatMemberAdminRegular`.


</td></tr>
<tr><td>

[methodSessionMyChatMemberOutAdmin(name)](./gramstax.ctx.methodsessionmychatmemberoutadmin.md)


</td><td>


</td><td>

Session method key builder for `handleSessionMyChatMemberOutAdmin`.


</td></tr>
<tr><td>

[methodSessionMyChatMemberOutRegular(name)](./gramstax.ctx.methodsessionmychatmemberoutregular.md)


</td><td>


</td><td>

Session method key builder for `handleSessionMyChatMemberOutRegular`.


</td></tr>
<tr><td>

[methodSessionMyChatMemberRegularAdmin(name)](./gramstax.ctx.methodsessionmychatmemberregularadmin.md)


</td><td>


</td><td>

Session method key builder for `handleSessionMyChatMemberRegularAdmin`.


</td></tr>
<tr><td>

[methodSessionText(name)](./gramstax.ctx.methodsessiontext.md)


</td><td>


</td><td>

Session method key builder for `handleSessionText`.


</td></tr>
<tr><td>

[notifySendError(err, kind, chatId)](./gramstax.ctx.notifysenderror.md)


</td><td>


</td><td>

Invoke the `onSendError` hook best-effort (Q9 option b).


</td></tr>
<tr><td>

[postBusinessStory(businessConnectionId, content, activePeriod, options)](./gramstax.ctx.postbusinessstory.md)


</td><td>


</td><td>

Posts a story on behalf of a managed business account.


</td></tr>
<tr><td>

[refundStars(userId, chargeId)](./gramstax.ctx.refundstars.md)


</td><td>


</td><td>

Refunds a successful Stars payment to the user.


</td></tr>
<tr><td>

[renderAnimation(params)](./gramstax.ctx.renderanimation.md)


</td><td>


</td><td>

Sends an animation/GIF message using the page template.

Template block: `<g-media>` (read via `renderMedia`).


</td></tr>
<tr><td>

[renderAudio(params)](./gramstax.ctx.renderaudio.md)


</td><td>


</td><td>

Sends an audio message using the page template.

Template block: `<g-media>` (read via `renderMedia`).


</td></tr>
<tr><td>

[renderAudioGroup(params)](./gramstax.ctx.renderaudiogroup.md)


</td><td>


</td><td>

Sends an audio media group using pipe-delimited `src` values from the page template.

Template block: `<g-media-group>` (read via `renderMediaGroup`).


</td></tr>
<tr><td>

[renderBroadcastDelete(params)](./gramstax.ctx.renderbroadcastdelete.md)


</td><td>


</td><td>

Deletes already-sent messages for many recipients in bulk.

Template block: none — operates on message ids, reads no template block.


</td></tr>
<tr><td>

[renderCallbackAnswer(params)](./gramstax.ctx.rendercallbackanswer.md)


</td><td>


</td><td>

Answers the active callback query with template text.

Template block: `<g-callback-answer>` (read via `getGCallbackAnswer`).


</td></tr>
<tr><td>

[renderContact(params)](./gramstax.ctx.rendercontact.md)


</td><td>


</td><td>

Sends a contact using the page template.

Template block: `<g-media>` (read via `renderMedia`).


</td></tr>
<tr><td>

[renderDice(params)](./gramstax.ctx.renderdice.md)


</td><td>


</td><td>

Sends a template-driven dice animation using the page `<g-dice>` block.

Template block: `<g-dice>` (read via `getGDice`).


</td></tr>
<tr><td>

[renderDocument(params)](./gramstax.ctx.renderdocument.md)


</td><td>


</td><td>

Sends a document message using the page template.

Template block: `<g-media>` (read via `renderMedia`).


</td></tr>
<tr><td>

[renderDocumentGroup(params)](./gramstax.ctx.renderdocumentgroup.md)


</td><td>


</td><td>

Sends a document media group using pipe-delimited `src` values from the page template.

Template block: `<g-media-group>` (read via `renderMediaGroup`).


</td></tr>
<tr><td>

[renderEditCaption(params)](./gramstax.ctx.rendereditcaption.md)


</td><td>


</td><td>

Edits a media message caption using the page template.

Template block: `<g-message>` (read via `getGMessage`).


</td></tr>
<tr><td>

[renderEditKeyboard(params)](./gramstax.ctx.rendereditkeyboard.md)


</td><td>


</td><td>

Edits only the inline keyboard using the page template.

Template block: `<g-keyboard>` (read via `getGKeyboard`).


</td></tr>
<tr><td>

[renderGift(params)](./gramstax.ctx.rendergift.md)


</td><td>


</td><td>

Sends a Telegram gift with card text from the page template.

Template block: `<g-gift>` (read via `getGGift`).


</td></tr>
<tr><td>

[renderGuestAnswer(params)](./gramstax.ctx.renderguestanswer.md)


</td><td>


</td><td>

Answers the active guest message query with a caller-built result.

Template block: `<g-answer-note>` (read via `getGAnswerNote`).


</td></tr>
<tr><td>

[renderInlineAnswer(params)](./gramstax.ctx.renderinlineanswer.md)


</td><td>


</td><td>

Answers the active inline query with caller-built results and template button text.

Template block: `<g-inline-button>` (read via `getGInlineButton`).


</td></tr>
<tr><td>

[renderInvoice(params)](./gramstax.ctx.renderinvoice.md)


</td><td>


</td><td>

Sends a template-driven invoice using the page `<g-invoice>` block.

Template block: `<g-invoice>` (read via `getGInvoice`).


</td></tr>
<tr><td>

[renderLocation(params)](./gramstax.ctx.renderlocation.md)


</td><td>


</td><td>

Sends a location using the page template.

Template block: `<g-media>` (read via `renderMedia`).


</td></tr>
<tr><td>

[renderMedia(params)](./gramstax.ctx.rendermedia.md)


</td><td>


</td><td>

Sends or edits a media message with dynamic type selection.

Template block: `<g-media>` (read via `getGMedia`).


</td></tr>
<tr><td>

[renderMediaGroup(params)](./gramstax.ctx.rendermediagroup.md)


</td><td>


</td><td>

Sends or edits a Telegram media group using pipe-delimited `src` values or a `<g-media-group>` block from the page template.

Template block: `<g-media-group>` (read via `getGMedia` — the block's `mediaGroup` items).


</td></tr>
<tr><td>

[renderPaidMedia(params)](./gramstax.ctx.renderpaidmedia.md)


</td><td>


</td><td>

Sends Stars-locked photo/video content using the page `<g-paid-media>` block.

Template block: `<g-paid-media>` (read via `getGPaidMedia`).


</td></tr>
<tr><td>

[renderPhoto(params)](./gramstax.ctx.renderphoto.md)


</td><td>


</td><td>

Sends a photo message using the page template.

Template block: `<g-media>` (read via `renderMedia`).


</td></tr>
<tr><td>

[renderPhotoGroup(params)](./gramstax.ctx.renderphotogroup.md)


</td><td>


</td><td>

Sends a photo media group using pipe-delimited `src` values from the page template.

Template block: `<g-media-group>` (read via `renderMediaGroup`).


</td></tr>
<tr><td>

[renderPoll(params)](./gramstax.ctx.renderpoll.md)


</td><td>


</td><td>

Sends a template-driven poll using the page `<g-poll>` block.

Template block: `<g-poll>` (read via `getGPoll`).


</td></tr>
<tr><td>

[renderPreCheckout(params)](./gramstax.ctx.renderprecheckout.md)


</td><td>


</td><td>

Answers the active pre-checkout query with a template-backed error message.

Template block: `<g-precheckout-error>` (read via `getGPrecheckoutError`).


</td></tr>
<tr><td>

[renderShipping(params)](./gramstax.ctx.rendershipping.md)


</td><td>


</td><td>

Answers the active shipping query with a template-backed error message.

Template block: `<g-shipping-error>` (read via `getGShippingError`).


</td></tr>
<tr><td>

[renderSticker(params)](./gramstax.ctx.rendersticker.md)


</td><td>


</td><td>

Sends a sticker using the page template.

Template block: `<g-media>` (read via `renderMedia`).


</td></tr>
<tr><td>

[renderText(params)](./gramstax.ctx.rendertext.md)


</td><td>


</td><td>

Sends or edits a text message using the page template.

Template block: `<g-message>` (read via `getGMessage`).


</td></tr>
<tr><td>

[renderVenue(params)](./gramstax.ctx.rendervenue.md)


</td><td>


</td><td>

Sends a template-driven venue using the page `<g-venue>` block.

Template block: `<g-venue>` (read via `getGVenue`).


</td></tr>
<tr><td>

[renderVideo(params)](./gramstax.ctx.rendervideo.md)


</td><td>


</td><td>

Sends a video message using the page template.

Template block: `<g-media>` (read via `renderMedia`).


</td></tr>
<tr><td>

[renderVideoGroup(params)](./gramstax.ctx.rendervideogroup.md)


</td><td>


</td><td>

Sends a video media group using pipe-delimited `src` values from the page template.

Template block: `<g-media-group>` (read via `renderMediaGroup`).


</td></tr>
<tr><td>

[renderVideoNote(params)](./gramstax.ctx.rendervideonote.md)


</td><td>


</td><td>

Sends a video note (circular video) using the page template.

Template block: `<g-media>` (read via `renderMedia`).


</td></tr>
<tr><td>

[renderVoice(params)](./gramstax.ctx.rendervoice.md)


</td><td>


</td><td>

Sends a voice message using the page template.

Template block: `<g-media>` (read via `renderMedia`).


</td></tr>
<tr><td>

[renderWebAppAnswer(params)](./gramstax.ctx.renderwebappanswer.md)


</td><td>


</td><td>

Answers a web app query via the Bot API with a caller-built result.

Template block: `<g-answer-note>` (read via `getGAnswerNote`).


</td></tr>
<tr><td>

[replyFallbackText()](./gramstax.ctx.replyfallbacktext.md)


</td><td>


</td><td>

Best-effort fallback-text reply; never throws (nested failures are ignored).


</td></tr>
<tr><td>

[replyWithHtmlStream(stream, otherRichMessageDraft, otherRichMessage, baseInputRichMessage, signal)](./gramstax.ctx.replywithhtmlstream.md)


</td><td>


</td><td>

Streams an iterator of HTML strings to the current chat as a single rich message that updates progressively.


</td></tr>
<tr><td>

[replyWithMarkdownStream(stream, otherRichMessageDraft, otherRichMessage, baseInputRichMessage, signal)](./gramstax.ctx.replywithmarkdownstream.md)


</td><td>


</td><td>

Streams an iterator of markdown strings to the current chat as a single rich message that updates progressively.


</td></tr>
<tr><td>

[replyWithStream(stream, otherMessageDraft, otherMessage, signal)](./gramstax.ctx.replywithstream.md)


</td><td>


</td><td>

Streams an iterator of message pieces to the current chat, making text appear progressively as editing message drafts.


</td></tr>
<tr><td>

[resolveFallbackText()](./gramstax.ctx.resolvefallbacktext.md)


</td><td>


</td><td>

Resolve the effective fallback text (per-page override or framework default).


</td></tr>
<tr><td>

[resolveMedia(src, filename)](./gramstax.ctx.resolvemedia.md)


</td><td>


</td><td>

Resolve a media `src` through the instance path jail.


</td></tr>
<tr><td>

[resolveMediaInput(src, filename, roots)](./gramstax.ctx.resolvemediainput.md)


</td><td>

`static`


</td><td>

Resolve a template media `src` into an uploadable value.


</td></tr>
<tr><td>

[retryAfterMs(err)](./gramstax.ctx.retryafterms.md)


</td><td>

`static`


</td><td>

Extract the Bot API `retry_after` hint in milliseconds, if present.


</td></tr>
<tr><td>

[sendChatId()](./gramstax.ctx.sendchatid.md)


</td><td>


</td><td>

Best-effort current chat id for send-error context only.


</td></tr>
<tr><td>

[sendPageName()](./gramstax.ctx.sendpagename.md)


</td><td>


</td><td>

Best-effort page name for send-error context.


</td></tr>
<tr><td>

[sessionKey()](./gramstax.ctx.sessionkey.md)


</td><td>


</td><td>

Builds the cache key that scopes this session.


</td></tr>
<tr><td>

[setSession(method, params, moreRoot)](./gramstax.ctx.setsession.md)


</td><td>


</td><td>

\[LOW-LEVEL\] Sets session data for the current user.


</td></tr>
<tr><td>

[setSessionArgsCallbackQueryData(this, params)](./gramstax.ctx.setsessionargscallbackquerydata.md)


</td><td>


</td><td>

Set the session method for `handleSessionArgsCallbackQueryData` routing.


</td></tr>
<tr><td>

[setSessionArgsText(this, params)](./gramstax.ctx.setsessionargstext.md)


</td><td>


</td><td>

Set the session method for `handleSessionArgsText` routing.


</td></tr>
<tr><td>

[setSessionCallbackQueryData(this, params)](./gramstax.ctx.setsessioncallbackquerydata.md)


</td><td>


</td><td>

Session set helper methods.


</td></tr>
<tr><td>

[setSessionCaptionAnimation(this, params)](./gramstax.ctx.setsessioncaptionanimation.md)


</td><td>


</td><td>

Set the session method for `handleSessionCaptionAnimation` routing.


</td></tr>
<tr><td>

[setSessionCaptionArgsAnimation(this, params)](./gramstax.ctx.setsessioncaptionargsanimation.md)


</td><td>


</td><td>

Set the session method for `handleSessionCaptionArgsAnimation` routing.


</td></tr>
<tr><td>

[setSessionCaptionArgsAudio(this, params)](./gramstax.ctx.setsessioncaptionargsaudio.md)


</td><td>


</td><td>

Set the session method for `handleSessionCaptionArgsAudio` routing.


</td></tr>
<tr><td>

[setSessionCaptionArgsDocument(this, params)](./gramstax.ctx.setsessioncaptionargsdocument.md)


</td><td>


</td><td>

Set the session method for `handleSessionCaptionArgsDocument` routing.


</td></tr>
<tr><td>

[setSessionCaptionArgsPhoto(this, params)](./gramstax.ctx.setsessioncaptionargsphoto.md)


</td><td>


</td><td>

Set the session method for `handleSessionCaptionArgsPhoto` routing.


</td></tr>
<tr><td>

[setSessionCaptionArgsVideo(this, params)](./gramstax.ctx.setsessioncaptionargsvideo.md)


</td><td>


</td><td>

Set the session method for `handleSessionCaptionArgsVideo` routing.


</td></tr>
<tr><td>

[setSessionCaptionArgsVoice(this, params)](./gramstax.ctx.setsessioncaptionargsvoice.md)


</td><td>


</td><td>

Set the session method for `handleSessionCaptionArgsVoice` routing.


</td></tr>
<tr><td>

[setSessionCaptionAudio(this, params)](./gramstax.ctx.setsessioncaptionaudio.md)


</td><td>


</td><td>

Set the session method for `handleSessionCaptionAudio` routing.


</td></tr>
<tr><td>

[setSessionCaptionDocument(this, params)](./gramstax.ctx.setsessioncaptiondocument.md)


</td><td>


</td><td>

Set the session method for `handleSessionCaptionDocument` routing.


</td></tr>
<tr><td>

[setSessionCaptionPhoto(this, params)](./gramstax.ctx.setsessioncaptionphoto.md)


</td><td>


</td><td>

Set the session method for `handleSessionCaptionPhoto` routing.


</td></tr>
<tr><td>

[setSessionCaptionVideo(this, params)](./gramstax.ctx.setsessioncaptionvideo.md)


</td><td>


</td><td>

Set the session method for `handleSessionCaptionVideo` routing.


</td></tr>
<tr><td>

[setSessionCaptionVoice(this, params)](./gramstax.ctx.setsessioncaptionvoice.md)


</td><td>


</td><td>

Set the session method for `handleSessionCaptionVoice` routing.


</td></tr>
<tr><td>

[setSessionChatMemberOutIn(this, params)](./gramstax.ctx.setsessionchatmemberoutin.md)


</td><td>


</td><td>

Set the session method for `handleSessionChatMemberOutIn` routing.


</td></tr>
<tr><td>

[setSessionCommandArgsText(this, params)](./gramstax.ctx.setsessioncommandargstext.md)


</td><td>


</td><td>

Set the session method for `handleSessionCommandArgsText` routing.


</td></tr>
<tr><td>

[setSessionCommandCaptionAnimation(this, params)](./gramstax.ctx.setsessioncommandcaptionanimation.md)


</td><td>


</td><td>

Set the session method for `handleSessionCommandCaptionAnimation` routing.


</td></tr>
<tr><td>

[setSessionCommandCaptionArgsAnimation(this, params)](./gramstax.ctx.setsessioncommandcaptionargsanimation.md)


</td><td>


</td><td>

Set the session method for `handleSessionCommandCaptionArgsAnimation` routing.


</td></tr>
<tr><td>

[setSessionCommandCaptionArgsAudio(this, params)](./gramstax.ctx.setsessioncommandcaptionargsaudio.md)


</td><td>


</td><td>

Set the session method for `handleSessionCommandCaptionArgsAudio` routing.


</td></tr>
<tr><td>

[setSessionCommandCaptionArgsDocument(this, params)](./gramstax.ctx.setsessioncommandcaptionargsdocument.md)


</td><td>


</td><td>

Set the session method for `handleSessionCommandCaptionArgsDocument` routing.


</td></tr>
<tr><td>

[setSessionCommandCaptionArgsPhoto(this, params)](./gramstax.ctx.setsessioncommandcaptionargsphoto.md)


</td><td>


</td><td>

Set the session method for `handleSessionCommandCaptionArgsPhoto` routing.


</td></tr>
<tr><td>

[setSessionCommandCaptionArgsVideo(this, params)](./gramstax.ctx.setsessioncommandcaptionargsvideo.md)


</td><td>


</td><td>

Set the session method for `handleSessionCommandCaptionArgsVideo` routing.


</td></tr>
<tr><td>

[setSessionCommandCaptionArgsVoice(this, params)](./gramstax.ctx.setsessioncommandcaptionargsvoice.md)


</td><td>


</td><td>

Set the session method for `handleSessionCommandCaptionArgsVoice` routing.


</td></tr>
<tr><td>

[setSessionCommandCaptionAudio(this, params)](./gramstax.ctx.setsessioncommandcaptionaudio.md)


</td><td>


</td><td>

Set the session method for `handleSessionCommandCaptionAudio` routing.


</td></tr>
<tr><td>

[setSessionCommandCaptionDocument(this, params)](./gramstax.ctx.setsessioncommandcaptiondocument.md)


</td><td>


</td><td>

Set the session method for `handleSessionCommandCaptionDocument` routing.


</td></tr>
<tr><td>

[setSessionCommandCaptionPhoto(this, params)](./gramstax.ctx.setsessioncommandcaptionphoto.md)


</td><td>


</td><td>

Set the session method for `handleSessionCommandCaptionPhoto` routing.


</td></tr>
<tr><td>

[setSessionCommandCaptionVideo(this, params)](./gramstax.ctx.setsessioncommandcaptionvideo.md)


</td><td>


</td><td>

Set the session method for `handleSessionCommandCaptionVideo` routing.


</td></tr>
<tr><td>

[setSessionCommandCaptionVoice(this, params)](./gramstax.ctx.setsessioncommandcaptionvoice.md)


</td><td>


</td><td>

Set the session method for `handleSessionCommandCaptionVoice` routing.


</td></tr>
<tr><td>

[setSessionCommandText(this, params)](./gramstax.ctx.setsessioncommandtext.md)


</td><td>


</td><td>

Set the session method for `handleSessionCommandText` routing.


</td></tr>
<tr><td>

[setSessionFreeAnimation(this, params)](./gramstax.ctx.setsessionfreeanimation.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeAnimation` routing.


</td></tr>
<tr><td>

[setSessionFreeAudio(this, params)](./gramstax.ctx.setsessionfreeaudio.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeAudio` routing.


</td></tr>
<tr><td>

[setSessionFreeBusinessConnection(this, params)](./gramstax.ctx.setsessionfreebusinessconnection.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeBusinessConnection` routing.


</td></tr>
<tr><td>

[setSessionFreeBusinessMessage(this, params)](./gramstax.ctx.setsessionfreebusinessmessage.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeBusinessMessage` routing.


</td></tr>
<tr><td>

[setSessionFreeChannelChatCreated(this, params)](./gramstax.ctx.setsessionfreechannelchatcreated.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeChannelChatCreated` routing.


</td></tr>
<tr><td>

[setSessionFreeChannelPost(this, params)](./gramstax.ctx.setsessionfreechannelpost.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeChannelPost` routing.


</td></tr>
<tr><td>

[setSessionFreeChatBackgroundSet(this, params)](./gramstax.ctx.setsessionfreechatbackgroundset.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeChatBackgroundSet` routing.


</td></tr>
<tr><td>

[setSessionFreeChatBoost(this, params)](./gramstax.ctx.setsessionfreechatboost.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeChatBoost` routing.


</td></tr>
<tr><td>

[setSessionFreeChatJoinRequest(this, params)](./gramstax.ctx.setsessionfreechatjoinrequest.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeChatJoinRequest` routing.


</td></tr>
<tr><td>

[setSessionFreeChatShared(this, params)](./gramstax.ctx.setsessionfreechatshared.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeChatShared` routing.


</td></tr>
<tr><td>

[setSessionFreeChosenInlineResult(this, params)](./gramstax.ctx.setsessionfreechoseninlineresult.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeChosenInlineResult` routing.


</td></tr>
<tr><td>

[setSessionFreeCommunityChatJoined(this, params)](./gramstax.ctx.setsessionfreecommunitychatjoined.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeCommunityChatJoined` routing.


</td></tr>
<tr><td>

[setSessionFreeConnectedWebsite(this, params)](./gramstax.ctx.setsessionfreeconnectedwebsite.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeConnectedWebsite` routing.


</td></tr>
<tr><td>

[setSessionFreeContact(this, params)](./gramstax.ctx.setsessionfreecontact.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeContact` routing.


</td></tr>
<tr><td>

[setSessionFreeDeleteChatPhoto(this, params)](./gramstax.ctx.setsessionfreedeletechatphoto.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeDeleteChatPhoto` routing.


</td></tr>
<tr><td>

[setSessionFreeDeletedBusinessMessages(this, params)](./gramstax.ctx.setsessionfreedeletedbusinessmessages.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeDeletedBusinessMessages` routing.


</td></tr>
<tr><td>

[setSessionFreeDocument(this, params)](./gramstax.ctx.setsessionfreedocument.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeDocument` routing.


</td></tr>
<tr><td>

[setSessionFreeEdit(this, params)](./gramstax.ctx.setsessionfreeedit.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeEdit` routing.


</td></tr>
<tr><td>

[setSessionFreeEditChannelPost(this, params)](./gramstax.ctx.setsessionfreeeditchannelpost.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeEditChannelPost` routing.


</td></tr>
<tr><td>

[setSessionFreeEditedBusinessMessage(this, params)](./gramstax.ctx.setsessionfreeeditedbusinessmessage.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeEditedBusinessMessage` routing.


</td></tr>
<tr><td>

[setSessionFreeForumTopicClosed(this, params)](./gramstax.ctx.setsessionfreeforumtopicclosed.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeForumTopicClosed` routing.


</td></tr>
<tr><td>

[setSessionFreeForumTopicCreated(this, params)](./gramstax.ctx.setsessionfreeforumtopiccreated.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeForumTopicCreated` routing.


</td></tr>
<tr><td>

[setSessionFreeForumTopicEdited(this, params)](./gramstax.ctx.setsessionfreeforumtopicedited.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeForumTopicEdited` routing.


</td></tr>
<tr><td>

[setSessionFreeForumTopicReopened(this, params)](./gramstax.ctx.setsessionfreeforumtopicreopened.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeForumTopicReopened` routing.


</td></tr>
<tr><td>

[setSessionFreeGeneralForumTopicHidden(this, params)](./gramstax.ctx.setsessionfreegeneralforumtopichidden.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeGeneralForumTopicHidden` routing.


</td></tr>
<tr><td>

[setSessionFreeGeneralForumTopicUnhidden(this, params)](./gramstax.ctx.setsessionfreegeneralforumtopicunhidden.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeGeneralForumTopicUnhidden` routing.


</td></tr>
<tr><td>

[setSessionFreeGiveaway(this, params)](./gramstax.ctx.setsessionfreegiveaway.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeGiveaway` routing.


</td></tr>
<tr><td>

[setSessionFreeGiveawayCompleted(this, params)](./gramstax.ctx.setsessionfreegiveawaycompleted.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeGiveawayCompleted` routing.


</td></tr>
<tr><td>

[setSessionFreeGiveawayCreated(this, params)](./gramstax.ctx.setsessionfreegiveawaycreated.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeGiveawayCreated` routing.


</td></tr>
<tr><td>

[setSessionFreeGiveawayWinners(this, params)](./gramstax.ctx.setsessionfreegiveawaywinners.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeGiveawayWinners` routing.


</td></tr>
<tr><td>

[setSessionFreeGroupChatCreated(this, params)](./gramstax.ctx.setsessionfreegroupchatcreated.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeGroupChatCreated` routing.


</td></tr>
<tr><td>

[setSessionFreeInlineQuery(this, params)](./gramstax.ctx.setsessionfreeinlinequery.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeInlineQuery` routing.


</td></tr>
<tr><td>

[setSessionFreeLeftChatMember(this, params)](./gramstax.ctx.setsessionfreeleftchatmember.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeLeftChatMember` routing.


</td></tr>
<tr><td>

[setSessionFreeLocation(this, params)](./gramstax.ctx.setsessionfreelocation.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeLocation` routing.


</td></tr>
<tr><td>

[setSessionFreeMessageAutoDeleteTimerChanged(this, params)](./gramstax.ctx.setsessionfreemessageautodeletetimerchanged.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeMessageAutoDeleteTimerChanged` routing.


</td></tr>
<tr><td>

[setSessionFreeMessageReactionCount(this, params)](./gramstax.ctx.setsessionfreemessagereactioncount.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeMessageReactionCount` routing.


</td></tr>
<tr><td>

[setSessionFreeNewChatMembers(this, params)](./gramstax.ctx.setsessionfreenewchatmembers.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeNewChatMembers` routing.


</td></tr>
<tr><td>

[setSessionFreeNewChatPhoto(this, params)](./gramstax.ctx.setsessionfreenewchatphoto.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeNewChatPhoto` routing.


</td></tr>
<tr><td>

[setSessionFreeNewChatTitle(this, params)](./gramstax.ctx.setsessionfreenewchattitle.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeNewChatTitle` routing.


</td></tr>
<tr><td>

[setSessionFreePassportData(this, params)](./gramstax.ctx.setsessionfreepassportdata.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreePassportData` routing.


</td></tr>
<tr><td>

[setSessionFreePhoto(this, params)](./gramstax.ctx.setsessionfreephoto.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreePhoto` routing.


</td></tr>
<tr><td>

[setSessionFreePinMessage(this, params)](./gramstax.ctx.setsessionfreepinmessage.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreePinMessage` routing.


</td></tr>
<tr><td>

[setSessionFreePoll(this, params)](./gramstax.ctx.setsessionfreepoll.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreePoll` routing.


</td></tr>
<tr><td>

[setSessionFreePollAnswer(this, params)](./gramstax.ctx.setsessionfreepollanswer.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreePollAnswer` routing.


</td></tr>
<tr><td>

[setSessionFreePreCheckoutQuery(this, params)](./gramstax.ctx.setsessionfreeprecheckoutquery.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreePreCheckoutQuery` routing.


</td></tr>
<tr><td>

[setSessionFreeProximityAlertTriggered(this, params)](./gramstax.ctx.setsessionfreeproximityalerttriggered.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeProximityAlertTriggered` routing.


</td></tr>
<tr><td>

[setSessionFreeReaction(this, params)](./gramstax.ctx.setsessionfreereaction.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeReaction` routing.


</td></tr>
<tr><td>

[setSessionFreeRefundedPayment(this, params)](./gramstax.ctx.setsessionfreerefundedpayment.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeRefundedPayment` routing.


</td></tr>
<tr><td>

[setSessionFreeRemovedChatBoost(this, params)](./gramstax.ctx.setsessionfreeremovedchatboost.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeRemovedChatBoost` routing.


</td></tr>
<tr><td>

[setSessionFreeShippingQuery(this, params)](./gramstax.ctx.setsessionfreeshippingquery.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeShippingQuery` routing.


</td></tr>
<tr><td>

[setSessionFreeSticker(this, params)](./gramstax.ctx.setsessionfreesticker.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeSticker` routing.


</td></tr>
<tr><td>

[setSessionFreeStoppedGeneration(this, params)](./gramstax.ctx.setsessionfreestoppedgeneration.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeStoppedGeneration` routing.


</td></tr>
<tr><td>

[setSessionFreeSuccessfulPayment(this, params)](./gramstax.ctx.setsessionfreesuccessfulpayment.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeSuccessfulPayment` routing.


</td></tr>
<tr><td>

[setSessionFreeSupergroupChatCreated(this, params)](./gramstax.ctx.setsessionfreesupergroupchatcreated.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeSupergroupChatCreated` routing.


</td></tr>
<tr><td>

[setSessionFreeText(this, params)](./gramstax.ctx.setsessionfreetext.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeText` routing.


</td></tr>
<tr><td>

[setSessionFreeUserShared(this, params)](./gramstax.ctx.setsessionfreeusershared.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeUserShared` routing.


</td></tr>
<tr><td>

[setSessionFreeVideo(this, params)](./gramstax.ctx.setsessionfreevideo.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeVideo` routing.


</td></tr>
<tr><td>

[setSessionFreeVideoChatEnded(this, params)](./gramstax.ctx.setsessionfreevideochatended.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeVideoChatEnded` routing.


</td></tr>
<tr><td>

[setSessionFreeVideoChatParticipantsInvited(this, params)](./gramstax.ctx.setsessionfreevideochatparticipantsinvited.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeVideoChatParticipantsInvited` routing.


</td></tr>
<tr><td>

[setSessionFreeVideoChatScheduled(this, params)](./gramstax.ctx.setsessionfreevideochatscheduled.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeVideoChatScheduled` routing.


</td></tr>
<tr><td>

[setSessionFreeVideoChatStarted(this, params)](./gramstax.ctx.setsessionfreevideochatstarted.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeVideoChatStarted` routing.


</td></tr>
<tr><td>

[setSessionFreeVideoNote(this, params)](./gramstax.ctx.setsessionfreevideonote.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeVideoNote` routing.


</td></tr>
<tr><td>

[setSessionFreeVoice(this, params)](./gramstax.ctx.setsessionfreevoice.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeVoice` routing.


</td></tr>
<tr><td>

[setSessionFreeWebAppData(this, params)](./gramstax.ctx.setsessionfreewebappdata.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeWebAppData` routing.


</td></tr>
<tr><td>

[setSessionFreeWriteAccessAllowed(this, params)](./gramstax.ctx.setsessionfreewriteaccessallowed.md)


</td><td>


</td><td>

Set the session method for `handleSessionFreeWriteAccessAllowed` routing.


</td></tr>
<tr><td>

[setSessionMyChatMemberAdminRegular(this, params)](./gramstax.ctx.setsessionmychatmemberadminregular.md)


</td><td>


</td><td>

Set the session method for `handleSessionMyChatMemberAdminRegular` routing.


</td></tr>
<tr><td>

[setSessionMyChatMemberOutAdmin(this, params)](./gramstax.ctx.setsessionmychatmemberoutadmin.md)


</td><td>


</td><td>

Set the session method for `handleSessionMyChatMemberOutAdmin` routing.


</td></tr>
<tr><td>

[setSessionMyChatMemberOutRegular(this, params)](./gramstax.ctx.setsessionmychatmemberoutregular.md)


</td><td>


</td><td>

Set the session method for `handleSessionMyChatMemberOutRegular` routing.


</td></tr>
<tr><td>

[setSessionMyChatMemberRegularAdmin(this, params)](./gramstax.ctx.setsessionmychatmemberregularadmin.md)


</td><td>


</td><td>

Set the session method for `handleSessionMyChatMemberRegularAdmin` routing.


</td></tr>
<tr><td>

[setSessionText(this, params)](./gramstax.ctx.setsessiontext.md)


</td><td>


</td><td>

Set the session method for `handleSessionText` routing.


</td></tr>
<tr><td>

[startGiveaway(params, options)](./gramstax.ctx.startgiveaway.md)


</td><td>


</td><td>

Starts a channel giveaway from a single params object.


</td></tr>
<tr><td>

[stopLiveLocation(chatId, messageId, options)](./gramstax.ctx.stoplivelocation.md)


</td><td>


</td><td>

Stops a live location message, freezing it at its last position.


</td></tr>
<tr><td>

[stopPoll(chatId, messageId, options)](./gramstax.ctx.stoppoll.md)


</td><td>


</td><td>

Stops a live poll, closing voting and returning the final results.


</td></tr>
</tbody></table>

