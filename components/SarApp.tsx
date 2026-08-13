'use client';

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ArrowLeft,
  Camera,
  CarFront,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  Gauge,
  LogIn,
  LogOut,
  MapPin,
  ShieldCheck,
  Upload,
  UserRound,
} from 'lucide-react';

import {
  supabase,
  Vehicle,
  VehicleLog,
} from '@/lib/supabase';

/* =========================================================
   CONSTANTS
========================================================= */

const conditions = [
  'BAIK',
  'PERLU PEMERIKSAAN',
  'RUSAK RINGAN',
];

type Mode = 'home' | 'exit' | 'entry';

type FormState = {
  personnel: string;
  vehicleId: string;
  destination: string;
  purpose: string;
  km: string;
  fuelPercentage: string;
  condition: string;
  notes: string;
  photo: File | null;
};

const initialForm: FormState = {
  personnel: '',
  vehicleId: '',
  destination: '',
  purpose: '',
  km: '',
  fuelPercentage: '',
  condition: 'BAIK',
  notes: '',
  photo: null,
};

/* =========================================================
   PHOTO CONFIG
========================================================= */

const MAX_PHOTO_SIZE = 10 * 1024 * 1024;

const ALLOWED_PHOTO_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

/* =========================================================
   HELPERS
========================================================= */

