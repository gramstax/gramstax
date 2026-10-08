import {MockTelegramServer} from "gramstax"

const server = new MockTelegramServer({port: 56660})
await server.start()

process.stdout.write(`mock telegram ready at ${server.apiRoot}\n`)