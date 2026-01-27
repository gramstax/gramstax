type MockTelegramServer = {
  apiRoot: string
  close: () => void
}

const jsonResponse = (data: unknown) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: {"Content-Type": "application/json"}
  })

export const createMockTelegramServer = (token: string): MockTelegramServer => {
  const basePath = `/bot${token}`
  const server = Bun.serve({
    port: 0,
    fetch(req) {
      const {pathname} = new URL(req.url)
      if (!pathname.startsWith(basePath)) {
        return new Response(`Not found`, {status: 404})
      }

      const method = pathname.slice(basePath.length + 1)
      switch (method) {
        case `getMe`:
          return jsonResponse({
            ok: true,
            result: {
              id: 123456789,
              is_bot: true,
              first_name: `Mock`,
              username: `mock_gramstax_bot`
            }
          })
        case `getUpdates`:
          return jsonResponse({ok: true, result: []})
        case `getMyCommands`:
          return jsonResponse({ok: true, result: []})
        case `setMyCommands`:
          return jsonResponse({ok: true, result: true})
        case `setWebhook`:
          return jsonResponse({ok: true, result: true})
        case `getWebhookInfo`:
          return jsonResponse({ok: true, result: {url: ``}})
        default:
          return jsonResponse({ok: true, result: true, method})
      }
    }
  })

  const apiRoot = `http://127.0.0.1:${server.port}`
  return {
    apiRoot,
    close: () => server.stop()
  }
}
