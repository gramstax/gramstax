export type CtxDocs = {
  StaticProperties: {
    template: {
      _type_: string
      _description_: `HTML-like template string for the page. must be have block <base></base>`
      _example_: `
        import { PageBase } from "~/base/page";

        class MyPage extends PageBase {
          static template = \`
            <base>
              <keyboard>Button 1, Button 2</keyboard>
              <message>Hello {{name}}!</message>
            </base>
          \`;
        }
      `
    }
    data?: {
      _type_: `IPageData`
      _description_: `Page routing data created by "this.buildData()". Only defined when you want to override the intent and have a callback payload. Do not define if nothing is needed; let the system automatic handle it.`
      _example_: `
        import { PageBase } from "~/base/page";

        class StartPage extends PageBase {
          // don't define this.buildData IF there is no purpose for it!!
          // dont define like this
          static data = this.buildData() 

          // only defined for callback payload route
          static data = this.buildData((confirm?: string) => [confirm])

          // defined for callback payload route and text. textCommand trigger route
          static data = this.buildData({
            callback: (confirm?: string) => [confirm])
            intentText: \`my_page\`,
            intentTextCommand: \`hello\`
          })
        }
      `
    }
  }
  StaticMethods: {
    buildData: {
      _description_: `Create page data configuration. Accepts optional callback or options object.`
      _args_: {
        params?: {
          callback?: {
            _type_: ((...payloads: any) => string[] | string) | void
            _description_: `Callback payload builder. Must return an array; if there is a payload, it will be directed to \`callbackPayload()\`, if not, to \`callback()\`. Leave unset unless needed.`
            _example_: `
              ((confirm: string) => [confirm])
            `
          }
          intentText?: {
            _type_: string | void
            _description_: `Overrides Trigger route function \`text\` and \`textPayload\``
            _example_: `
              { intentText: \`start-home\` }
            `
          }
          intentTextCommand?: {
            _type_: string | void
            _description_: `Overrides Trigger route function \`textCommand\` and \`textCommandPayload\``
            _example_: `
              { intentTextCommand: \`start_home\` }
            `
          }
        }
      }
      _return_: {
        name: {
          _type_: string
          _description_: `Page name assigned by the framework.`
          _example_: `"start"`
        }
        callback: {
          _type_: (...payloads: string[]) => string
          _description_: `???`
          _example: `
            // ./pages/start.ts
            ((salt?: string, what?: string) => [salt, what])

            // ./pages/help.ts
            StartPage.data.callback() // "start"
            StartPage.data.callback(\`123\`) // "start:123"
            StartPage.data.callback(\`123\`, \`nothing\`) // "start:123:nothing"
            StartPage.data.callback(undefined, \`nothing\`) // "start:nothing"
          `
        }
        intentText: {
          _type_: string
          _description_: `???`
          _example_: `"start-home"`
        }
        intentTextCommand: {
          _type_: string
          _description_: `???`
          _example_: `"start_home"`
        }
        intentCallback: {
          _type_: string
          _description_: `Callback intent key (may be numeric if \`shortCallbackData\` is enabled).`
          _example_: `"start"`
        }
        _positionPayloadText: {
          _type_: number | undefined
          _description_: `Payload index for \`text\` triggers (max 2 when \`intentText\` contains one space).`
          _example_: undefined
        }
      }
      _best_practices_: [
        `Use "this.buildData(callbackFn)" when you need callback payloads. The callback must return an array (do not define if there is no payload purpose).`,
        `Prefer "intentText + text()" handlers for bottom-keyboard actions in single-language flows.`,
        `If the text input includes payloads (e.g., "start 123"), it routes to "textPayload()". If a command includes payloads (e.g., "/start 123"), it routes to "textCommandPayload()"`,
        `"intentText" applies to both "text()" and "textPayload()" routes; "intentTextCommand" applies to "textCommand()" and "textCommandPayload()" routes`,
        `Do not set "intentText" or "intentTextCommand" unless you need to override the auto-derived intent (it defaults to "this.data.name", based on the filename). You can also change the page filename (e.g., "reset.ts" → "Reset.ts") to alter the derived intent without overriding it`
      ]
      _examples_: [
        {
          _title_: `Basic usage`
          _code_: `this.buildData()`
        },
        {
          _title_: `Callback only with function [RECOMENDED]`
          _code_: `this.buildData((page: string, confirm: string) => [page, confirm])`
        },
        {
          _title_: `Callback only with object`
          _code_: `
            this.buildData({
              callback: (page: string, confirm: string) => [page, confirm]
            })
          `
        },
        {
          _title_: `Callback with intent text in object`
          _code_: `
            this.buildData({ 
              callback: ((page: string, confirm: string) => [page, confirm])
              intentText: \`home\`
            })
          `
        }
      ]
    }
  }
  UserProperties: {
    userId: {
      _type_: number
      _description_: `Telegram user ID from the current update context.`
      _example_: `
        this.userId // 12345678
      `
    }
    userName: {
      _type_: string | undefined
      _description_: `Telegram username from the user profile.`
      _example_: `
        this.userName // \`gramstax_user\`
      `
    }
    userFirstName: {
      _type_: string
      _description_: `User's first name from Telegram profile data.`
      _example_: `
        this.userFirstName // \`Alya\`
      `
    }
    userLastName: {
      _type_: string | undefined
      _description_: `User's last name from Telegram profile data.`
      _example_: `
        this.userLastName // \`Putri\`
      `
    }
    userFullName: {
      _type_: string
      _description_: `Combined first and last name derived from profile fields.`
      _example_: `
        this.userFullName // \`Alya Putri\`
      `
    }
    userLanguage: {
      _type_: string
      _description_: `User language code from Telegram.`
      _example_: `
        this.userLanguage // \`en\`
      `
    }
    userIsPremium: {
      _type_: boolean
      _description_: `True when the user has Telegram Premium.`
      _example_: `
        this.userIsPremium // true
      `
    }
    userIsBot: {
      _type_: boolean
      _description_: `True when the user account is a bot.`
      _example_: `
        this.userIsBot // false
      `
    }
  }
  MessageProperties: {
    msgText: {
      _type_: `string | undefined`
      _description_: `Message text from the current update.`
      _example_: `
        this.msgText // \`Hello\`
      `
    }
    msgTextPayload: {
      _type_: `string | undefined`
      _description_: `First payload token parsed from message text.`
      _example_: `
        this.msgTextPayload // \`123\`
      `
    }
    msgTextPayloads: {
      _type_: `string[]`
      _description_: `All payload tokens parsed from message text.`
      _example_: `
        this.msgTextPayloads // [\`start\`, \`123\`]
      `
    }
    msgCaption: {
      _type_: `string | undefined`
      _description_: `Caption text for media messages.`
      _example_: `
        this.msgCaption // \`Photo caption\`
      `
    }
    msgPhoto: {
      _type_: `string[] | undefined`
      _description_: `Photo sizes attached to the message (string values for docs).`
      _example_: `
        this.msgPhoto // [\`photo-size\`]
      `
    }
    msgVideo: {
      _type_: `string | undefined`
      _description_: `Video payload attached to the message (string placeholder).`
      _example_: `
        this.msgVideo // \`video-id\`
      `
    }
    msgAudio: {
      _type_: `string | undefined`
      _description_: `Audio payload attached to the message (string placeholder).`
      _example_: `
        this.msgAudio // \`audio-id\`
      `
    }
  }
  CallbackProperties: {
    callbackData: {
      _type_: `string | undefined`
      _description_: `Raw callback query data from inline keyboard interactions.`
      _example_: `
        this.callbackData // \`menu:settings:ok\`
      `
    }
    callbackDataPayload: {
      _type_: `string | undefined`
      _description_: `First payload token parsed from callback data.`
      _example_: `
        this.callbackDataPayload // \`settings\`
      `
    }
    callbackDataPayloads: {
      _type_: `string[]`
      _description_: `All payload tokens parsed from callback data.`
      _example_: `
        this.callbackDataPayloads // [\`settings\`, \`ok\`]
      `
    }
  }
  SessionMethods: {
    sessionGet: {
      _description_: `Get current session data.`
      _return_: {
        _type_: `Promise<any>`
        _description_: `Resolves with stored session payload or undefined.`
      }
      _example_: `
        await this.sessionGet() // { method: \`text\`, params: { id: \`123\` } }
      `
    }
    sessionSet: {
      _description_: `Set session data for a route.`
      _args_: {
        method: {
          _type_: `string`
          _description_: `Session method name (route handler).`
        }
        params?: {
          _type_: `any`
          _description_: `Optional session parameters.`
        }
      }
      _return_: {
        _type_: `Promise<boolean>`
        _description_: `Resolves with operation result.`
      }
      _example_: `
        await this.sessionSet(\`text\`, { id: \`123\` }) // true
      `
    }
    sessionClear: {
      _description_: `Clear current session.`
      _return_: {
        _type_: `Promise<boolean>`
        _description_: `Resolves with operation result.`
      }
      _example_: `
        await this.sessionClear() // true
      `
    }
    sessionCallback: {
      _description_: `Set session for callback route.`
      _args_: {
        params?: {
          _type_: `any`
          _description_: `Optional session parameters.`
        }
        name?: {
          _type_: `string`
          _description_: `Optional page name override.`
        }
      }
      _return_: {
        _type_: `Promise<boolean>`
        _description_: `Resolves with operation result.`
      }
      _example_: `
        await this.sessionCallback({ action: \`next\` }) // true
      `
    }
    sessionCallbackPayload: {
      _description_: `Set session for callbackPayload route.`
      _args_: {
        params?: {
          _type_: `any`
          _description_: `Optional session parameters.`
        }
        name?: {
          _type_: `string`
          _description_: `Optional page name override.`
        }
      }
      _return_: {
        _type_: `Promise<boolean>`
        _description_: `Resolves with operation result.`
      }
      _example_: `
        await this.sessionCallbackPayload({ id: \`123\` }) // true
      `
    }
    sessionText: {
      _description_: `Set session for text route.`
      _args_: {
        params?: {
          _type_: `any`
          _description_: `Optional session parameters.`
        }
        name?: {
          _type_: `string`
          _description_: `Optional page name override.`
        }
      }
      _return_: {
        _type_: `Promise<boolean>`
        _description_: `Resolves with operation result.`
      }
      _example_: `
        await this.sessionText({ step: \`name\` }) // true
      `
    }
    sessionTextPayload: {
      _description_: `Set session for textPayload route.`
      _args_: {
        params?: {
          _type_: `any`
          _description_: `Optional session parameters.`
        }
        name?: {
          _type_: `string`
          _description_: `Optional page name override.`
        }
      }
      _return_: {
        _type_: `Promise<boolean>`
        _description_: `Resolves with operation result.`
      }
      _example_: `
        await this.sessionTextPayload({ id: \`123\` }) // true
      `
    }
    sessionTextFree: {
      _description_: `Set session for textFree route.`
      _args_: {
        params?: {
          _type_: `any`
          _description_: `Optional session parameters.`
        }
        name?: {
          _type_: `string`
          _description_: `Optional page name override.`
        }
      }
      _return_: {
        _type_: `Promise<boolean>`
        _description_: `Resolves with operation result.`
      }
      _example_: `
        await this.sessionTextFree({ note: \`any\` }) // true
      `
    }
  }
  ReplyMethods: {
    reply: {
      _description_: `Send a text message reply.`
      _args_: {
        keyboard?: {
          _type_: `string`
          _description_: `Keyboard markup (inline or bottom).`
        }
        data?: {
          _type_: `object`
          _description_: `Template data for interpolation.`
        }
        baseId?: {
          _type_: `string`
          _description_: `Template base ID (default \`default\`).`
        }
        options?: {
          _type_: `string`
          _description_: `Reply options (string placeholder).`
        }
      }
      _return_: {
        _type_: `Promise<Message>`
        _description_: `Resolves with sent message (id placeholder).`
      }
      _example_: `
        await this.reply() // Message
      `
    }
    replyPhoto: {
      _description_: `Send a photo message.`
      _args_: {
        keyboard?: {_type_: `string`; _description_: `Keyboard markup.`}
        data?: {_type_: `object`; _description_: `Template data.`}
        baseId?: {_type_: `string`; _description_: `Template base ID.`}
        options?: {_type_: `string`; _description_: `Photo reply options.`}
      }
      _return_: {_type_: `Promise<Message>`; _description_: `Resolves with sent message.`}
      _example_: `
        await this.replyPhoto() // Message
      `
    }
    replyVideo: {
      _description_: `Send a video message.`
      _args_: {
        keyboard?: {_type_: `string`; _description_: `Keyboard markup.`}
        data?: {_type_: `object`; _description_: `Template data.`}
        baseId?: {_type_: `string`; _description_: `Template base ID.`}
        options?: {_type_: `string`; _description_: `Video reply options.`}
      }
      _return_: {_type_: `Promise<Message>`; _description_: `Resolves with sent message.`}
      _example_: `
        await this.replyVideo() // Message
      `
    }
    replyAudio: {
      _description_: `Send an audio message.`
      _args_: {
        keyboard?: {_type_: `string`; _description_: `Keyboard markup.`}
        data?: {_type_: `object`; _description_: `Template data.`}
        baseId?: {_type_: `string`; _description_: `Template base ID.`}
        options?: {_type_: `string`; _description_: `Audio reply options.`}
      }
      _return_: {_type_: `Promise<Message>`; _description_: `Resolves with sent message.`}
      _example_: `
        await this.replyAudio() // Message
      `
    }
    replyDocument: {
      _description_: `Send a document message.`
      _args_: {
        keyboard?: {_type_: `string`; _description_: `Keyboard markup.`}
        data?: {_type_: `object`; _description_: `Template data.`}
        baseId?: {_type_: `string`; _description_: `Template base ID.`}
        options?: {_type_: `string`; _description_: `Document reply options.`}
      }
      _return_: {_type_: `Promise<Document>`; _description_: `Resolves with sent message.`}
      _example_: `
        await this.replyDocument() // Message
      `
    }
    replyAnimation: {
      _description_: `Send an animation/GIF.`
      _args_: {
        keyboard?: {_type_: `string`; _description_: `Keyboard markup.`}
        data?: {_type_: `object`; _description_: `Template data.`}
        baseId?: {_type_: `string`; _description_: `Template base ID.`}
        options?: {_type_: `string`; _description_: `Animation reply options.`}
      }
      _return_: {_type_: `Promise<Animation>`; _description_: `Resolves with sent message.`}
      _example_: `
        await this.replyAnimation() // Message
      `
    }
    replyVoice: {
      _description_: `Send a voice message.`
      _args_: {
        keyboard?: {_type_: `string`; _description_: `Keyboard markup.`}
        data?: {_type_: `object`; _description_: `Template data.`}
        baseId?: {_type_: `string`; _description_: `Template base ID.`}
        options?: {_type_: `string`; _description_: `Voice reply options.`}
      }
      _return_: {_type_: `Promise<Voice>`; _description_: `Resolves with sent message.`}
      _example_: `
        await this.replyVoice() // Message
      `
    }
    replyVideoNote: {
      _description_: `Send a video note.`
      _args_: {
        keyboard?: {_type_: `string`; _description_: `Keyboard markup.`}
        data?: {_type_: `object`; _description_: `Template data.`}
        baseId?: {_type_: `string`; _description_: `Template base ID.`}
        options?: {_type_: `string`; _description_: `Video note reply options.`}
      }
      _return_: {_type_: `Promise<VideoNotes>`; _description_: `Resolves with sent message.`}
      _example_: `
        await this.replyVideoNote() // Message
      `
    }
    replySticker: {
      _description_: `Send a sticker.`
      _args_: {
        keyboard?: {_type_: `string`; _description_: `Keyboard markup.`}
        data?: {_type_: `object`; _description_: `Template data.`}
        baseId?: {_type_: `string`; _description_: `Template base ID.`}
        options?: {_type_: `string`; _description_: `Sticker reply options.`}
      }
      _return_: {_type_: `Promise<Message>`; _description_: `Resolves with sent message.`}
      _example_: `
        await this.replySticker() // Message
      `
    }
    replyLocation: {
      _description_: `Send a location.`
      _args_: {
        keyboard?: {_type_: `string`; _description_: `Keyboard markup.`}
        data?: {_type_: `object`; _description_: `Template data.`}
        baseId?: {_type_: `string`; _description_: `Template base ID.`}
        options?: {_type_: `string`; _description_: `Location reply options.`}
      }
      _return_: {_type_: `Promise<Message>`; _description_: `Resolves with sent message.`}
      _example_: `
        await this.replyLocation() // Message
      `
    }
    replyContact: {
      _description_: `Send a contact.`
      _args_: {
        keyboard?: {_type_: `string`; _description_: `Keyboard markup.`}
        data?: {_type_: `object`; _description_: `Template data.`}
        baseId?: {_type_: `string`; _description_: `Template base ID.`}
        options?: {_type_: `string`; _description_: `Contact reply options.`}
      }
      _return_: {_type_: `Promise<Message>`; _description_: `Resolves with sent message.`}
      _example_: `
        await this.replyContact() // Message
      `
    }
  }
  EditMethods: {
    edit: {
      _description_: `Edit the current message text.`
      _args_: {
        keyboard?: {_type_: `string`; _description_: `Inline keyboard markup.`}
        data?: {_type_: `object`; _description_: `Template data.`}
        baseId?: {_type_: `string`; _description_: `Template base ID.`}
        options?: {_type_: `string`; _description_: `Edit options.`}
      }
      _return_: {_type_: `Promise<Message>`; _description_: `Resolves with edited message.`}
      _example_: `
        await this.edit() // Message
      `
    }
    editPhoto: {
      _description_: `Edit media to photo.`
      _args_: {
        keyboard?: {_type_: `string`; _description_: `Inline keyboard markup.`}
        data?: {_type_: `object`; _description_: `Template data.`}
        baseId?: {_type_: `string`; _description_: `Template base ID.`}
        options?: {_type_: `string`; _description_: `Edit options.`}
      }
      _return_: {_type_: `Promise<Message>`; _description_: `Resolves with edited message.`}
      _example_: `
        await this.editPhoto() // Message
      `
    }
    editVideo: {
      _description_: `Edit media to video.`
      _args_: {
        keyboard?: {_type_: `string`; _description_: `Inline keyboard markup.`}
        data?: {_type_: `object`; _description_: `Template data.`}
        baseId?: {_type_: `string`; _description_: `Template base ID.`}
        options?: {_type_: `string`; _description_: `Edit options.`}
      }
      _return_: {_type_: `Promise<Message>`; _description_: `Resolves with edited message.`}
      _example_: `
        await this.editVideo() // Message
      `
    }
    editAudio: {
      _description_: `Edit media to audio.`
      _args_: {
        keyboard?: {_type_: `string`; _description_: `Inline keyboard markup.`}
        data?: {_type_: `object`; _description_: `Template data.`}
        baseId?: {_type_: `string`; _description_: `Template base ID.`}
        options?: {_type_: `string`; _description_: `Edit options.`}
      }
      _return_: {_type_: `Promise<Message>`; _description_: `Resolves with edited message.`}
      _example_: `
        await this.editAudio() // Message
      `
    }
    editDocument: {
      _description_: `Edit media to document.`
      _args_: {
        keyboard?: {_type_: `string`; _description_: `Inline keyboard markup.`}
        data?: {_type_: `object`; _description_: `Template data.`}
        baseId?: {_type_: `string`; _description_: `Template base ID.`}
        options?: {_type_: `string`; _description_: `Edit options.`}
      }
      _return_: {_type_: `Promise<Message>`; _description_: `Resolves with edited message.`}
      _example_: `
        await this.editDocument() // Message
      `
    }
    editAnimation: {
      _description_: `Edit media to animation.`
      _args_: {
        keyboard?: {_type_: `string`; _description_: `Inline keyboard markup.`}
        data?: {_type_: `object`; _description_: `Template data.`}
        baseId?: {_type_: `string`; _description_: `Template base ID.`}
        options?: {_type_: `string`; _description_: `Edit options.`}
      }
      _return_: {_type_: `Promise<Message>`; _description_: `Resolves with edited message.`}
      _example_: `
        await this.editAnimation() // Message
      `
    }
  }
  OtherMethods: {
    delete: {
      _description_: `Delete the current message.`
      _return_: {
        _type_: `Promise<boolean>`
        _description_: `Resolves with operation result.`
      }
      _example_: `
        await this.delete() // true
      `
    }
    callbackQueryAnswer: {
      _description_: `Answer callback query (toast).`
      _args_: {
        options?: {
          _type_: `object`
          _description_: `Options for answerCallbackQuery.`
        }
      }
      _return_: {
        _type_: `Promise<boolean | null>`
        _description_: `Resolves with result or null on error.`
      }
      _example_: `
        await this.callbackQueryAnswer({ text: \`Saved\` }) // true
      `
    }
    inlineKeyboard: {
      _description_: `Create inline keyboard using builder pattern.`
      _args_: {
        builder: {
          _type_: `(kb: any, labels: string[]) => any`
          _description_: `Builder callback receiving keyboard and labels.`
        }
      }
      _return_: {
        _type_: `any`
        _description_: `Inline keyboard instance.`
      }
      _example_: `
        this.inlineKeyboard((k, a) => k.text(a[0]!, \`action1\`))
      `
    }
    bottomKeyboard: {
      _description_: `Create bottom keyboard using builder pattern.`
      _args_: {
        builder: {
          _type_: `(kb: any, labels: string[]) => any`
          _description_: `Builder callback receiving keyboard and labels.`
        }
      }
      _return_: {
        _type_: `any`
        _description_: `Bottom keyboard instance.`
      }
      _example_: `
        this.bottomKeyboard((k, a) => k.text(a[0]!))
      `
    }
    to: {
      _description_: `Transition to another page.`
      _args_: {
        data?: {
          _type_: `object`
          _description_: `Optional data to pass.`
        }
      }
      _return_: {
        _type_: `Promise<void>`
        _description_: `Resolves after transition.`
      }
      _example_: `
        await new HomePage(this).to({ inputName: \`test\` })
      `
    }
  }
}
