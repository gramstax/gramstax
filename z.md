Tambahkan informasi tentang folder folder ./src di project ke dalam AGENTS.md, di bawah adalah informasi nya.

Minimal folder yg harus ada di setiap project bot :

- ./base = berisi file abstract class yg akan digunakan oleh class lain, seperti page.ts dengan isi CtxCore (./core/ctx.ts).
- ./components = berisi file components template string seperti <keyboard> di class KeyboardComponent (./components/keyboard.ts).
- ./core = berisi file core, wajib ada ctx.ts dan bot.ts.
- ./data = berisi file data seperti KeyboardData (./data/keyboard.ts) yg akan digunakan oleh KeyboardComponents (./components/keyboard.ts). bisa di tambah file lain asal relevant.
- ./guards = berisi file guard sebelum melanjutkan nya ke hal lain, contoh kegunaan nya untuk memvalidasi user di banned atau tidak, untuk melakukan overrides userLanguage dan lainnya.
- ./pages = berisi file page.

Folder lain jika di butuhkan :

- ./db = berisi file database, bisa di isi schema juga.
- ./repositories = berisi file untuk interaksi siap pakai ke ./db, digunakan agar file lain tidak harus membuat builder schema dari awal.
- ./services = berisi file inti layanan yg di berikan, bisa berisi inti bisnis atau lainnya.
- ./utils = berisi file utilitas seperti log atau manipulation string atau lainnya.
- dan lainnya.