function formatDate(value: string | null) {
  if (!value) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatKm(value: number | string | null) {
  if (value === null || value === undefined) {
    return '0';
  }

  return new Intl.NumberFormat('id-ID').format(
    Number(value) || 0
  );
}

function formatFuel(value: number | string | null) {
  if (value === null || value === undefined) {
    return '-';
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return '-';
  }

  return `${number}%`;
}

/* =========================================================
   CALCULATE FUEL
========================================================= */

function calculateFuelUsed(
  fuelExit: number | string | null,
  fuelEntry: number | string | null
) {
  if (
    fuelExit === null ||
    fuelExit === undefined ||
    fuelEntry === null ||
    fuelEntry === undefined
  ) {
    return null;
  }

  const exit = Number(fuelExit);
  const entry = Number(fuelEntry);

  if (
    !Number.isFinite(exit) ||
    !Number.isFinite(entry)
  ) {
    return null;
  }

  const result = exit - entry;

  return Math.max(0, result);
}

/* =========================================================
   PHOTO VALIDATION
========================================================= */

function uploadablePhoto(
  file: File | null
): boolean {
  if (!file) return false;

  return (
    ALLOWED_PHOTO_TYPES.includes(file.type) &&
    file.size <= MAX_PHOTO_SIZE
  );
}

function getPhotoExtension(file: File) {
  const extension =
    file.name.split('.').pop()?.toLowerCase();

  if (
    extension === 'jpg' ||
    extension === 'jpeg'
  ) {
    return 'jpg';
  }

  if (extension === 'png') {
    return 'png';
  }

  if (extension === 'webp') {
    return 'webp';
  }

  return 'jpg';
}

/* =========================================================
   MAIN APP
========================================================= */

export default function SarApp() {
  const [mode, setMode] =
    useState<Mode>('home');

  const [vehicles, setVehicles] =
    useState<Vehicle[]>([]);

  const [activeLog, setActiveLog] =
    useState<VehicleLog | null>(null);

  const [form, setForm] =
    useState<FormState>(initialForm);

  const [message, setMessage] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [saving, setSaving] =
    useState(false);

  /* =======================================================
     LOAD VEHICLES
  ======================================================= */

  const loadVehicles = async () => {
    const { data, error } =
      await supabase
        .from('vehicles')
        .select('*')
        .eq('active', true)
        .order('name');

    if (error) {
      console.error(
        'LOAD VEHICLES ERROR:',
        error
      );

      setError(
        'Data kendaraan tidak dapat dimuat.'
      );

      return;
    }

    setVehicles(
      (data as Vehicle[]) ?? []
    );
  };

  useEffect(() => {
    void loadVehicles();
  }, []);

  /* =======================================================
     VEHICLE FILTER
  ======================================================= */

  const available = useMemo(
    () =>
      vehicles.filter(
        (vehicle) =>
          vehicle.status === 'TERSEDIA'
      ),
    [vehicles]
  );

  const inUse = useMemo(
    () =>
      vehicles.filter(
        (vehicle) =>
          vehicle.status ===
          'SEDANG DIGUNAKAN'
      ),
    [vehicles]
  );

  /* =======================================================
     BEGIN MODE
  ======================================================= */

  const begin = async (
    nextMode: 'exit' | 'entry'
  ) => {
    setMode(nextMode);
    setError(null);
    setMessage(null);
    setForm(initialForm);
    setActiveLog(null);

    await loadVehicles();
  };

  /* =======================================================
     CHOOSE ENTRY VEHICLE
  ======================================================= */

  const chooseEntry = async (
    vehicle: Vehicle
  ) => {
    setError(null);
    setMessage(null);

    const {
      data,
      error: queryError,
    } = await supabase
      .from('vehicle_logs')
      .select(
        '*, vehicle:vehicles(name)'
      )
      .eq(
        'vehicle_id',
        vehicle.id
      )
      .is(
        'entry_time',
        null
      )
      .order(
        'exit_time',
        {
          ascending: false,
        }
      )
      .limit(1)
      .maybeSingle();

    if (queryError) {
      console.error(
        'ENTRY QUERY ERROR:',
        queryError
      );

      setError(
        'Gagal mengambil data perjalanan kendaraan.'
      );

      return;
    }

    if (!data) {
      setError(
        'Data kendaraan yang sedang digunakan tidak ditemukan.'
      );

      return;
    }

    setActiveLog(
      data as VehicleLog
    );

    setForm((current) => ({
      ...current,
      vehicleId: vehicle.id,
      fuelPercentage: '',
      km: '',
      photo: null,
    }));
  };

  /* =======================================================
     PHOTO INPUT
  ======================================================= */

  const updatePhoto = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      event.target.files?.[0] ?? null;

    if (!file) {
      setForm((current) => ({
        ...current,
        photo: null,
      }));

      return;
    }

    if (
      !ALLOWED_PHOTO_TYPES.includes(
        file.type
      )
    ) {
      setError(
        'Foto harus berformat JPG, PNG, atau WEBP.'
      );

      event.target.value = '';

      return;
    }

    if (file.size > MAX_PHOTO_SIZE) {
      setError(
        'Ukuran foto maksimal 10 MB.'
      );

      event.target.value = '';

      return;
    }

    setForm((current) => ({
      ...current,
      photo: file,
    }));

    setError(null);
  };

  /* =======================================================
     SAVE VEHICLE EXIT
  ======================================================= */

  const saveExit = async (
    event: FormEvent
  ) => {
    event.preventDefault();

    setError(null);
    setMessage(null);

    if (
      !form.photo ||
      !uploadablePhoto(form.photo)
    ) {
      setError(
        'Foto odometer keluar wajib diunggah dan maksimal 10 MB.'
      );

      return;
    }

    if (
      !form.personnel ||
      !form.vehicleId ||
      !form.destination ||
      !form.purpose ||
      !form.km ||
      !form.fuelPercentage
    ) {
      setError(
        'Lengkapi semua kolom wajib terlebih dahulu.'
      );

      return;
    }

    const km = Number(form.km);

    if (
      !Number.isFinite(km) ||
      km < 0
    ) {
      setError(
        'KM odometer tidak valid.'
      );

      return;
    }

    const fuelPercentage =
      Number(form.fuelPercentage);

    if (
      !Number.isFinite(
        fuelPercentage
      ) ||
      fuelPercentage < 0 ||
      fuelPercentage > 100
    ) {
      setError(
        'Persentase BBM harus antara 0% sampai 100%.'
      );

      return;
    }

    setSaving(true);

    const vehicle =
      vehicles.find(
        (item) =>
          item.id ===
          form.vehicleId
      );

    if (!vehicle) {
      setSaving(false);

      setError(
        'Kendaraan tidak ditemukan.'
      );

      return;
    }

    /* =====================================================
       VEHICLE AVAILABILITY CHECK
    ===================================================== */

    if (
      vehicle.status !==
      'TERSEDIA'
    ) {
      setSaving(false);

      setError(
        'Kendaraan tersebut sedang tidak tersedia.'
      );

      return;
    }

    /* =====================================================
       UPLOAD FOTO
    ===================================================== */

    const extension =
      getPhotoExtension(
        form.photo
      );

    const path =
      `keluar/${vehicle.id}-${Date.now()}.${extension}`;

    const upload =
      await supabase.storage
        .from('vehicle-odometer')
        .upload(
          path,
          form.photo,
          {
            contentType:
              form.photo.type,
            upsert: false,
          }
        );

    if (upload.error) {
      console.error(
        'PHOTO UPLOAD ERROR:',
        upload.error
      );

      setError(
        `Foto belum dapat disimpan: ${upload.error.message}`
      );

      setSaving(false);

      return;
    }

    /* =====================================================
       INSERT LOG
    ===================================================== */

    const {
      error: logError,
    } = await supabase
      .from('vehicle_logs')
      .insert({
        vehicle_id:
          vehicle.id,

        personnel_name:
          form.personnel.trim(),

        destination:
          form.destination.trim(),

        purpose:
          form.purpose.trim(),

        km_exit:
          km,

        fuel_exit_percentage:
          fuelPercentage,

        /*
         * Saat kendaraan baru keluar,
         * BBM terpakai belum diketahui.
         */
        fuel_used_percentage:
          null,

        exit_odometer_photo:
          path,

        vehicle_condition:
          form.condition,

        notes:
          form.notes.trim() ||
          null,
      });

    if (logError) {
      console.error(
        'INSERT LOG ERROR:',
        logError
      );

      await supabase.storage
        .from('vehicle-odometer')
        .remove([path]);

      setError(
        `Data kendaraan keluar belum dapat disimpan: ${logError.message}`
      );

      setSaving(false);

      return;
    }

    /* =====================================================
       UPDATE VEHICLE
    ===================================================== */

    const {
      error: vehicleError,
    } = await supabase
      .from('vehicles')
      .update({
        status:
          'SEDANG DIGUNAKAN',

        current_km:
          km,

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        'id',
        vehicle.id
      );

    setSaving(false);

    if (vehicleError) {
      console.error(
        'VEHICLE UPDATE ERROR:',
        vehicleError
      );

      setError(
        'Log tersimpan, tetapi status kendaraan belum berubah.'
      );

      await loadVehicles();

      return;
    }

    setMessage(
      'Data kendaraan keluar berhasil disimpan.'
    );

    setForm(initialForm);

    setMode('home');

    await loadVehicles();
  };

  /* =======================================================
     SAVE VEHICLE ENTRY
  ======================================================= */

  const saveEntry = async (
    event: FormEvent
  ) => {
    event.preventDefault();

    setError(null);
    setMessage(null);

    if (!activeLog) {
      setError(
        'Data perjalanan kendaraan tidak ditemukan.'
      );

      return;
    }

    if (
      !form.photo ||
      !uploadablePhoto(form.photo)
    ) {
      setError(
        'Foto odometer masuk wajib diunggah dan maksimal 10 MB.'
      );

      return;
    }

    if (!form.km) {
      setError(
        'Isi KM odometer masuk terlebih dahulu.'
      );

      return;
    }

    if (!form.fuelPercentage) {
      setError(
        'Isi persentase BBM masuk terlebih dahulu.'
      );

      return;
    }

    const km = Number(form.km);

    if (
      !Number.isFinite(km) ||
      km < 0
    ) {
      setError(
        'KM odometer masuk tidak valid.'
      );

      return;
    }

    const kmExit =
      Number(activeLog.km_exit);

    if (km < kmExit) {
      setError(
        'KM odometer masuk tidak boleh lebih kecil dari KM odometer keluar.'
      );

      return;
    }

    const fuelPercentage =
      Number(form.fuelPercentage);

    if (
      !Number.isFinite(
        fuelPercentage
      ) ||
      fuelPercentage < 0 ||
      fuelPercentage > 100
    ) {
      setError(
        'Persentase BBM harus antara 0% sampai 100%.'
      );

      return;
    }

    const fuelExit =
      Number(
        activeLog.fuel_exit_percentage
      );

    if (
      Number.isFinite(fuelExit) &&
      fuelPercentage > fuelExit
    ) {
      setError(
        'Persentase BBM masuk tidak boleh lebih besar dari BBM keluar.'
      );

      return;
    }

    /* =====================================================
       TOTAL JARAK
    ===================================================== */

    const totalDistance =
      km - kmExit;

    /* =====================================================
       TOTAL FUEL PERCENTAGE
    ===================================================== */

    const fuelUsed =
      calculateFuelUsed(
        activeLog.fuel_exit_percentage,
        fuelPercentage
      );

    setSaving(true);

    const vehicle =
      vehicles.find(
        (item) =>
          item.id ===
          activeLog.vehicle_id
      );

    if (!vehicle) {
      setSaving(false);

      setError(
        'Data kendaraan tidak ditemukan.'
      );

      return;
    }

    /* =====================================================
       UPLOAD FOTO
    ===================================================== */

    const extension =
      getPhotoExtension(
        form.photo
      );

    const path =
      `masuk/${activeLog.vehicle_id}-${Date.now()}.${extension}`;

    const upload =
      await supabase.storage
        .from('vehicle-odometer')
        .upload(
          path,
          form.photo,
          {
            contentType:
              form.photo.type,
            upsert: false,
          }
        );

    if (upload.error) {
      console.error(
        'PHOTO ENTRY UPLOAD ERROR:',
        upload.error
      );

      setError(
        `Foto belum dapat disimpan: ${upload.error.message}`
      );

      setSaving(false);

      return;
    }

    /* =====================================================
       UPDATE LOG
    ===================================================== */

    const {
      error: logError,
    } = await supabase
      .from('vehicle_logs')
      .update({
        entry_time:
          new Date().toISOString(),

        km_entry:
          km,

        fuel_entry_percentage:
          fuelPercentage,

        /*
         * TOTAL FUEL PERCENTAGE
         *
         * Contoh:
         * BBM keluar = 80%
         * BBM masuk  = 55%
         * Fuel used  = 25%
         */
        fuel_used_percentage:
          fuelUsed,

        total_distance:
          totalDistance,

        entry_odometer_photo:
          path,

        vehicle_condition:
          form.condition,

        notes:
          form.notes.trim() ||
          activeLog.notes ||
          null,

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        'id',
        activeLog.id
      );

    if (logError) {
      console.error(
        'UPDATE LOG ERROR:',
        logError
      );

      await supabase.storage
        .from('vehicle-odometer')
        .remove([path]);

      setError(
        `Data kendaraan masuk belum dapat disimpan: ${logError.message}`
      );

      setSaving(false);

      return;
    }

    /* =====================================================
       UPDATE VEHICLE
    ===================================================== */

    const {
      error: vehicleError,
    } = await supabase
      .from('vehicles')
      .update({
        status:
          'TERSEDIA',

        current_km:
          km,

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        'id',
        vehicle.id
      );

    setSaving(false);

    if (vehicleError) {
      console.error(
        'VEHICLE ENTRY UPDATE ERROR:',
        vehicleError
      );

      setError(
        'Log kendaraan masuk berhasil, tetapi status kendaraan belum berubah.'
      );

      await loadVehicles();

      return;
    }

    setMessage(
      fuelUsed !== null
        ? `Data kendaraan masuk berhasil disimpan. Total BBM terpakai ${fuelUsed}%.`
        : 'Data kendaraan masuk berhasil disimpan.'
    );

    setMode('home');

    setActiveLog(null);

    setForm(initialForm);

    await loadVehicles();
  };

  /* =========================================================
     VEHICLE EXIT PAGE
  ========================================================= */

  if (mode === 'exit') {
    return (
      <FormShell
        title="Kendaraan Keluar"
        subtitle="Catat keberangkatan kendaraan operasional."
        onBack={() =>
          setMode('home')
        }
      >
        <form
          onSubmit={saveExit}
          className="space-y-5"
        >
          <Field
            label="Nama Personel"
            icon={
              <UserRound size={17} />
            }
          >
            <input
              className="field"
              value={
                form.personnel
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  personnel:
                    e.target.value,
                })
              }
              placeholder="Masukkan nama lengkap"
            />
          </Field>

          <Field
            label="Kendaraan"
            icon={
              <CarFront size={17} />
            }
          >
            <select
              className="field"
              value={
                form.vehicleId
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  vehicleId:
                    e.target.value,
                })
              }
            >
              <option value="">
                Pilih kendaraan
              </option>

              {available.map(
                (vehicle) => (
                  <option
                    key={
                      vehicle.id
                    }
                    value={
                      vehicle.id
                    }
                  >
                    {
                      vehicle.name
                    }
                  </option>
                )
              )}
            </select>

            {available.length ===
              0 && (
              <p className="mt-2 text-xs text-red-700">
                Tidak ada kendaraan
                yang tersedia saat
                ini.
              </p>
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Tanggal"
              icon={
                <Clock3 size={17} />
              }
            >
              <input
                className="field bg-slate-50"
                value={new Intl.DateTimeFormat(
                  'id-ID',
                  {
                    dateStyle:
                      'long',
                  }
                ).format(
                  new Date()
                )}
                readOnly
              />
            </Field>

            <Field
              label="Jam Keluar"
              icon={
                <Clock3 size={17} />
              }
            >
              <input
                className="field bg-slate-50"
                value={new Intl.DateTimeFormat(
                  'id-ID',
                  {
                    timeStyle:
                      'short',
                  }
                ).format(
                  new Date()
                )}
                readOnly
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Tujuan"
              icon={
                <MapPin size={17} />
              }
            >
              <input
                className="field"
                value={
                  form.destination
                }
                onChange={(e) =>
                  setForm({
                    ...form,
                    destination:
                      e.target.value,
                  })
                }
                placeholder="Contoh: Posko Selatan"
              />
            </Field>

            <Field
              label="Keperluan"
              icon={
                <ClipboardList
                  size={17}
                />
              }
            >
              <input
                className="field"
                value={
                  form.purpose
                }
                onChange={(e) =>
                  setForm({
                    ...form,
                    purpose:
                      e.target.value,
                  })
                }
                placeholder="Contoh: Operasi SAR"
              />
            </Field>
          </div>

          <Field
            label="KM / Odometer Keluar"
            icon={
              <Gauge size={17} />
            }
          >
            <input
              className="field"
              type="number"
              min="0"
              value={form.km}
              onChange={(e) =>
                setForm({
                  ...form,
                  km: e.target.value,
                })
              }
              placeholder="0"
            />
          </Field>

          {/* =================================================
              BBM KELUAR
          ================================================= */}

          <Field
            label="Persentase BBM Keluar"
            icon={
              <Gauge size={17} />
            }
          >
            <div className="relative">
              <input
                className="field pr-12"
                type="number"
                min="0"
                max="100"
                step="1"
                value={
                  form.fuelPercentage
                }
                onChange={(e) => {
                  const value =
                    e.target.value;

                  if (
                    value === '' ||
                    (
                      Number(value) >= 0 &&
                      Number(value) <= 100
                    )
                  ) {
                    setForm({
                      ...form,
                      fuelPercentage:
                        value,
                    });
                  }
                }}
                placeholder="Contoh: 80"
              />

              <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                %
              </span>
            </div>

            <p className="mt-2 text-xs text-slate-500">
              Isi perkiraan persentase BBM
              saat kendaraan berangkat.
            </p>
          </Field>

          <PhotoField
            file={form.photo}
            onChange={updatePhoto}
            label="Foto Odometer Keluar"
          />

          <Field label="Kondisi Kendaraan">
            <select
              className="field"
              value={
                form.condition
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  condition:
                    e.target.value,
                })
              }
            >
              {conditions.map(
                (item) => (
                  <option
                    key={item}
                  >
                    {item}
                  </option>
                )
              )}
            </select>
          </Field>

          <Field label="Catatan">
            <textarea
              className="field min-h-24 py-3"
              value={
                form.notes
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  notes:
                    e.target.value,
                })
              }
              placeholder="Tambahkan catatan bila diperlukan"
            />
          </Field>

          <StatusMessage
            error={error}
            success={message}
          />

          <button
            disabled={
              saving ||
              available.length === 0
            }
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-red-700 font-bold text-white shadow-lg shadow-red-700/20 transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? 'Menyimpan...'
              : 'Simpan Kendaraan Keluar'}

            <ChevronRight
              size={18}
            />
          </button>
        </form>
      </FormShell>
    );
  }

  /* =========================================================
     VEHICLE ENTRY PAGE
  ========================================================= */

  if (mode === 'entry') {
    return (
      <FormShell
        title="Kendaraan Masuk"
        subtitle="Pilih kendaraan yang sedang digunakan untuk menyelesaikan log."
        onBack={() =>
          setMode('home')
        }
      >
        <div className="space-y-5">

          {!activeLog && (
            <div>
              <p className="label">
                Kendaraan Sedang
                Digunakan
              </p>

              {inUse.length ===
              0 ? (
                <Empty text="Tidak ada kendaraan yang sedang digunakan." />
              ) : (
                <div className="space-y-3">
                  {inUse.map(
                    (vehicle) => (
                      <button
                        key={
                          vehicle.id
                        }
                        onClick={() =>
                          void chooseEntry(
                            vehicle
                          )
                        }
                        className="card flex w-full items-center justify-between p-4 text-left transition hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md"
                      >
                        <span>
                          <span className="block font-bold">
                            {
                              vehicle.name
                            }
                          </span>

                          <span className="mt-1 block text-xs text-slate-500">
                            Sedang
                            digunakan
                          </span>
                        </span>

                        <ChevronRight
                          className="text-red-700"
                          size={19}
                        />
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          )}

          {activeLog && (
            <form
              onSubmit={saveEntry}
              className="space-y-5"
            >

              {/* =================================================
                  DETAIL KEBERANGKATAN
              ================================================= */}

              <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-red-700">
                  Detail keberangkatan
                </p>

                <h3 className="mt-2 text-lg font-bold">
                  {
                    activeLog
                      .vehicle
                      ?.name
                  }
                </h3>

                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">

                  <Info
                    label="Personel"
                    value={
                      activeLog.personnel_name
                    }
                  />

                  <Info
                    label="Waktu keluar"
                    value={formatDate(
                      activeLog.exit_time
                    )}
                  />

                  <Info
                    label="Tujuan"
                    value={
                      activeLog.destination
                    }
                  />

                  <Info
                    label="KM keluar"
                    value={`${formatKm(
                      activeLog.km_exit
                    )} KM`}
                  />

                  <Info
                    label="BBM keluar"
                    value={formatFuel(
                      activeLog.fuel_exit_percentage
                    )}
                  />

                  <Info
                    label="Keperluan"
                    value={
                      activeLog.purpose
                    }
                  />

                </div>
              </div>

              {/* =================================================
                  KM MASUK
              ================================================= */}

              <Field
                label="KM / Odometer Masuk"
                icon={
                  <Gauge size={17} />
                }
              >
                <input
                  className="field"
                  type="number"
                  min={
                    activeLog.km_exit
                  }
                  value={
                    form.km
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      km: e.target.value,
                    })
                  }
                  placeholder={formatKm(
                    activeLog.km_exit
                  )}
                />
              </Field>

              {form.km &&
                Number(form.km) >=
                  Number(
                    activeLog.km_exit
                  ) && (
                  <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                    Total jarak:{' '}
                    {formatKm(
                      Number(
                        form.km
                      ) -
                        Number(
                          activeLog.km_exit
                        )
                    )}{' '}
                    KM
                  </div>
                )}

              {/* =================================================
                  BBM MASUK
              ================================================= */}

              <Field
                label="Persentase BBM Masuk"
                icon={
                  <Gauge size={17} />
                }
              >
                <div className="relative">
                  <input
                    className="field pr-12"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={
                      form.fuelPercentage
                    }
                    onChange={(e) => {
                      const value =
                        e.target.value;

                      if (
                        value === '' ||
                        (
                          Number(value) >= 0 &&
                          Number(value) <= 100
                        )
                      ) {
                        setForm({
                          ...form,
                          fuelPercentage:
                            value,
                        });
                      }
                    }}
                    placeholder="Contoh: 55"
                  />

                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                    %
                  </span>
                </div>

                <p className="mt-2 text-xs text-slate-500">
                  BBM saat kendaraan kembali.
                </p>
              </Field>

              {/* =================================================
                  TOTAL FUEL PERCENTAGE
              ================================================= */}

              {form.fuelPercentage &&
                Number(
                  form.fuelPercentage
                ) <=
                  Number(
                    activeLog.fuel_exit_percentage
                  ) && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">

                    <div className="flex items-start justify-between gap-4">

                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
                          Total Fuel Percentage
                        </p>

                        <p className="mt-1 text-sm font-semibold text-amber-800">
                          BBM terpakai selama perjalanan
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-3xl font-black text-amber-900">
                          {formatFuel(
                            calculateFuelUsed(
                              activeLog.fuel_exit_percentage,
                              form.fuelPercentage
                            )
                          )}
                        </p>
                      </div>

                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">

                      <div className="rounded-xl bg-white/70 p-3">
                        <p className="text-xs text-amber-700">
                          BBM Keluar
                        </p>

                        <p className="mt-1 text-lg font-black text-slate-900">
                          {formatFuel(
                            activeLog.fuel_exit_percentage
                          )}
                        </p>
                      </div>

                      <div className="rounded-xl bg-white/70 p-3">
                        <p className="text-xs text-amber-700">
                          BBM Masuk
                        </p>

                        <p className="mt-1 text-lg font-black text-slate-900">
                          {formatFuel(
                            form.fuelPercentage
                          )}
                        </p>
                      </div>

                    </div>

                    <div className="mt-3 rounded-xl bg-amber-100 px-4 py-3 text-xs font-semibold text-amber-800">
                      {formatFuel(
                        activeLog.fuel_exit_percentage
                      )}{' '}
                      −{' '}
                      {formatFuel(
                        form.fuelPercentage
                      )}{' '}
                      ={' '}
                      {formatFuel(
                        calculateFuelUsed(
                          activeLog.fuel_exit_percentage,
                          form.fuelPercentage
                        )
                      )}{' '}
                      BBM terpakai
                    </div>

                  </div>
                )}

              {/* =================================================
                  PHOTO
              ================================================= */}

              <PhotoField
                file={form.photo}
                onChange={updatePhoto}
                label="Foto Odometer Masuk"
              />

              {/* =================================================
                  CONDITION
              ================================================= */}

              <Field label="Kondisi Kendaraan">
                <select
                  className="field"
                  value={
                    form.condition
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      condition:
                        e.target.value,
                    })
                  }
                >
                  {conditions.map(
                    (item) => (
                      <option
                        key={item}
                      >
                        {item}
                      </option>
                    )
                  )}
                </select>
              </Field>

              {/* =================================================
                  NOTES
              ================================================= */}

              <Field label="Catatan">
                <textarea
                  className="field min-h-24 py-3"
                  value={
                    form.notes
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      notes:
                        e.target.value,
                    })
                  }
                  placeholder="Tambahkan catatan bila diperlukan"
                />
              </Field>

              <StatusMessage
                error={error}
                success={message}
              />

              <button
                disabled={saving}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 font-bold text-white shadow-lg shadow-emerald-700/20 transition hover:bg-emerald-800 disabled:opacity-50"
              >
                {saving
                  ? 'Menyimpan...'
                  : 'Simpan Kendaraan Masuk'}

                <CheckCircle2
                  size={18}
                />
              </button>

            </form>
          )}
        </div>
      </FormShell>
    );
  }

  /* =========================================================
     HOME
  ========================================================= */

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,_#fee2e2,_transparent_32%),linear-gradient(180deg,#f8fafc_0%,#eef2f6_100%)]">

      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-5 py-6 sm:px-8">

        <header className="flex items-center justify-between">

          <div className="flex items-center gap-3">

            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-red-700 text-white shadow-lg shadow-red-700/20">
              <CarFront size={22} />
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-red-700">
                SAR Operation
              </p>

              <h1 className="text-lg font-black tracking-tight">
                SAR Vehicle Log
              </h1>
            </div>

          </div>

          <a
            href="/admin/login"
            className="rounded-xl p-2 text-slate-400 transition hover:bg-white hover:text-red-700"
            aria-label="Admin"
          >
            <ShieldCheck
              size={20}
            />
          </a>

        </header>

        <section className="flex flex-1 flex-col justify-center py-16">

          <div className="mx-auto w-full max-w-2xl text-center">

            <p className="mb-3 text-sm font-semibold text-slate-500">
              Pencatatan Kendaraan
              SAR
            </p>

            <h2 className="text-4xl font-black tracking-tight text-slate-900 sm:text-6xl">
              Mobilitas aman,
              <br />
              <span className="text-red-700">
                operasi terpantau.
              </span>
            </h2>

            <p className="mx-auto mt-5 max-w-md text-sm leading-6 text-slate-500">
              Catat pergerakan
              kendaraan operasional
              dengan cepat dan rapi.
              Pilih kendaraan secara
              manual setelah membuka
              halaman ini.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">

              <button
                onClick={() =>
                  void begin('exit')
                }
                className="group relative flex min-h-40 flex-col items-start justify-between rounded-3xl bg-red-700 p-6 text-left text-white shadow-xl shadow-red-700/20 transition hover:-translate-y-1 hover:bg-red-800"
              >

                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15">
                  <LogOut size={22} />
                </span>

                <span>
                  <span className="block text-xl font-black">
                    Kendaraan
                    Keluar
                  </span>

                  <span className="mt-1 block text-sm text-red-100">
                    Catat keberangkatan
                    kendaraan
                  </span>
                </span>

                <ChevronRight
                  className="absolute right-6 bottom-6 transition group-hover:translate-x-1"
                  size={20}
                />

              </button>

              <button
                onClick={() =>
                  void begin('entry')
                }
                className="group relative flex min-h-40 flex-col items-start justify-between rounded-3xl bg-slate-900 p-6 text-left text-white shadow-xl shadow-slate-900/15 transition hover:-translate-y-1 hover:bg-slate-800"
              >

                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10">
                  <LogIn size={22} />
                </span>

                <span>
                  <span className="block text-xl font-black">
                    Kendaraan
                    Masuk
                  </span>

                  <span className="mt-1 block text-sm text-slate-300">
                    Selesaikan catatan
                    perjalanan
                  </span>
                </span>

                <ChevronRight
                  className="absolute right-6 bottom-6 transition group-hover:translate-x-1"
                  size={20}
                />

              </button>

            </div>

            {message && (
              <div className="mx-auto mt-6 max-w-lg rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-left text-emerald-800">

                <div className="flex gap-3">

                  <CheckCircle2
                    className="shrink-0"
                    size={20}
                  />

                  <div>

                    <p className="font-bold">
                      {message}
                    </p>

                    <p className="mt-1 text-sm">
                      Data perjalanan
                      sudah masuk ke
                      sistem monitoring.
                    </p>

                  </div>

                </div>

              </div>
            )}

            {error && (
              <div className="mx-auto mt-6 max-w-lg rounded-2xl border border-red-200 bg-red-50 p-5 text-left text-red-800">
                {error}
              </div>
            )}

          </div>

        </section>

        <footer className="flex items-center justify-between border-t border-slate-200/70 pt-5 text-xs text-slate-400">

          <span>
            Internal Operations
            System
          </span>

          <span className="flex items-center gap-1">
            <ShieldCheck
              size={13}
            />
            Secure field logging
          </span>

        </footer>

      </div>

    </main>
  );
}

