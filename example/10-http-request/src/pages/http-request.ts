import {PageBase} from "~/base/page"
import {HttpService, type IHttpResponse} from "~/services/http"
import {StartPage} from "./start"

class Base {
  static method = `s-method`
  static url = `s-url`
  static token = `s-token`
  static body = `s-body`
  static success = `s-success`
  static warnInvalid = `w-invalid`
  static warnNetwork = `w-network`
}

// HTTP Request page with multi-step flow: method selection → URL input → body input (if needed) → result.
export class HttpRequestPage extends PageBase {
  static data = this.buildData((action: string) => [action])

  async handleCallbackQueryData() {
    await this.gmethod.show()
  }

  async handleArgsCallbackQueryData() {
    const [action] = this.callbackQueryDataArgs
    if (!action) return
    if (action === `_back`) {
      await this.gmethod.show()
    } else if (action === `skip_token`) {
      await this.gtoken.process(null)
    } else if (action === `toggle_view`) {
      await this.gsuccess.process()
    } else {
      await this.gurl.show(action)
    }
  }

  // Session twin of handleArgsCallbackQueryData: while a flow session is
  // active, callback args arrive here via session routing (id=1) so the
  // pending session survives for gtoken/gsuccess to read it.
  async handleSessionArgsCallbackQueryData() {
    await this.handleArgsCallbackQueryData()
  }

  async handleSessionFreeText() {
    const input = this.msg!.text!.trim()
    const sparams = this.temp.session?.params
    const step = sparams?.httpStep as string | undefined
    if (!step || step === `method` || step === `done`) {
      await this.gurl.process(input, `GET`)
    } else if (step === `url`) {
      await this.gurl.process(input, sparams?.httpMethod as string, true)
    } else if (step === `token`) {
      await this.gtoken.process(input)
    } else if (step === `body`) {
      await this.gbody.process(input)
    }
  }

