'use client';

import { useEffect, useState } from 'react';
import {
  BarChart3,
  CarFront,
  CheckCircle2,
  Download,
  FileText,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Truck,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';

import {
  supabase,
  Vehicle,
  VehicleLog,
  VehicleStatus,
} from '@/lib/supabase';

type Section =
  | 'login'
  | 'dashboard'
  | 'log'
  | 'vehicles'
  | 'reports';

const statusOptions: VehicleStatus[] = [
  'TERSEDIA',
  'SEDANG DIGUNAKAN',
  'MAINTENANCE',
  'TIDAK AKTIF',
];

/* =========================================================
   HELPER
========================================================= */

function fmt(value: string | number | null) {
  if (value === null || value === undefined) return '-';

  return new Intl.NumberFormat('id-ID').format(Number(value));
}

function date(value: string | null) {
  if (!value) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

/* =========================================================
   PHOTO LINK
========================================================= */

function PhotoLink({
  path,
  label,
}: {
  path: string | null;
  label: string;
}) {
  if (!path) {
    return (
      <span className="text-xs text-slate-400">
        Tidak ada foto
      </span>
    );
  }

  const { data } = supabase.storage
    .from('vehicle-odometer')
    .getPublicUrl(path);

  if (!data?.publicUrl) {
    return (
      <span className="text-xs text-red-500">
        Foto tidak tersedia
      </span>
    );
  }

  return (
    <a
      href={data.publicUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex whitespace-nowrap rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 hover:text-red-800"
    >
      {label}
    </a>
  );
}

/* =========================================================
   ADMIN APP
========================================================= */

export default function AdminApp({
  section,
}: {
  section: Section;
}) {
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data } =
        await supabase.auth.getSession();

      if (!data.session) {
        if (!cancelled) {
          setAuthorized(false);
          setChecking(false);
        }

        return;
      }

      const email =
        data.session.user.email ?? '';

      const { data: adminRow } =
        await supabase
          .from('admins')
          .select('id')
          .eq('email', email)
          .maybeSingle();

      if (!cancelled) {
        setAuthorized(Boolean(adminRow));
        setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (section === 'login') {
    return <Login />;
  }

  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-500">
        Memeriksa akses admin...
      </div>
    );
  }

  if (!authorized) {
    return <Login />;
  }

  return <AdminLayout section={section} />;
}

/* =========================================================
   LOGIN
========================================================= */

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    setSaving(true);
    setError('');

    const cleanEmail =
      email.trim().toLowerCase();

    const {
      data: authData,
      error: loginError,
    } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    console.log('AUTH DATA:', authData);
    console.log('AUTH ERROR:', loginError);

    if (loginError) {
      setSaving(false);
      setError(
        `Login gagal: ${loginError.message}`
      );
      return;
    }

    const {
      data: sessionData,
      error: sessionError,
    } =
      await supabase.auth.getSession();

    if (
      sessionError ||
      !sessionData.session
    ) {
      await supabase.auth.signOut();

      setSaving(false);
      setError(
        'Session admin tidak berhasil dibuat.'
      );

      return;
    }

    const {
      data: adminRow,
      error: adminError,
    } = await supabase
      .from('admins')
      .select(
        'id, email, name, active'
      )
      .eq('email', cleanEmail)
      .maybeSingle();

    console.log(
      'ADMIN ROW:',
      adminRow
    );

    if (adminError) {
      await supabase.auth.signOut();

      setSaving(false);

      setError(
        `Gagal memeriksa data admin: ${adminError.message}`
      );

      return;
    }

    if (!adminRow) {
      await supabase.auth.signOut();

      setSaving(false);

      setError(
        'Email berhasil login, tetapi belum terdaftar sebagai admin.'
      );

      return;
    }

    if (!adminRow.active) {
      await supabase.auth.signOut();

      setSaving(false);

      setError(
        'Akun admin ini sedang dinonaktifkan.'
      );

      return;
    }

    window.location.href =
      '/admin/dashboard';
  };

  return (
    <main className="grid min-h-screen bg-slate-950 lg:grid-cols-2">
      <div className="hidden flex-col justify-between p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-red-700">
            <ShieldCheck size={22} />
          </div>

          <span className="font-black tracking-tight">
            SAR Vehicle Log
          </span>
        </div>

        <div>
          <p className="max-w-lg text-5xl font-black leading-tight">
            Pantau setiap kendaraan.
            Jaga setiap misi.
          </p>

          <p className="mt-5 max-w-md text-slate-400">
            Dashboard internal untuk
            pengelolaan operasional dan
            riwayat kendaraan SAR.
          </p>
        </div>

        <p className="text-xs text-slate-500">
          ADMIN OPERATIONS CONSOLE
        </p>
      </div>

      <div className="flex items-center justify-center bg-slate-50 p-6">
        <form
          onSubmit={submit}
          className="w-full max-w-md"
        >
          <div className="mb-8 lg:hidden">
            <div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-red-700 text-white">
              <ShieldCheck />
            </div>

            <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-700">
              SAR Vehicle Log
            </p>
          </div>

          <h1 className="text-3xl font-black tracking-tight">
            Masuk sebagai admin
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Kelola monitoring kendaraan
            dan laporan operasi.
          </p>

          <div className="mt-8 space-y-5">
            <label className="block">
              <span className="label">
                Email admin
              </span>

              <input
                className="field"
                type="email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                placeholder="admin@organisasi.id"
                required
              />
            </label>

            <label className="block">
              <span className="label">
                Password
              </span>

              <input
                className="field"
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                placeholder="Masukkan password"
                required
              />
            </label>

            {error && (
              <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
                {error}
              </p>
            )}

            <button
              disabled={saving}
              className="flex h-14 w-full items-center justify-center rounded-xl bg-red-700 font-bold text-white shadow-lg shadow-red-700/20 hover:bg-red-800 disabled:opacity-50"
            >
              {saving
                ? 'Memeriksa...'
                : 'Masuk ke Dashboard'}
            </button>
          </div>

          <a
            href="/"
            className="mt-6 block text-center text-sm font-semibold text-slate-500 hover:text-red-700"
          >
            Kembali ke halaman personel
          </a>
        </form>
      </div>
    </main>
  );
}