/* =========================================================
   FORM SHELL
========================================================= */

function FormShell({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-slate-50">

      <div className="mx-auto max-w-2xl px-5 py-6 sm:px-8">

        <button
          onClick={onBack}
          className="mb-8 flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-red-700"
        >
          <ArrowLeft
            size={17}
          />
          Kembali
        </button>

        <div className="mb-8">

          <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-700">
            SAR Vehicle Log
          </p>

          <h1 className="mt-2 text-3xl font-black tracking-tight">
            {title}
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            {subtitle}
          </p>

        </div>

        <div className="card p-5 sm:p-8">
          {children}
        </div>

      </div>

    </main>
  );
}

/* =========================================================
   FIELD
========================================================= */

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">

      <span className="label flex items-center gap-2">
        {icon}
        {label}
      </span>

      {children}

    </label>
  );
}

/* =========================================================
   PHOTO FIELD
========================================================= */

function PhotoField({
  label,
  file,
  onChange,
}: {
  label: string;
  file: File | null;
  onChange: (
    event: ChangeEvent<HTMLInputElement>
  ) => void;
}) {
  return (
    <div>

      <span className="label flex items-center gap-2">

        <Camera size={17} />

        {label}

        <span className="text-red-700">
          *
        </span>

      </span>

      <label className="flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 transition hover:border-red-300 hover:bg-red-50/40">

        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white text-red-700 shadow-sm">

          {file ? (
            <CheckCircle2
              size={21}
            />
          ) : (
            <Upload size={21} />
          )}

        </span>

        <span>

          <span className="block text-sm font-bold">
            {file
              ? file.name
              : 'Ambil foto atau upload'}
          </span>

          <span className="mt-1 block text-xs text-slate-500">
            JPG, PNG, WEBP ·
            maksimal 10 MB
          </span>

        </span>

        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="hidden"
          onChange={onChange}
        />

      </label>

    </div>
  );
}

/* =========================================================
   STATUS MESSAGE
========================================================= */

function StatusMessage({
  error,
  success,
}: {
  error: string | null;
  success: string | null;
}) {
  if (!error && !success) {
    return null;
  }

  return (
    <div
      className={`rounded-xl p-4 text-sm font-medium ${
        error
          ? 'bg-red-50 text-red-800'
          : 'bg-emerald-50 text-emerald-800'
      }`}
    >
      {error ?? success}
    </div>
  );
}

/* =========================================================
   INFO
========================================================= */

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>

      <p className="text-xs text-red-700/70">
        {label}
      </p>

      <p className="mt-1 font-semibold text-slate-800">
        {value}
      </p>

    </div>
  );
}

/* =========================================================
   EMPTY
========================================================= */

function Empty({
  text,
}: {
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}