  helper = {
    // Binds the flow to both session listeners (text + callback args) so that
    // continuation callbacks (skip_token, toggle_view, _back) route through
    // session routing (id=1) — the auto session-clear on non-session handlers
    // never wipes the in-flight flow state.
    setFlowSession: (params: Record<string, unknown>) => {
      return this.setSession([this.methodSessionFreeText(), this.methodSessionArgsCallbackQueryData()], params)
    },
    escapeHtml: (text: string) => {
      return text.replace(/&/g, `&amp;`).replace(/</g, `&lt;`).replace(/>/g, `&gt;`)
    },
    formatHeaders: (headers: Record<string, string>, limit = 10) => {
      const entries = Object.entries(headers)
      const shown = entries.slice(0, limit)
      const lines = shown.map(([key, value]) => `  <code>${this.helper.escapeHtml(key)}: ${this.helper.escapeHtml(value)}</code>`)
      if (entries.length > limit) {
        lines.push(`  ... and ${entries.length - limit} more`)
      }
      return lines.join(`\n`)
    },
    formatBody: (body: string) => {
      const truncated = body.length > 200 ? `${body.slice(0, 200)}\n... [${body.length} total chars]` : body
      return this.helper.escapeHtml(truncated)
    },
    renderBody: (result: IHttpResponse, viewMode: string) => {
      if (viewMode === `raw`) {
        return this.helper.formatBody(result.rawBody)
      }
      const prettyBody = result.contentType.includes(`application/json`) ? HttpService.formatJson(result.rawBody) : result.rawBody
      return this.helper.formatBody(prettyBody)
    },
    buildMethodKeyboard: () => {
      return this.inlineKeyboardT(
        [
          HttpRequestPage.data.callbackQueryData(`GET`), //
          HttpRequestPage.data.callbackQueryData(`POST`),
          HttpRequestPage.data.callbackQueryData(`PUT`),
          HttpRequestPage.data.callbackQueryData(`DELETE`),
          HttpRequestPage.data.callbackQueryData(`PATCH`),
          StartPage
        ],
        `3`,
        Base.method
      )
    },
    buildUrlKeyboard: () => {
      return this.inlineKeyboardT([this.data.callbackQueryData(`_back`), StartPage], `2`, Base.url)
    },
    buildBodyKeyboard: () => {
      return this.inlineKeyboardT([this.data.callbackQueryData(`_back`), StartPage], `2`, Base.body)
    },
    buildTokenKeyboard: () => {
      return this.inlineKeyboardT([this.data.callbackQueryData(`skip_token`), StartPage], `2`, Base.token)
    },
    buildHomeKeyboard: () => {
      return this.inlineKeyboardT([StartPage], `1`, Base.warnNetwork)
    },
    buildSuccessKeyboard: (viewMode: string) => {
      const toggleLabel = viewMode === `formatted` ? `🔁 Raw` : `🔁 Formatted`
      return this.inlineKeyboardT([this.data.callbackQueryData(`toggle_view`), StartPage], `2`, Base.success, {toggleLabel})
    }
  }
  gmethod = {
    show: async () => {
      await this.clearSession()
      await this.renderText({AGBaseId: Base.method, keyboard: this.helper.buildMethodKeyboard()})
    },
    process: () => {}
  }
  gurl = {
    show: async (method: string) => {
      await this.helper.setFlowSession({httpStep: `url`, httpMethod: method})
      await this.renderText({AGBaseId: Base.url, keyboard: this.helper.buildUrlKeyboard(), data: {method}})
    },
    process: async (input: string, method: string, showToken = false) => {
      if (!HttpService.isValidUrl(input)) {
        await this.renderText({AGBaseId: Base.warnInvalid, keyboard: this.helper.buildUrlKeyboard(), data: {url: this.helper.escapeHtml(input)}})
        return
      }

      if (showToken) {
        await this.gtoken.show(method, input)
      } else if (HttpService.needsBody(method)) {
        await this.gbody.show(method, input)
      } else {
        try {
          const result = await HttpService.request(method, input)
          await this.helper.setFlowSession({httpStep: `done`, httpResult: result, httpViewMode: `formatted`})
          await this.gsuccess.show(result, `formatted`)
        } catch (error) {
          await this.clearSession()
          const message = error instanceof Error ? error.message : String(error)
          await this.gwarnNetwork.show(input, message)
        }
      }
    }
  }
  gtoken = {
    show: async (method: string, url: string) => {
      await this.helper.setFlowSession({httpStep: `token`, httpMethod: method, httpUrl: url})
      await this.renderText({AGBaseId: Base.token, keyboard: this.helper.buildTokenKeyboard(), data: {method, url: this.helper.escapeHtml(url)}})
    },
    process: async (token: string | null) => {
      const session = await this.getSession()
      const method = session?.params?.httpMethod as string
      const url = session?.params?.httpUrl as string
      if (!method || !url) {
        return await this.gmethod.show()
      }

      if (HttpService.needsBody(method)) {
        await this.helper.setFlowSession({httpStep: `body`, httpMethod: method, httpUrl: url, httpToken: token})
        await this.gbody.show(method, url)
      } else {
        const headers: Record<string, string> = {}
        if (token) {
          headers.Authorization = `Bearer ${token}`
        }
        try {
          const result = await HttpService.request(method, url, undefined, headers)
          await this.helper.setFlowSession({httpStep: `done`, httpResult: result, httpViewMode: `formatted`})
          await this.gsuccess.show(result, `formatted`)
        } catch (error) {
          await this.clearSession()
          const msg = error instanceof Error ? error.message : String(error)
          await this.gwarnNetwork.show(url, msg)
        }
      }
    }
  }
  gbody = {
    show: async (method: string, url: string) => {
      await this.helper.setFlowSession({httpStep: `body`, httpMethod: method, httpUrl: url})
      await this.renderText({AGBaseId: Base.body, keyboard: this.helper.buildBodyKeyboard(), data: {method, url: this.helper.escapeHtml(url)}})
    },
    process: async (body: string) => {
      const session = await this.getSession()
      const method = session?.params?.httpMethod as string
      const url = session?.params?.httpUrl as string
      const token = session?.params?.httpToken as string | undefined
      if (!url) {
        return await this.gmethod.show()
      }

      const headers: Record<string, string> = {}
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }
      try {
        const result = await HttpService.request(method, url, body, headers)
        await this.helper.setFlowSession({httpStep: `done`, httpResult: result, httpViewMode: `formatted`})
        await this.gsuccess.show(result, `formatted`)
      } catch (error) {
        await this.clearSession()
        const message = error instanceof Error ? error.message : String(error)
        await this.gwarnNetwork.show(url, message)
      }
    }
  }
  gsuccess = {
    show: async (result: IHttpResponse, viewMode = `formatted`) => {
      const emoji = result.status >= 200 && result.status < 300 ? `✅` : result.status >= 400 ? `❌` : `⚠️`
      const headersText = this.helper.formatHeaders(result.headers)
      const bodyPreview = this.helper.renderBody(result, viewMode)
      await this.renderText({
        AGBaseId: Base.success,
        keyboard: this.helper.buildSuccessKeyboard(viewMode),
        data: {
          status: result.status,
          statusText: result.statusText,
          duration: result.duration,
          method: result.method,
          emoji,
          headersText,
          bodyPreview
        }
      })
    },
    process: async () => {
      const session = await this.getSession()
      const result = session?.params?.httpResult as IHttpResponse | undefined
      if (!result) return
      const currentView = (session?.params?.httpViewMode as string) || `formatted`
      const newView = currentView === `formatted` ? `raw` : `formatted`
      await this.helper.setFlowSession({...session?.params, httpViewMode: newView})
      await this.gsuccess.show(result, newView)
    }
  }
  gwarnInvalid = {
    show: async (url: string) => {
      await this.renderText({AGBaseId: Base.warnInvalid, keyboard: this.helper.buildUrlKeyboard(), data: {url: this.helper.escapeHtml(url)}})
    },
    process: () => {}
  }
  gwarnNetwork = {
    show: async (url: string, errorMessage: string) => {
      await this.renderText({AGBaseId: Base.warnNetwork, keyboard: this.helper.buildHomeKeyboard(), data: {url: this.helper.escapeHtml(url), errorMessage: this.helper.escapeHtml(errorMessage)}})
    },
    process: () => {}
  }

  static template = `
    <g-base id="${Base.method}">
      <g-keyboard type="inline">GET, POST, PUT, DELETE, PATCH, ✖️ Cancel</g-keyboard>
      <g-keyboard type="inline" lang="id">GET, POST, PUT, DELETE, PATCH, ✖️ Batal</g-keyboard>
      <g-message>
        🌐 New HTTP Request

        Select an HTTP method:
      </g-message>
      <g-message lang="id">
        🌐 Permintaan HTTP Baru

        Pilih metode HTTP:
      </g-message>
    </g-base>

    <g-base id="${Base.url}">
      <g-keyboard type="inline">⬅️ Back, ✖️ Cancel</g-keyboard>
      <g-keyboard type="inline" lang="id">⬅️ Kembali, ✖️ Batal</g-keyboard>
      <g-message>
        🌐 {{method}} Request

        Send me a valid URL (starting with http:// or https://) and I will fetch it.

        Example: https://jsonplaceholder.typicode.com/posts/1
      </g-message>
      <g-message lang="id">
        🌐 Permintaan {{method}}

        Kirim URL yang valid (diawali dengan http:// atau https://) dan saya akan mengambilnya.

        Contoh: https://jsonplaceholder.typicode.com/posts/1
      </g-message>
    </g-base>

    <g-base id="${Base.token}">
      <g-keyboard type="inline">⏭️ Skip, ✖️ Cancel</g-keyboard>
      <g-keyboard type="inline" lang="id">⏭️ Lewati, ✖️ Batal</g-keyboard>
      <g-message>
        🔑 Bearer Token (optional)

        Method: {{method}}
        URL: <code>{{url}}</code>

        Send me a Bearer token, or tap Skip to continue without one.
      </g-message>
      <g-message lang="id">
        🔑 Token Bearer (opsional)

        Metode: {{method}}
        URL: <code>{{url}}</code>

        Kirim token Bearer, atau ketuk Lewati untuk melanjutkan tanpa token.
      </g-message>
    </g-base>

    <g-base id="${Base.body}">
      <g-keyboard type="inline">⬅️ Back, ✖️ Cancel</g-keyboard>
      <g-keyboard type="inline" lang="id">⬅️ Kembali, ✖️ Batal</g-keyboard>
      <g-message>
        📝 {{method}} Request Body

        URL: <code>{{url}}</code>

        Send me the request body as JSON:
      </g-message>
      <g-message lang="id">
        📝 Isi Permintaan {{method}}

        URL: <code>{{url}}</code>

        Kirim isi permintaan sebagai JSON:
      </g-message>
    </g-base>

    <g-base id="${Base.success}">
      <g-keyboard type="inline">{{toggleLabel}}, 🏠 Home</g-keyboard>
      <g-keyboard type="inline" lang="id">{{toggleLabel}}, 🏠 Beranda</g-keyboard>
      <g-message>
        {{emoji}} [{{method}}] {{status}} {{statusText}}

        ⏱ {{duration}}ms

        📋 Headers:
        {{headersText}}

        📄 Body:
        <pre>{{{bodyPreview}}}</pre>
      </g-message>
      <g-message lang="id">
        {{emoji}} [{{method}}] {{status}} {{statusText}}

        ⏱ {{duration}}ms

        📋 Header:
        {{headersText}}

        📄 Isi:
        <pre>{{{bodyPreview}}}</pre>
      </g-message>
    </g-base>

    <g-base id="${Base.warnInvalid}">
      <g-keyboard type="inline">⬅️ Back, ✖️ Cancel</g-keyboard>
      <g-keyboard type="inline" lang="id">⬅️ Kembali, ✖️ Batal</g-keyboard>
      <g-message>
        ⚠️ Invalid URL

        The URL you sent does not appear to be valid. Make sure it starts with http:// or https://.

        You sent: <code>{{url}}</code>
      </g-message>
      <g-message lang="id">
        ⚠️ URL Tidak Valid

        URL yang Anda kirim tampaknya tidak valid. Pastikan diawali dengan http:// atau https://.

        Anda mengirim: <code>{{url}}</code>
      </g-message>
    </g-base>
    
    <g-base id="${Base.warnNetwork}">
      ${this.kbk.home()}
      <g-message>
        ❌ Request Failed

        Could not reach the URL. Please check the address and try again.

        URL: <code>{{url}}</code>

        Error: {{errorMessage}}
      </g-message>
      <g-message lang="id">
        ❌ Permintaan Gagal

        Tidak dapat menjangkau URL. Periksa alamat dan coba lagi.

        URL: <code>{{url}}</code>

        Galat: {{errorMessage}}
      </g-message>
    </g-base>
  `
}
