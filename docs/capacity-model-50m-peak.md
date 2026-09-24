# Capacity Model — 50jt MAU, puncak 500k akses/detik

Target: menahan **puncak 500k update/detik** (momen viral), rata-rata jauh di bawahnya.
Semua angka di bawah memakai asumsi bertabel A1–A8 — **koreksi asumsi = model otomatis terkoreksi** karena tiap sizing ditulis sebagai rumus, bukan angka mati.

## 1. Asumsi beban (koreksi di sini dulu)

| ID | Asumsi | Nilai | Kalau salah |
|----|--------|-------|-------------|
| A1 | Puncak inbound | 500k update/detik | Fleet ± linear, ganti pembilang rumus |
| A2 | Headroom provisi | ×1,3 → target 650k/detik | Naikkan ke ×1,5 bila puncak tak terprediksi |
| A3 | Mix traffic | 90% reaktif (reply instan), 10% tertunda/push | Push >10% → jalur push didesain ulang (bukan di-scale) |
| A4 | Ukuran payload | update ~0,7KB; sendMessage req+resp ~1KB | Bandwidth LB/API-server ikut naik |
| A5 | Biaya per 1 update reaktif | 1 recv + 1 sesi GET + 1 baca LMDB + 1 sesi SET + 1 sendMessage | Handler yang menambah IO menggeser A5 dan semua turunan |
| A6 | Budget latency reply p99 | ≤1 detik (margin di bawah hipotesis window exemption 1–5 dtk) | Window hasil ukur <1 dtk → budget diketatkan |
| A7 | Spesifikasi box | 64 vCPU / 128GB / NVMe / 25Gbps | Box lebih kecil → jumlah box naik proporsional |
| A8 | Sesi panas konkuren | 5jt user × ~2KB | Memory Redis ikut naik linear |

## 2. Topologi

```
Telegram DCs
  │  500k update/detik puncak
  ▼
Local Bot API Server tier (6 node) ── intake, s.d. 100k koneksi webhook/node pool
  │  fast-ack + route
  ▼
L4 LB tier (2 node aktif-aktif, 25Gbps) ── inbound ~2,8Gbps
  │  consistent-hash session-key → instance (locality; correctness via Redis lock)
  ▼
Fleet gramstax stateless (~325 proses Node / ~44 box) ── handler tipis, p99 ≤1 dtk
  ├── Redis Cluster (12 primary + 12 replica) ── sesi, lock per-key, antrean push
  ├── Mesh worker-thread (64 proses) ── tiap proses memiliki 4 LMDB shard (single-writer)
  │     └── LMDB 256 shard (~300MB/shard, total ~75GB) ── source of truth
  └── Outbound pool ── 500k sendMessage/detik via Local API Server (keepalive)
```

## 3. Sizing per lapis (rumus + hasil dengan asumsi di atas)

### 3.1 Intake — Local Bot API Server tier

- Cloud Bot API (`max_webhook_connections` maks 100) **dinyatakan tidak cukup** untuk 500k/detik.
- Kebutuhan: `node_api = peak × 1,3 / throughput_per_node`.
- Dengan hipotesis `throughput_per_node = 100k/detik` (MUST-MEASURE, eksperimen M4): `6 node`.
- Inbound bandwidth: `500k × 0,7KB = 350MB/detik ≈ 2,8Gbps` → LB 2×25Gbps aktif-aktif (n+1).

### 3.2 Fleet gramstax stateless

