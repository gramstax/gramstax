import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static step1 = `s1`
  static dynamicAttr = `dynamic-attribute`
}

class Helper {
  static kb(ctx: TestAnimationPage, isDynamic = false) {
    return ctx.inlineKeyboard((k, l) => {
      return k //
        .text(isDynamic ? l[1] : l[0]!, ctx.data.callbackData(isDynamic ? `static` : `dynamic`))
        .row()
        .text(l[2]!, StartPage.data.callbackData(`3`)) // It doesn't have to be "3" and can be filled in with anything. This will automatically enter the `handleArgsCallbackData` route. Why is it filled in? Because the media method doesn't support editing via editMessageText.
    })
  }
}

class Main {
  static async showStep1Form(ctx: TestAnimationPage) {
    const bi = Base.step1
    const kb = Helper.kb(ctx)
    const da = {}
    await ctx.editAnimation(kb, da, bi)
  }

  static async processStep1Answer(ctx: TestAnimationPage) {
    const swc = ctx.callbackDataArg
    if (swc == `static`) {
      await ctx.handleCallbackData()
    } else if (swc == `dynamic`) {
      const bi = Base.dynamicAttr
      const kb = Helper.kb(ctx, true)
      const da = {
        src: `https://www.easygifanimator.net/images/samples/eglite.gif` // Assuming is that the src value is a dynamic thing that is obtained from input or something else like a database.
      }
      await ctx.editAnimation(kb, da, bi)
    }
  }
}

export class TestAnimationPage extends PageBase {
  static data = this.buildData((swc?: string) => [swc])

  async handleCallbackData() {
    await Main.showStep1Form(this)
  }

  async handleArgsCallbackData() {
    await Main.processStep1Answer(this)
  }

  static template = `
    <base id="${Base.step1}">
      <keyboard>🧩 Dynamic Attr, 📌 Static Attr, ${this.kbl.back.default}</keyboard>
      <keyboard lang="id">🧩 Dynamic Attr, 📌 Static Attr, ${this.kbl.back.id}</keyboard>
      <media type="animation" src="https://www.easygifanimator.net/images/samples/eglite.gif">
        🎞️ Animation demo
        
        This animation shows a static media source with caption.
      </media>
      <media lang="id" type="animation" src="https://www.easygifanimator.net/images/samples/eglite.gif">
        🎞️ Demo animasi
        
        Animasi ini menunjukkan sumber media statis dengan caption.
      </media>
    </base>
    
    <base id="${Base.dynamicAttr}">
      <media type="animation" src="{{src}}">
        🧩 Dynamic attribute demo

        Supports dynamic variables and exec in attributes (except lang/type) for &lt;media&gt; blocks.

        This is a caption text for media <b>animation</b>.
      </media>
      <media lang="id" type="animation" src="{{src}}">
        🧩 Demo atribut dinamis

        Mendukung variabel dinamis dan exec di atribut (kecuali lang/type) untuk blok &lt;media&gt;.

        Ini adalah caption text untuk media <b>animasi</b>.
      </media>
    </base>
  `
}
