import {PageBase} from "~/base/page"
import {StartPage} from "~/pages/start"

class Base {
  static index = `i`
  static dynamic = `dynamic-attribute`
}

class Helper {
  static kb(ctx: StartTestAnimationPage, isDynamic = false) {
    return ctx.inlineKeyboard(
      (k, l) => {
        return k //
          .text(isDynamic ? l[1]! : l[0]!, ctx.data.callbackQueryData(isDynamic ? `static` : `dynamic`))
          .row()
          .text(l[2]!, StartPage.data.callbackQueryData(`3`)) // It doesn't have to be "3" and can be filled in with anything. This will automatically enter the `handleArgsCallbackQueryData` route. Why is it filled in? Because the media method doesn't support editing via editMessageText.
      },
      {AGBaseId: Base.index}
    )
  }
}

export class StartTestAnimationPage extends PageBase {
  static data = this.buildData((swc?: string) => [swc])

  async handleCallbackQueryData() {
    await this.gindex.show()
  }

  async handleArgsCallbackQueryData() {
    await this.gdynamic.show()
  }

  gindex = {
    show: async () => {
      const bi = Base.index
      const kb = Helper.kb(this)
      await this.renderEditAnimation(kb, {}, bi)
    }
  }
  gdynamic = {
    show: async () => {
      const swc = this.callbackQueryDataArg
      if (swc === `static`) {
        await this.handleCallbackQueryData()
      } else if (swc === `dynamic`) {
        const bi = Base.dynamic
        const kb = Helper.kb(this, true)
        const da = {
          src: `https://www.easygifanimator.net/images/samples/eglite.gif` // Assuming is that the src value is a dynamic thing that is obtained from input or something else like a database.
        }
        await this.renderEditAnimation(kb, da, bi)
      }
    }
  }

  static template = `
    <g-base id="${Base.index}">
      <g-keyboard type="inline">🧩 Dynamic Attr, 📌 Static Attr, ${this.kbl.back.default}</g-keyboard>
      <g-keyboard type="inline" lang="id">🧩 Dynamic Attr, 📌 Static Attr, ${this.kbl.back.id}</g-keyboard>
      <g-media type="animation" src="https://www.easygifanimator.net/images/samples/eglite.gif">
        🎞️ Animation demo
        
        This animation shows a static media source with caption.
      </g-media>
      <g-media lang="id" type="animation" src="https://www.easygifanimator.net/images/samples/eglite.gif">
        🎞️ Demo animasi
        
        Animasi ini menunjukkan sumber media statis dengan caption.
      </g-media>
    </g-base>
    <g-base id="${Base.dynamic}">
      <g-media type="animation" src="{{src}}">
        🧩 Dynamic attribute demo

        Supports dynamic variables and exec in attributes (except lang/type) for &lt;media&gt; blocks.

        This is a caption text for media <b>animation</b>.
      </g-media>
      <g-media lang="id" type="animation" src="{{src}}">
        🧩 Demo atribut dinamis

        Mendukung variabel dinamis dan exec di atribut (kecuali lang/type) untuk blok &lt;media&gt;.

        Ini adalah caption text untuk media <b>animasi</b>.
      </g-media>
    </g-base>
  `
}