/* =========================================================
   ADMIN LAYOUT
========================================================= */

function AdminLayout({
  section,
}: {
  section: Exclude<
    Section,
    'login'
  >;
}) {
  const [open, setOpen] =
    useState(false);

  const nav = [
    {
      key: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      href: '/admin/dashboard',
    },
    {
      key: 'log',
      label: 'Log Aktivitas',
      icon: FileText,
      href: '/admin/log',
    },
    {
      key: 'vehicles',
      label: 'Kendaraan',
      icon: CarFront,
      href: '/admin/kendaraan',
    },
    {
      key: 'reports',
      label: 'Laporan',
      icon: BarChart3,
      href: '/admin/laporan',
    },
  ];

  const logout = async () => {
    await supabase.auth.signOut();

    window.location.href =
      '/admin/login';
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-72 border-r bg-slate-950 p-6 text-white transition-transform lg:translate-x-0 ${
          open
            ? 'translate-x-0'
            : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-700">
              <Truck size={20} />
            </div>

            <span className="font-black">
              SAR Vehicle Log
            </span>
          </div>

          <button
            className="lg:hidden"
            onClick={() =>
              setOpen(false)
            }
          >
            <X size={20} />
          </button>
        </div>

        <p className="mb-4 mt-12 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
          Workspace
        </p>

        <nav className="space-y-2">
          {nav.map(
            ({
              key,
              label,
              icon: Icon,
              href,
            }) => (
              <a
                key={key}
                href={href}
                onClick={() =>
                  setOpen(false)
                }
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  section === key
                    ? 'bg-red-700 text-white'
                    : 'text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon size={18} />
                {label}
              </a>
            )
          )}
        </nav>

        <div className="absolute inset-x-6 bottom-6 space-y-2">
          <a
            href="/"
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <CarFront size={18} />
            Halaman Personel
          </a>

          <button
            onClick={() =>
              void logout()
            }
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <LogOut size={18} />
            Keluar
          </button>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b bg-white/90 px-5 backdrop-blur sm:px-8">
          <button
            onClick={() =>
              setOpen(true)
            }
            className="lg:hidden"
          >
            <Menu />
          </button>

          <div className="hidden lg:block">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-700">
              Admin Console
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Operasional kendaraan SAR
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-bold">
                Administrator
              </p>

              <p className="text-xs text-slate-500">
                Akses internal
              </p>
            </div>

            <div className="grid h-10 w-10 place-items-center rounded-full bg-red-100 font-black text-red-700">
              A
            </div>
          </div>
        </header>

        <main className="p-5 sm:p-8">
          {section ===
            'dashboard' && (
            <Dashboard />
          )}

          {section === 'log' && (
            <Logs />
          )}

          {section ===
            'vehicles' && (
            <Vehicles />
          )}

          {section ===
            'reports' && (
            <Reports />
          )}
        </main>
      </div>
    </div>
  );
}

/* =========================================================
   DATA HOOK
========================================================= */

function useData() {
  const [vehicles, setVehicles] =
    useState<Vehicle[]>([]);

  const [logs, setLogs] =
    useState<VehicleLog[]>([]);

  const [loading, setLoading] =
    useState(true);

  const load = async () => {
    setLoading(true);

    const [
      vehicleResult,
      logResult,
    ] = await Promise.all([
      supabase
        .from('vehicles')
        .select('*')
        .order('name'),

      supabase
        .from('vehicle_logs')
        .select(
          '*, vehicle:vehicles(name)'
        )
        .order('exit_time', {
          ascending: false,
        }),
    ]);

    if (vehicleResult.error) {
      console.error(
        'VEHICLE ERROR:',
        vehicleResult.error
      );
    }

    if (logResult.error) {
      console.error(
        'LOG ERROR:',
        logResult.error
      );
    }

    console.log(
      'LOG DATA:',
      logResult.data
    );

    setVehicles(
      (vehicleResult.data as Vehicle[]) ??
        []
    );

    setLogs(
      (logResult.data as VehicleLog[]) ??
        []
    );

    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  return {
    vehicles,
    logs,
    loading,
    reload: load,
  };
}

/* =========================================================
   PAGE TITLE
========================================================= */

function PageTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-8">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-700">
        {eyebrow}
      </p>

      <h1 className="mt-2 text-3xl font-black tracking-tight">
        {title}
      </h1>

      <p className="mt-2 text-sm text-slate-500">
        {description}
      </p>
    </div>
  );
}