- `proses = peak × 1,3 / R_inst`, dengan `R_inst = 2.000 reply/detik per proses Node` (hipotesis hardware server; lower bound terukur 1,0–1,2rb/detik di i5-6200U — lihat §8, eksperimen M2 parsial).
- Hasil: `500k × 1,3 / 2.000 = 325 proses` → 8 proses per box 64-core (A7) = **~41 box → genapkan 44 box**. Dengan lower bound terukur (`R_inst = 1.000`): `500k × 1,3 / 1.000 = 650 proses → ~82 box` — jadikan batas atas provisi sampai M2 di hardware server terukur.
- KÔngkuren soket outbound per proses (Little's law): `2.000 × 0,1 dtk RTT = 200` → pool keepalive **1.000/proses** (5× headroom).
- Syarat keras: handler tanpa kerja berat (baca-sesi, baca-LMDB, kirim). Semua agregasi/fan-out/cleanup di worker pool — tiap milidetik di handler menggerus window exemption (A6).

### 3.3 Redis Cluster — sesi + lock + antrean push

- Ops: `500k × 2,5 op (A5) = 1,25jt op/detik` → dengan headroom **~1,6jt op/detik**.
- `primary = 1,6jt / 150k per shard = 11 → 12 primary + 12 replica` (HA).
- Memory: `5jt (A8) × 2KB = 10GB + overhead ×3 ≈ 32GB` se-cluster — bukan masalah.
- Lock per-key: sewa p99 <50 mdtk; hot key (giveaway viral) wajib pola bucket, bukan satu key.

### 3.4 LMDB — 256 shard + worker pemilik

- Baca: `500k/detik ÷ 256 shard ≈ 2rb/shard/detik` — noise level untuk memory-mapped read.
- Tulis: asumsi 20% update menulis record (100k/detik) `÷ 256 ≈ 400/shard/detik` — noise level untuk single-writer LMDB.
- Ukuran: `50jt user × ~1,5KB ≈ 75GB ÷ 256 ≈ 300MB/shard`.
- **Kesimpulan: 256 shard dipilih untuk isolasi fault + ruang tumbuh, BUKAN karena throughput** (headroom throughput ~100×). Aturan: jumlah shard mengikuti tulis/detik dan ukuran data, bukan jumlah user.
- Worker: 1 proses worker-thread memiliki 4 shard → **64 proses worker** via gateway Unix-socket; CDC async ke follower analitik.

### 3.5 Outbound — 500k sendMessage/detik

- Via pool Local API Server (koneksi persisten, fire-and-track — jangan tunggu respons untuk kerja berikutnya).
- Per-chat tetap serial wajar; antar-chat paralel penuh.

### 3.6 Observabilitas di ~325 proses

- Prometheus federasi/sharding (kardinalitas metrik ×325 proses × listener).
- Trace: sampling head 1% + 100% untuk span >2 dtk (pelanggaran A6).
- SLI utama: `update_to_send_ms` p99 (budget A6) — bukan throughput.

## 4. Kejujuran jalur push (penting)

Demand push di puncak: `10% (A3) × 500k = 50k/detik` vs limit broadcast ~30/detik → **mustahil dilayani real-time**.
Kebijakan eksplisit, bukan scaling:

1. Distribusi massal via **channel** (1 post = 1 message).
2. Push bot hanya untuk prioritas tinggi, dengan merge/dedupe per user.
3. Drip sesuai limit + antrean ber-checkpoint + kebijakan drop yang terlihat user.
4. Opsi paid broadcast (s.d. 1.000/detik) untuk momen yang memang dibayar.

Jalur push **tidak** di-scale ke 500k/detik — di-capped dan diprioritaskan.

## 5. Tangga degradasi (urutan buang beban saat puncak melebihi provisi)

1. Matikan drip push non-kritis.
2. Matikan fitur non-kritis via feature flag (mode reply-only).
3. Fairness per-key (cegah 1 event viral menenggelamkan 49,9jt user lain).
4. shedding eksplisit dengan pesan user yang jelas — jangan gagal diam-diam.

## 6. Eksperimen wajib sebelum belanja infra (unknown terbesar dulu)

| ID | Eksperimen | Menjawab |
|----|-----------|----------|
| M1 | Delivery rate Telegram → webhook kita di 100k/300k/500k/detik | Apakah puncak 500k/detik realistis di sisi Telegram |
| M2 | Throughput 1 proses Node handler-tipis (reply penuh) | **PARSIAL 2026-09-24**: lower bound `R_inst ≈ 1,0–1,2rb/detik` (i5-6200U; sapuan RATE: knee di offered 2.000 → tercapai 1.170, p50 meledak 2,5→792ms; k6 20VU 1.331/detik; cpu-prof: `_handleCtx` 36,8% self) — sisa: ukur di hardware server untuk memvalidasi 2.000/detik |
| M3 | Ops/detik 1 shard Redis dengan payload sesi kita | Nilai 150k/shard riil |
| M4 | Throughput 1 node Local API Server | Jumlah node tier intake riil |
| M5 | Probe window exemption (tunda balasan 1/2/3/5/8/13 dtk → cari 429) | Nilai A6 riil pengganti hipotesis 1–5 dtk |

Urutan: M1 → M2 → M4 → M3 → M5. M1 gagal (Telegram tak sanggup antar 500k/detik ke satu bot) → seluruh model direvisi ke arsitektur multi-bot/channel — lebih murah tahu sekarang daripada setelah beli 44 box.

## 7. Yang dokumen ini BUKAN

- Bukan desain jalur push real-time (lihat §4 — disengaja di-capped).
- Bukan tiket implementasi (tiket 1/2/3 kemarin tetap menunggu persetujuan quiz, dan Tiket 1 = eksperimen M5 di atas).
- Bukan ADR (keputusan arsitektur menyusul setelah M1–M2 terukur).

## 8. Kalibrasi 2026-09-24 (i5-6200U, bun 1.4.2, RTT=0, mock localhost)

Stack ukur: mitata (mikro) + harness in-process dikeraskan (`performance.now()`, warmup terbuang, 3 repetisi, `Bun.gc()`) + k6 v2.2.0 eksternal (20 VU, 60s, threshold SLO lolos) + hyperfine 1.20.0 (repetisi level-proses, σ 2–11%). File: `packages/gramstax/bench/concurrent.bench.ts`, `hot-path.bench.ts`, `bench/k6/`.

- Mikro: render template ~0,5µs; dispatch 1 update ~55µs (~18rb/detik ceiling in-process); keyboard 4 tombol ~2µs end-to-end.
- Makro webhook: harness ~1,4rb/detik flat (conc 10–200) + k6 **1.331/detik, p99 30ms** → sepakat: ceiling di box ini per proses, dan **bukan** self-contention generator. Sapuan RATE memastikan plateau: knee di offered 2.000 → tercapai 1.170/detik, p50 meledak 2,5→792ms.
- Makro polling: throughput sub-linear 699→1.260 upd/s, p50 51→421ms (drain sekuensial) — webhook wajib di skala.
- Spread antar wave ±40–60% di laptop ini (satu wave ~2× lebih cepat murni karena idle-time): kutip selalu mean-dengan-spread, bukan titik.
- Dampak ke model: `R_inst` = 2.000/detik (hipotesis server) dengan lower bound terukur 1,0–1,2rb/detik → provisi fleet **44 box (basis) – 82 box (konservatif)** sampai M2-server terukur. Profil (`_handleCtx` 36,8% self, framework 41,5%) → optimasi profile-guided adalah langkah berikutnya (tiket terpisah), baru ukur ulang plateau. M1, M3–M5 tetap terbuka.
