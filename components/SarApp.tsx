'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Camera, CarFront, CheckCircle2, ChevronRight, ClipboardList, Clock3, FileText, Gauge, LogIn, LogOut, MapPin, ShieldCheck, Upload, UserRound, X } from 'lucide-react';
import { supabase, Vehicle, VehicleLog } from '@/lib/supabase';

const conditions = ['BAIK', 'PERLU PEMERIKSAAN', 'RUSAK RINGAN'];
type Mode = 'home' | 'exit' | 'entry';
type FormState = { personnel: string; vehicleId: string; destination: string; purpose: string; km: string; condition: string; notes: string; photo: File | null };
const initialForm: FormState = { personnel: '', vehicleId: '', destination: '', purpose: '', km: '', condition: 'BAIK', notes: '', photo: null };

function formatDate(value: string) { return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
function formatKm(value: number | string) { return new Intl.NumberFormat('id-ID').format(Number(value) || 0); }
function uploadablePhoto(file: File | null) { return file && ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && file.size <= 5 * 1024 * 1024; }

export default function SarApp() {
  const [mode, setMode] = useState<Mode>('home');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activeLog, setActiveLog] = useState<VehicleLog | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadVehicles = async () => {
    const { data } = await supabase.from('vehicles').select('*').eq('active', true).order('name');
    setVehicles((data as Vehicle[]) ?? []);
  };
  useEffect(() => { void loadVehicles(); }, []);

  const available = useMemo(() => vehicles.filter((vehicle) => vehicle.status === 'TERSEDIA'), [vehicles]);
  const inUse = useMemo(() => vehicles.filter((vehicle) => vehicle.status === 'SEDANG DIGUNAKAN'), [vehicles]);

  const begin = async (nextMode: 'exit' | 'entry') => {
    setMode(nextMode); setError(null); setMessage(null); setForm(initialForm); setActiveLog(null);
    await loadVehicles();
  };

  const chooseEntry = async (vehicle: Vehicle) => {
    setError(null);
    const { data, error: queryError } = await supabase.from('vehicle_logs').select('*, vehicle:vehicles(name)').eq('vehicle_id', vehicle.id).is('entry_time', null).order('exit_time', { ascending: false }).limit(1).maybeSingle();
    if (queryError || !data) { setError('Data kendaraan yang sedang digunakan tidak ditemukan.'); return; }
    setActiveLog(data as VehicleLog); setForm((current) => ({ ...current, vehicleId: vehicle.id }));
  };

  const updatePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (file && !uploadablePhoto(file)) { setError('Foto harus JPG, PNG, atau WEBP dan maksimal 5 MB.'); return; }
    setForm((current) => ({ ...current, photo: file })); setError(null);
  };

  const saveExit = async (event: FormEvent) => {
    event.preventDefault(); setError(null); setMessage(null);
    if (!form.photo || !uploadablePhoto(form.photo)) { setError('Foto odometer keluar wajib diunggah.'); return; }
    if (!form.personnel || !form.vehicleId || !form.destination || !form.purpose || !form.km) { setError('Lengkapi semua kolom wajib terlebih dahulu.'); return; }
    setSaving(true);
    const vehicle = vehicles.find((item) => item.id === form.vehicleId);
    if (!vehicle) { setSaving(false); return; }
    const path = `keluar/${vehicle.id}-${Date.now()}.${form.photo.name.split('.').pop()}`;
    const upload = await supabase.storage.from('vehicle-odometer').upload(path, form.photo, { contentType: form.photo.type });
    if (upload.error) { setError('Foto belum dapat disimpan. Silakan coba lagi.'); setSaving(false); return; }
    const { error: logError } = await supabase.from('vehicle_logs').insert({ vehicle_id: vehicle.id, personnel_name: form.personnel, destination: form.destination, purpose: form.purpose, km_exit: Number(form.km), exit_odometer_photo: path, vehicle_condition: form.condition, notes: form.notes || null });
    if (logError) { setError('Data kendaraan keluar belum dapat disimpan.'); setSaving(false); return; }
    const { error: vehicleError } = await supabase.from('vehicles').update({ status: 'SEDANG DIGUNAKAN', current_km: Number(form.km), updated_at: new Date().toISOString() }).eq('id', vehicle.id);
    setSaving(false);
    if (vehicleError) { setError('Log tersimpan, tetapi status kendaraan belum berubah.'); return; }
    setMessage('Data kendaraan keluar berhasil disimpan.'); setMode('home'); await loadVehicles();
  };

  const saveEntry = async (event: FormEvent) => {
    event.preventDefault(); setError(null); setMessage(null);
    if (!activeLog || !form.photo || !uploadablePhoto(form.photo)) { setError('Foto odometer masuk wajib diunggah.'); return; }
    if (!form.km) { setError('Isi KM odometer masuk terlebih dahulu.'); return; }
    const km = Number(form.km);
    if (km < Number(activeLog.km_exit)) { setError('KM odometer masuk tidak boleh lebih kecil dari KM odometer keluar.'); return; }
    setSaving(true);
    const vehicle = vehicles.find((item) => item.id === activeLog.vehicle_id);
    const path = `masuk/${activeLog.vehicle_id}-${Date.now()}.${form.photo.name.split('.').pop()}`;
    const upload = await supabase.storage.from('vehicle-odometer').upload(path, form.photo, { contentType: form.photo.type });
    if (upload.error || !vehicle) { setError('Foto belum dapat disimpan. Silakan coba lagi.'); setSaving(false); return; }
    const { error: logError } = await supabase.from('vehicle_logs').update({ entry_time: new Date().toISOString(), km_entry: km, entry_odometer_photo: path, vehicle_condition: form.condition, notes: form.notes || activeLog.notes, updated_at: new Date().toISOString() }).eq('id', activeLog.id);
    const { error: vehicleError } = await supabase.from('vehicles').update({ status: 'TERSEDIA', current_km: km, updated_at: new Date().toISOString() }).eq('id', vehicle.id);
    setSaving(false);
    if (logError || vehicleError) { setError('Data kendaraan masuk belum dapat diselesaikan.'); return; }
    setMessage('Data kendaraan masuk berhasil disimpan.'); setMode('home'); setActiveLog(null); await loadVehicles();
  };

  if (mode === 'exit') return <FormShell title="Kendaraan Keluar" subtitle="Catat keberangkatan kendaraan operasional." onBack={() => setMode('home')}><form onSubmit={saveExit} className="space-y-5"><Field label="Nama Personel" icon={<UserRound size={17} />}><input className="field" value={form.personnel} onChange={(e) => setForm({ ...form, personnel: e.target.value })} placeholder="Masukkan nama lengkap" /></Field><Field label="Kendaraan" icon={<CarFront size={17} />}><select className="field" value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}><option value="">Pilih kendaraan</option>{available.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}</select>{available.length === 0 && <p className="mt-2 text-xs text-red-700">Tidak ada kendaraan yang tersedia saat ini.</p>}</Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Tanggal" icon={<Clock3 size={17} />}><input className="field bg-slate-50" value={new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date())} readOnly /></Field><Field label="Jam Keluar" icon={<Clock3 size={17} />}><input className="field bg-slate-50" value={new Intl.DateTimeFormat('id-ID', { timeStyle: 'short' }).format(new Date())} readOnly /></Field></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Tujuan" icon={<MapPin size={17} />}><input className="field" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="Contoh: Posko Selatan" /></Field><Field label="Keperluan" icon={<ClipboardList size={17} />}><input className="field" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="Contoh: Operasi SAR" /></Field></div><Field label="KM / Odometer Keluar" icon={<Gauge size={17} />}><input className="field" type="number" min="0" value={form.km} onChange={(e) => setForm({ ...form, km: e.target.value })} placeholder="0" /></Field><PhotoField file={form.photo} onChange={updatePhoto} label="Foto Odometer Keluar" /><Field label="Kondisi Kendaraan"><select className="field" value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}>{conditions.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Catatan"><textarea className="field min-h-24 py-3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Tambahkan catatan bila diperlukan" /></Field><StatusMessage error={error} success={message} /><button disabled={saving || available.length === 0} className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-red-700 font-bold text-white shadow-lg shadow-red-700/20 transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Menyimpan...' : 'Simpan Kendaraan Keluar'} <ChevronRight size={18} /></button></form></FormShell>;

  if (mode === 'entry') return <FormShell title="Kendaraan Masuk" subtitle="Pilih kendaraan yang sedang digunakan untuk menyelesaikan log." onBack={() => setMode('home')}><div className="space-y-5">{!activeLog && <div><p className="label">Kendaraan Sedang Digunakan</p>{inUse.length === 0 ? <Empty text="Tidak ada kendaraan yang sedang digunakan." /> : <div className="space-y-3">{inUse.map((vehicle) => <button key={vehicle.id} onClick={() => void chooseEntry(vehicle)} className="card flex w-full items-center justify-between p-4 text-left transition hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md"><span><span className="block font-bold">{vehicle.name}</span><span className="mt-1 block text-xs text-slate-500">Sedang digunakan</span></span><ChevronRight className="text-red-700" size={19} /></button>)}</div>}</div>}{activeLog && <form onSubmit={saveEntry} className="space-y-5"><div className="rounded-2xl border border-red-100 bg-red-50 p-5"><p className="text-xs font-bold uppercase tracking-wider text-red-700">Detail keberangkatan</p><h3 className="mt-2 text-lg font-bold">{activeLog.vehicle?.name}</h3><div className="mt-4 grid grid-cols-2 gap-4 text-sm"><Info label="Personel" value={activeLog.personnel_name} /><Info label="Waktu keluar" value={formatDate(activeLog.exit_time)} /><Info label="Tujuan" value={activeLog.destination} /><Info label="KM keluar" value={`${formatKm(activeLog.km_exit)} KM`} /></div></div><Field label="KM / Odometer Masuk" icon={<Gauge size={17} />}><input className="field" type="number" min={activeLog.km_exit} value={form.km} onChange={(e) => setForm({ ...form, km: e.target.value })} placeholder={formatKm(activeLog.km_exit)} /></Field>{form.km && Number(form.km) >= Number(activeLog.km_exit) && <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">Total jarak: {formatKm(Number(form.km) - Number(activeLog.km_exit))} KM</div>}<PhotoField file={form.photo} onChange={updatePhoto} label="Foto Odometer Masuk" /><Field label="Kondisi Kendaraan"><select className="field" value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}>{conditions.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Catatan"><textarea className="field min-h-24 py-3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Tambahkan catatan bila diperlukan" /></Field><StatusMessage error={error} success={message} /><button disabled={saving} className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 font-bold text-white shadow-lg shadow-emerald-700/20 transition hover:bg-emerald-800 disabled:opacity-50">{saving ? 'Menyimpan...' : 'Simpan Kendaraan Masuk'} <CheckCircle2 size={18} /></button></form>}</div></FormShell>;

  return <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,_#fee2e2,_transparent_32%),linear-gradient(180deg,#f8fafc_0%,#eef2f6_100%)]"><div className="mx-auto flex min-h-screen max-w-5xl flex-col px-5 py-6 sm:px-8"><header className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-red-700 text-white shadow-lg shadow-red-700/20"><CarFront size={22} /></div><div><p className="text-[11px] font-bold uppercase tracking-[0.22em] text-red-700">SAR Operation</p><h1 className="text-lg font-black tracking-tight">SAR Vehicle Log</h1></div></div><a href="/admin/login" className="rounded-xl p-2 text-slate-400 transition hover:bg-white hover:text-red-700" aria-label="Admin"><ShieldCheck size={20} /></a></header><section className="flex flex-1 flex-col justify-center py-16"><div className="mx-auto w-full max-w-2xl text-center"><p className="mb-3 text-sm font-semibold text-slate-500">Pencatatan Kendaraan SAR</p><h2 className="text-4xl font-black tracking-tight text-slate-900 sm:text-6xl">Mobilitas aman,<br /><span className="text-red-700">operasi terpantau.</span></h2><p className="mx-auto mt-5 max-w-md text-sm leading-6 text-slate-500">Catat pergerakan kendaraan operasional dengan cepat dan rapi. Pilih kendaraan secara manual setelah membuka halaman ini.</p><div className="mt-10 grid gap-4 sm:grid-cols-2"><button onClick={() => void begin('exit')} className="group flex min-h-40 flex-col items-start justify-between rounded-3xl bg-red-700 p-6 text-left text-white shadow-xl shadow-red-700/20 transition hover:-translate-y-1 hover:bg-red-800"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15"><LogOut size={22} /></span><span><span className="block text-xl font-black">Kendaraan Keluar</span><span className="mt-1 block text-sm text-red-100">Catat keberangkatan kendaraan</span></span><ChevronRight className="absolute ml-[calc(100%-4rem)] mt-24 transition group-hover:translate-x-1" size={20} /></button><button onClick={() => void begin('entry')} className="group flex min-h-40 flex-col items-start justify-between rounded-3xl bg-slate-900 p-6 text-left text-white shadow-xl shadow-slate-900/15 transition hover:-translate-y-1 hover:bg-slate-800"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10"><LogIn size={22} /></span><span><span className="block text-xl font-black">Kendaraan Masuk</span><span className="mt-1 block text-sm text-slate-300">Selesaikan catatan perjalanan</span></span><ChevronRight className="absolute ml-[calc(100%-4rem)] mt-24 transition group-hover:translate-x-1" size={20} /></button></div>{message && <div className="mx-auto mt-6 max-w-lg rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-left text-emerald-800"><div className="flex gap-3"><CheckCircle2 className="shrink-0" size={20} /><div><p className="font-bold">{message}</p><p className="mt-1 text-sm">Data perjalanan sudah masuk ke sistem monitoring.</p></div></div></div>}</div></section><footer className="flex items-center justify-between border-t border-slate-200/70 pt-5 text-xs text-slate-400"><span>Internal Operations System</span><span className="flex items-center gap-1"><ShieldCheck size={13} /> Secure field logging</span></footer></div></main>;
}

function FormShell({ title, subtitle, onBack, children }: { title: string; subtitle: string; onBack: () => void; children: React.ReactNode }) { return <main className="min-h-screen bg-slate-50"><div className="mx-auto max-w-2xl px-5 py-6 sm:px-8"><button onClick={onBack} className="mb-8 flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-red-700"><ArrowLeft size={17} /> Kembali</button><div className="mb-8"><p className="text-xs font-bold uppercase tracking-[0.2em] text-red-700">SAR Vehicle Log</p><h1 className="mt-2 text-3xl font-black tracking-tight">{title}</h1><p className="mt-2 text-sm text-slate-500">{subtitle}</p></div><div className="card p-5 sm:p-8">{children}</div></div></main>; }
function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) { return <label className="block"><span className="label flex items-center gap-2">{icon}{label}</span>{children}</label>; }
function PhotoField({ label, file, onChange }: { label: string; file: File | null; onChange: (event: ChangeEvent<HTMLInputElement>) => void }) { return <div><span className="label flex items-center gap-2"><Camera size={17} />{label} <span className="text-red-700">*</span></span><label className="flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 transition hover:border-red-300 hover:bg-red-50/40"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white text-red-700 shadow-sm">{file ? <CheckCircle2 size={21} /> : <Upload size={21} />}</span><span><span className="block text-sm font-bold">{file ? file.name : 'Ambil foto atau upload'}</span><span className="mt-1 block text-xs text-slate-500">JPG, PNG, WEBP · maksimal 5 MB</span></span><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={onChange} /></label></div>; }
function StatusMessage({ error, success }: { error: string | null; success: string | null }) { if (!error && !success) return null; return <div className={`rounded-xl p-4 text-sm font-medium ${error ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'}`}>{error ?? success}</div>; }
function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-red-700/70">{label}</p><p className="mt-1 font-semibold text-slate-800">{value}</p></div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">{text}</div>; }