/* =========================================================
   DASHBOARD
========================================================= */

function Dashboard() {
  const {
    vehicles,
    logs,
    loading,
  } = useData();

  const stats = [
    {
      label: 'Total kendaraan',
      value: vehicles.length,
      icon: CarFront,
      tone: 'bg-slate-900',
    },
    {
      label: 'Tersedia',
      value: vehicles.filter(
        (v) =>
          v.status === 'TERSEDIA'
      ).length,
      icon: CheckCircle2,
      tone: 'bg-emerald-700',
    },
    {
      label: 'Sedang digunakan',
      value: vehicles.filter(
        (v) =>
          v.status ===
          'SEDANG DIGUNAKAN'
      ).length,
      icon: Truck,
      tone: 'bg-red-700',
    },
    {
      label: 'Maintenance',
      value: vehicles.filter(
        (v) =>
          v.status ===
          'MAINTENANCE'
      ).length,
      icon: Gauge,
      tone: 'bg-amber-600',
    },
  ];

  const daily = logs.filter(
    (l) =>
      l.exit_time?.slice(
        0,
        10
      ) === today()
  );

  const distance =
    daily.reduce(
      (sum, log) =>
        sum +
        Number(
          log.total_distance ?? 0
        ),
      0
    );

  return (
    <>
      <PageTitle
        eyebrow="Overview"
        title="Dashboard operasional"
        description="Ringkasan kondisi kendaraan dan aktivitas hari ini."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(
          ({
            label,
            value,
            icon: Icon,
            tone,
          }) => (
            <div
              key={label}
              className="card p-5"
            >
              <div
                className={`grid h-10 w-10 place-items-center rounded-xl text-white ${tone}`}
              >
                <Icon size={19} />
              </div>

              <p className="mt-5 text-xs font-bold uppercase tracking-wider text-slate-500">
                {label}
              </p>

              <p className="mt-1 text-3xl font-black">
                {loading
                  ? '-'
                  : value}
              </p>
            </div>
          )
        )}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <div className="card p-6 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Aktivitas hari ini
              </p>

              <p className="mt-1 text-3xl font-black">
                {daily.length}{' '}
                <span className="text-sm font-semibold text-slate-400">
                  perjalanan
                </span>
              </p>
            </div>

            <div className="rounded-xl bg-red-50 p-3 text-red-700">
              <BarChart3 size={20} />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">
                Total KM hari ini
              </p>

              <p className="mt-1 text-xl font-black">
                {fmt(distance)} KM
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">
                Log belum kembali
              </p>

              <p className="mt-1 text-xl font-black">
                {
                  logs.filter(
                    (l) =>
                      !l.entry_time
                  ).length
                }
              </p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Kendaraan dipantau
          </p>

          <div className="mt-4 space-y-3">
            {vehicles
              .slice(0, 5)
              .map((vehicle) => (
                <div
                  key={vehicle.id}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="truncate text-sm font-semibold">
                    {vehicle.name}
                  </span>

                  <Status
                    status={
                      vehicle.status
                    }
                  />
                </div>
              ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* =========================================================
   STATUS
========================================================= */

function Status({
  status,
}: {
  status: VehicleStatus;
}) {
  const style =
    status === 'TERSEDIA'
      ? 'bg-emerald-100 text-emerald-800'
      : status ===
        'SEDANG DIGUNAKAN'
      ? 'bg-red-100 text-red-800'
      : status === 'MAINTENANCE'
      ? 'bg-amber-100 text-amber-800'
      : 'bg-slate-200 text-slate-600';

  return (
    <span
      className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold ${style}`}
    >
      {status}
    </span>
  );
}

/* =========================================================
   LOGS
========================================================= */

function Logs() {
  const {
    vehicles,
    logs,
    loading,
  } = useData();

  const [q, setQ] =
    useState('');

  const [vehicle, setVehicle] =
    useState('');

  const [status, setStatus] =
    useState('');

  // FILTER TANGGAL
  const [from, setFrom] =
    useState('');

  const [to, setTo] =
    useState('');

  const filtered =
    logs.filter((log) => {
      // ==========================================
      // TANGGAL LOG
      // ==========================================

      const logDate =
        log.exit_time?.slice(0, 10);

      // ==========================================
      // FILTER NAMA PERSONEL
      // ==========================================

      const matchName =
        !q ||
        log.personnel_name
          .toLowerCase()
          .includes(
            q.toLowerCase()
          );

      // ==========================================
      // FILTER KENDARAAN
      // ==========================================

      const matchVehicle =
        !vehicle ||
        log.vehicle_id === vehicle;

      // ==========================================
      // FILTER STATUS
      // ==========================================

      const matchStatus =
        !status ||
        (status === 'SELESAI'
          ? Boolean(log.entry_time)
          : !log.entry_time);

      // ==========================================
      // FILTER TANGGAL MULAI
      // ==========================================

      const matchFrom =
        !from ||
        (logDate &&
          logDate >= from);

      // ==========================================
      // FILTER TANGGAL AKHIR
      // ==========================================

      const matchTo =
        !to ||
        (logDate &&
          logDate <= to);

      return (
        matchName &&
        matchVehicle &&
        matchStatus &&
        matchFrom &&
        matchTo
      );
    });

  // ==========================================
  // RESET FILTER
  // ==========================================

  const resetFilters = () => {
    setQ('');
    setVehicle('');
    setStatus('');
    setFrom('');
    setTo('');
  };

  return (
    <>
      <PageTitle
        eyebrow="Monitoring"
        title="Log aktivitas kendaraan"
        description="Menampilkan seluruh data aktivitas kendaraan secara lengkap."
      />

      {/* =========================================
          FILTER
      ========================================= */}

      <div className="card mb-5 p-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">

          {/* NAMA PERSONEL */}

          <div className="relative">
            <Search
              className="absolute left-3 top-3.5 text-slate-400"
              size={17}
            />

            <input
              className="field pl-10"
              placeholder="Cari nama personel"
              value={q}
              onChange={(e) =>
                setQ(e.target.value)
              }
            />
          </div>

          {/* TANGGAL MULAI */}

          <div>
            <label className="label">
              Tanggal mulai
            </label>

            <input
              className="field"
              type="date"
              value={from}
              onChange={(e) =>
                setFrom(e.target.value)
              }
            />
          </div>

          {/* TANGGAL AKHIR */}

          <div>
            <label className="label">
              Tanggal akhir
            </label>

            <input
              className="field"
              type="date"
              value={to}
              onChange={(e) =>
                setTo(e.target.value)
              }
            />
          </div>

          {/* KENDARAAN */}

          <div>
            <label className="label">
              Kendaraan
            </label>

            <select
              className="field"
              value={vehicle}
              onChange={(e) =>
                setVehicle(
                  e.target.value
                )
              }
            >
              <option value="">
                Semua kendaraan
              </option>

              {vehicles.map((v) => (
                <option
                  key={v.id}
                  value={v.id}
                >
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          {/* STATUS */}

          <div>
            <label className="label">
              Status
            </label>

            <select
              className="field"
              value={status}
              onChange={(e) =>
                setStatus(
                  e.target.value
                )
              }
            >
              <option value="">
                Semua status
              </option>

              <option value="SELESAI">
                Selesai
              </option>

              <option value="AKTIF">
                Sedang digunakan
              </option>
            </select>
          </div>
        </div>

        {/* =========================================
            FILTER ACTION
        ========================================= */}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">

          <p className="text-xs text-slate-500">
            {from && to
              ? `Menampilkan aktivitas ${from} sampai ${to}`
              : from
              ? `Menampilkan aktivitas mulai ${from}`
              : to
              ? `Menampilkan aktivitas sampai ${to}`
              : 'Menampilkan seluruh periode aktivitas'}
          </p>

          <button
            onClick={resetFilters}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100"
          >
            Reset Filter
          </button>
        </div>
      </div>

      {/* =========================================
          INFO
      ========================================= */}

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Menampilkan{' '}
          <strong className="text-slate-900">
            {filtered.length}
          </strong>{' '}
          data log
        </p>
      </div>

      {/* =========================================
          TABLE
      ========================================= */}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">

          <table className="w-full min-w-[2200px] text-left text-sm">

            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">

              <tr>

                <th className="sticky left-0 z-10 bg-slate-50 px-5 py-4">
                  No
                </th>

                <th className="px-5 py-4">
                  Tanggal
                </th>

                <th className="px-5 py-4">
                  Nama Personel
                </th>

                <th className="px-5 py-4">
                  Kendaraan
                </th>

                <th className="px-5 py-4">
                  Tujuan
                </th>

                <th className="px-5 py-4">
                  Keperluan
                </th>

                <th className="px-5 py-4">
                  Jam Keluar
                </th>

                <th className="px-5 py-4">
                  Jam Masuk
                </th>

                <th className="px-5 py-4">
                  KM Keluar
                </th>

                <th className="px-5 py-4">
                  KM Masuk
                </th>

                <th className="px-5 py-4">
                  Total KM
                </th>

                <th className="px-5 py-4">
                  Kondisi Kendaraan
                </th>

                <th className="px-5 py-4">
                  Catatan
                </th>

                <th className="px-5 py-4">
                  Bukti Odometer Keluar
                </th>

                <th className="px-5 py-4">
                  Bukti Odometer Masuk
                </th>

              </tr>

            </thead>

            <tbody className="divide-y">

              {loading ? (

                <tr>

                  <td
                    colSpan={15}
                    className="p-8 text-center text-slate-500"
                  >
                    Memuat data...
                  </td>

                </tr>

              ) : filtered.length === 0 ? (

                <tr>

                  <td
                    colSpan={15}
                    className="p-8 text-center text-slate-500"
                  >
                    Belum ada log yang sesuai
                    dengan filter.
                  </td>

                </tr>

              ) : (

                filtered.map(
                  (log, index) => (

                    <tr
                      key={log.id}
                      className="hover:bg-slate-50"
                    >

                      {/* NO */}

                      <td className="sticky left-0 z-10 bg-white px-5 py-4 font-bold">
                        {index + 1}
                      </td>

                      {/* TANGGAL */}

                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">

                        {log.exit_time
                          ? new Intl.DateTimeFormat(
                              'id-ID',
                              {
                                dateStyle:
                                  'medium',
                              }
                            ).format(
                              new Date(
                                log.exit_time
                              )
                            )
                          : '-'}

                      </td>

                      {/* PERSONEL */}

                      <td className="px-5 py-4">

                        <p className="whitespace-nowrap font-bold">
                          {
                            log.personnel_name
                          }
                        </p>

                      </td>

                      {/* KENDARAAN */}

                      <td className="px-5 py-4">

                        <p className="whitespace-nowrap font-semibold">
                          {log.vehicle
                            ?.name ??
                            '-'}
                        </p>

                      </td>

                      {/* TUJUAN */}

                      <td className="px-5 py-4">

                        <p className="max-w-[220px] font-semibold">
                          {
                            log.destination
                          }
                        </p>

                      </td>

                      {/* KEPERLUAN */}

                      <td className="px-5 py-4">

                        <p className="max-w-[250px] text-slate-600">
                          {log.purpose ||
                            '-'}
                        </p>

                      </td>

                      {/* JAM KELUAR */}

                      <td className="whitespace-nowrap px-5 py-4">
                        {date(
                          log.exit_time
                        )}
                      </td>

                      {/* JAM MASUK */}

                      <td className="whitespace-nowrap px-5 py-4">
                        {date(
                          log.entry_time
                        )}
                      </td>

                      {/* KM KELUAR */}

                      <td className="px-5 py-4 font-semibold">
                        {fmt(
                          log.km_exit
                        )}
                      </td>

                      {/* KM MASUK */}

                      <td className="px-5 py-4 font-semibold">
                        {fmt(
                          log.km_entry
                        )}
                      </td>

                      {/* TOTAL KM */}

                      <td className="px-5 py-4">

                        {log.total_distance ===
                        null ? (

                          <span className="text-slate-400">
                            Belum kembali
                          </span>

                        ) : (

                          <span className="font-bold text-emerald-700">
                            {fmt(
                              log.total_distance
                            )}{' '}
                            KM
                          </span>

                        )}

                      </td>

                      {/* KONDISI */}

                      <td className="px-5 py-4">

                        <span className="whitespace-nowrap">
                          {log.vehicle_condition ||
                            '-'}
                        </span>

                      </td>

                      {/* CATATAN */}

                      <td className="px-5 py-4">

                        <p className="max-w-[250px] whitespace-normal text-slate-600">
                          {log.notes ||
                            '-'}
                        </p>

                      </td>

                      {/* FOTO ODOMETER KELUAR */}

                      <td className="px-5 py-4">

                        <PhotoLink
                          path={
                            log.exit_odometer_photo
                          }
                          label="Lihat Foto"
                        />

                      </td>

                      {/* FOTO ODOMETER MASUK */}

                      <td className="px-5 py-4">

                        <PhotoLink
                          path={
                            log.entry_odometer_photo
                          }
                          label="Lihat Foto"
                        />

                      </td>

                    </tr>

                  )
                )

              )}

            </tbody>

          </table>

        </div>
      </div>
    </>
  );
}
/* =========================================================
   VEHICLES
========================================================= */

function Vehicles() {
  const {
    vehicles,
    reload,
  } = useData();

  const [editing, setEditing] =
    useState<Vehicle | null>(
      null
    );

  const [name, setName] =
    useState('');

  const [status, setStatus] =
    useState<VehicleStatus>(
      'TERSEDIA'
    );

  const save = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (editing?.id) {
      await supabase
        .from('vehicles')
        .update({
          name,
          status,
          active:
            status !==
            'TIDAK AKTIF',
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          'id',
          editing.id
        );
    } else {
      await supabase
        .from('vehicles')
        .insert({
          name,
          status,
          active: true,
        });
    }

    setEditing(null);
    setName('');
    setStatus('TERSEDIA');

    await reload();
  };

  return (
    <>
      <PageTitle
        eyebrow="Master data"
        title="Kendaraan operasional"
        description="Kelola nama, status, dan ketersediaan kendaraan tanpa menghapus histori."
      />

      <div className="mb-5 flex justify-end">
        <button
          onClick={() => {
            setEditing(
              {} as Vehicle
            );
            setName('');
            setStatus(
              'TERSEDIA'
            );
          }}
          className="flex items-center gap-2 rounded-xl bg-red-700 px-4 py-3 text-sm font-bold text-white hover:bg-red-800"
        >
          <Plus size={17} />
          Tambah kendaraan
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {vehicles.map(
          (vehicle) => (
            <div
              key={vehicle.id}
              className="card flex items-center justify-between gap-4 p-5"
            >
              <div>
                <p className="font-bold">
                  {vehicle.name}
                </p>

                <div className="mt-2 flex items-center gap-2">
                  <Status
                    status={
                      vehicle.status
                    }
                  />

                  <span className="text-xs text-slate-500">
                    KM{' '}
                    {fmt(
                      vehicle.current_km
                    )}
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  setEditing(
                    vehicle
                  );
                  setName(
                    vehicle.name
                  );
                  setStatus(
                    vehicle.status
                  );
                }}
                className="rounded-xl p-3 text-slate-400 hover:bg-slate-100 hover:text-red-700"
              >
                <Pencil size={17} />
              </button>
            </div>
          )
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/40 p-5">
          <form
            onSubmit={save}
            className="card w-full max-w-md p-6"
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-black">
                {editing.id
                  ? 'Ubah kendaraan'
                  : 'Tambah kendaraan'}
              </h2>

              <button
                type="button"
                onClick={() =>
                  setEditing(null)
                }
              >
                <X size={19} />
              </button>
            </div>

            <label className="block">
              <span className="label">
                Nama kendaraan
              </span>

              <input
                className="field"
                value={name}
                onChange={(e) =>
                  setName(
                    e.target.value
                  )
                }
                required
              />
            </label>

            <label className="mt-5 block">
              <span className="label">
                Status
              </span>

              <select
                className="field"
                value={status}
                onChange={(e) =>
                  setStatus(
                    e.target
                      .value as VehicleStatus
                  )
                }
              >
                {statusOptions.map(
                  (item) => (
                    <option
                      key={item}
                    >
                      {item}
                    </option>
                  )
                )}
              </select>
            </label>

            <button className="mt-6 h-12 w-full rounded-xl bg-red-700 font-bold text-white">
              Simpan perubahan
            </button>
          </form>
        </div>
      )}
    </>
  );
}

/* =========================================================
   REPORTS
========================================================= */

function Reports() {
  const {
    vehicles,
    logs,
  } = useData();

  const [from, setFrom] =
    useState(today());

  const [to, setTo] =
    useState(today());

  const [vehicle, setVehicle] =
    useState('');

  const [q, setQ] =
    useState('');

  const filtered =
    logs.filter(
      (log) => {
        const logDate =
          log.exit_time?.slice(
            0,
            10
          );

        return (
          logDate &&
          logDate >= from &&
          logDate <= to &&
          (!vehicle ||
            log.vehicle_id ===
              vehicle) &&
          (!q ||
            log.personnel_name
              .toLowerCase()
              .includes(
                q.toLowerCase()
              ))
        );
      }
    );

  const exportFile = () => {
    const rows =
      filtered.map(
        (log, index) => ({
          No: index + 1,

          Tanggal:
            new Date(
              log.exit_time
            ).toLocaleDateString(
              'id-ID'
            ),

          'Nama Personel':
            log.personnel_name,

          Kendaraan:
            log.vehicle?.name ??
            '',

          Tujuan:
            log.destination ??
            '',

          Keperluan:
            log.purpose ?? '',

          'Jam Keluar':
            date(
              log.exit_time
            ),

          'Jam Masuk':
            date(
              log.entry_time
            ),

          'KM Keluar':
            log.km_exit,

          'KM Masuk':
            log.km_entry,

          'Total KM':
            log.total_distance,

          'Kondisi Kendaraan':
            log.vehicle_condition ??
            '',

          Catatan:
            log.notes ?? '',

          'Bukti Odometer Keluar':
            log.exit_odometer_photo ??
            '',

          'Bukti Odometer Masuk':
            log.entry_odometer_photo ??
            '',
        })
      );

    const sheet =
      XLSX.utils.json_to_sheet(
        rows
      );

    const book =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      book,
      sheet,
      'Log Kendaraan'
    );

    XLSX.writeFile(
      book,
      `Laporan_Log_Kendaraan_SAR_${from}_${to}.xlsx`
    );
  };

  return (
    <>
      <PageTitle
        eyebrow="Reporting"
        title="Laporan kendaraan"
        description="Pilih periode dan unduh data log dalam format Excel."
      />

      <div className="card grid gap-4 p-5 md:grid-cols-4">
        <label>
          <span className="label">
            Tanggal mulai
          </span>

          <input
            className="field"
            type="date"
            value={from}
            onChange={(e) =>
              setFrom(
                e.target.value
              )
            }
          />
        </label>

        <label>
          <span className="label">
            Tanggal akhir
          </span>

          <input
            className="field"
            type="date"
            value={to}
            onChange={(e) =>
              setTo(
                e.target.value
              )
            }
          />
        </label>

        <label>
          <span className="label">
            Kendaraan
          </span>

          <select
            className="field"
            value={vehicle}
            onChange={(e) =>
              setVehicle(
                e.target.value
              )
            }
          >
            <option value="">
              Semua kendaraan
            </option>

            {vehicles.map(
              (v) => (
                <option
                  key={v.id}
                  value={v.id}
                >
                  {v.name}
                </option>
              )
            )}
          </select>
        </label>

        <label>
          <span className="label">
            Nama personel
          </span>

          <input
            className="field"
            value={q}
            onChange={(e) =>
              setQ(
                e.target.value
              )
            }
            placeholder="Semua personel"
          />
        </label>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Menampilkan{' '}
          <strong className="text-slate-900">
            {filtered.length}
          </strong>{' '}
          log.
        </p>

        <button
          onClick={exportFile}
          className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800"
        >
          <Download size={17} />
          Export Excel
        </button>
      </div>

      <div className="card mt-5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-4">
                  Tanggal
                </th>

                <th className="px-5 py-4">
                  Kendaraan
                </th>

                <th className="px-5 py-4">
                  Personel
                </th>

                <th className="px-5 py-4">
                  Tujuan
                </th>

                <th className="px-5 py-4">
                  Total KM
                </th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {filtered.map(
                (log) => (
                  <tr
                    key={log.id}
                  >
                    <td className="px-5 py-4">
                      {date(
                        log.exit_time
                      )}
                    </td>

                    <td className="px-5 py-4 font-semibold">
                      {
                        log.vehicle
                          ?.name
                      }
                    </td>

                    <td className="px-5 py-4">
                      {
                        log.personnel_name
                      }
                    </td>

                    <td className="px-5 py-4">
                      {
                        log.destination
                      }
                    </td>

                    <td className="px-5 py-4 font-bold text-emerald-700">
                      {log.total_distance ===
                      null
                        ? '-'
                        : `${fmt(
                            log.total_distance
                          )} KM`}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}