import {open} from "lmdb"

const db = open({
  path: `./database`,
  compression: true
})

// for (const data of db.getRange()) {
//   console.log(data)
// }

// for (const key of db.getKeys()) {
//   console.log(key)
// }

// console.time(`tx`)
// db.transactionSync(() => {
//   const now = Date.now()
//   for (let i = 0; i < 1_000_000; i++) {
//     const id = String(i + 1).padStart(14, `0`)
//     db.put(`user:840754970:item:${id}`, {
//       title: `Makan Malam`,
//       description: `Jam 18:00 + Semua`,
//       updatedAt: now,
//       createdAt: now
//     })
//   }
// })
// console.timeEnd(`tx`)

// const keys = []
// for (let i = 0; i < 1_000_000; i++) {
//   const id = String(i + 1).padStart(14, `0`)
//   keys[i] = `user:840754970:item:${id}`
// }

// console.time(`tx`)
// const range = db.getKeys({
//   start: `user:840754970:item:`,
//   end: `user:840754970:item:\uffff`,
//   limit: 5,
//   offset: 2,
//   reverse: false
// })
// for (const data of range) {
//   console.log(data)
// }
// console.timeEnd(`tx`)

// const res = db.getKeysCount({
//   start: `user:840754970:item:`,
//   end: `user:840754970:item:\uffff`
// })
// console.log(res)

// const res = db.getRange({
//   start: `user:840754970:item:\uffff`,
//   end: `user:840754970:item:`,
//   reverse: true,
//   limit: 1
// })
// for (const data of res) {
//   console.log(data)
// }
