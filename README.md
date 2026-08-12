# SAR Vehicle Log

Aplikasi internal untuk mencatat kendaraan operasional SAR keluar dan masuk, menyimpan bukti odometer, memantau status kendaraan, dan membuat laporan Excel.

## Fitur utama

- Personel dapat mencatat kendaraan keluar dan masuk tanpa login.
- Kendaraan dipilih manual; QR Code kendaraan cukup mengarah ke halaman utama `/`.
- Foto odometer wajib dan dapat diambil langsung dari kamera ponsel.
- Kendaraan otomatis berubah menjadi `SEDANG DIGUNAKAN` saat keluar dan `TERSEDIA` saat masuk.
- Admin login memakai Supabase Auth.
- Dashboard, filter log, pengelolaan kendaraan, dan export Excel tersedia di area admin.

## Instalasi

```bash
npm install
npm run dev
```

Aplikasi akan berjalan pada server lokal Next.js.

## Setup Supabase

1. Buat atau gunakan project Supabase.
2. Jalankan migration `create_sar_vehicle_log` melalui migration runner Supabase. Migration ini membuat tabel `vehicles`, `vehicle_logs`, `maintenance`, RLS, bucket `vehicle-odometer`, policy storage, dan delapan kendaraan awal.
3. Pastikan bucket `vehicle-odometer` tersedia dan bersifat public agar bukti dapat dibuka dari dashboard dan laporan.
4. Aktifkan Supabase Auth dengan provider Email. Email confirmation dapat dimatikan untuk kebutuhan admin internal.
5. Buat satu akun admin dari menu Authentication Supabase.

## Environment variables

Gunakan dua variabel berikut pada local development dan deployment:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Jangan memasukkan service role key ke browser atau repository.

## Struktur data

- `vehicles`: master kendaraan, status, kilometer terakhir, dan penanda aktif.
- `vehicle_logs`: perjalanan keluar/masuk, personel, tujuan, odometer, foto, kondisi, dan catatan.
- `maintenance`: riwayat maintenance untuk pengembangan pengelolaan perawatan.

## Admin

- `/admin/login`
- `/admin/dashboard`
- `/admin/log`
- `/admin/kendaraan`
- `/admin/laporan`

## Deployment Vercel

1. Import repository ke Vercel.
2. Pilih framework Next.js.
3. Tambahkan `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` pada Environment Variables.
4. Deploy project.

QR Code kendaraan cukup dibuat dengan tujuan URL website utama. Semua QR Code memiliki tujuan yang sama dan tidak memilih kendaraan otomatis.
