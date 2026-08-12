/*
===========================================================
SAR VEHICLE LOG - SUPABASE MIGRATION V2
===========================================================

Konsep akses:

PERSONEL / ANON
- Tidak perlu login
- Bisa melihat kendaraan aktif
- Bisa melakukan kendaraan keluar
- Bisa melihat kendaraan yang sedang digunakan
- Bisa melakukan kendaraan masuk
- Bisa upload foto odometer
- Tidak bisa menghapus data
- Tidak bisa mengubah histori secara bebas
- Tidak bisa mengelola kendaraan
- Tidak bisa mengelola maintenance

ADMIN / AUTHENTICATED
- Login menggunakan Supabase Auth
- Bisa melihat seluruh data
- Bisa mengelola kendaraan
- Bisa mengelola maintenance
- Bisa melihat foto
- Bisa mengelola log jika diperlukan

===========================================================
*/


/*
===========================================================
1. EXTENSION
===========================================================
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;


/*
===========================================================
2. TABLE: VEHICLES
===========================================================
*/

CREATE TABLE IF NOT EXISTS public.vehicles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    name text NOT NULL UNIQUE,

    status text NOT NULL DEFAULT 'TERSEDIA'
        CHECK (
            status IN (
                'TERSEDIA',
                'SEDANG DIGUNAKAN',
                'MAINTENANCE',
                'TIDAK AKTIF'
            )
        ),

    current_km numeric NOT NULL DEFAULT 0
        CHECK (current_km >= 0),

    active boolean NOT NULL DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now(),

    updated_at timestamptz NOT NULL DEFAULT now()
);


/*
===========================================================
3. TABLE: VEHICLE LOGS
===========================================================
*/

CREATE TABLE IF NOT EXISTS public.vehicle_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    vehicle_id uuid NOT NULL
        REFERENCES public.vehicles(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    personnel_name text NOT NULL,

    destination text NOT NULL,

    purpose text NOT NULL,

    exit_time timestamptz NOT NULL DEFAULT now(),

    entry_time timestamptz,

    km_exit numeric NOT NULL
        CHECK (km_exit >= 0),

    km_entry numeric
        CHECK (
            km_entry IS NULL
            OR km_entry >= km_exit
        ),

    total_distance numeric
        GENERATED ALWAYS AS (
            CASE
                WHEN km_entry IS NULL THEN NULL
                ELSE km_entry - km_exit
            END
        ) STORED,

    exit_odometer_photo text NOT NULL,

    entry_odometer_photo text,

    vehicle_condition text NOT NULL,

    notes text,

    created_at timestamptz NOT NULL DEFAULT now(),

    updated_at timestamptz NOT NULL DEFAULT now()
);


/*
===========================================================
4. TABLE: MAINTENANCE
===========================================================
*/

CREATE TABLE IF NOT EXISTS public.maintenance (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    vehicle_id uuid NOT NULL
        REFERENCES public.vehicles(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    maintenance_date date NOT NULL DEFAULT current_date,

    maintenance_type text NOT NULL,

    kilometer numeric NOT NULL DEFAULT 0
        CHECK (kilometer >= 0),

    description text,

    status text NOT NULL DEFAULT 'SELESAI'
        CHECK (
            status IN (
                'DIPROSES',
                'SELESAI'
            )
        ),

    notes text,

    created_at timestamptz NOT NULL DEFAULT now()
);


/*
===========================================================
5. INDEX
===========================================================
*/

CREATE INDEX IF NOT EXISTS vehicle_logs_vehicle_id_idx
ON public.vehicle_logs(vehicle_id);

CREATE INDEX IF NOT EXISTS vehicle_logs_exit_time_idx
ON public.vehicle_logs(exit_time);

CREATE INDEX IF NOT EXISTS vehicle_logs_entry_time_idx
ON public.vehicle_logs(entry_time);

CREATE INDEX IF NOT EXISTS vehicle_logs_personnel_name_idx
ON public.vehicle_logs(personnel_name);

CREATE INDEX IF NOT EXISTS vehicles_status_idx
ON public.vehicles(status);

CREATE INDEX IF NOT EXISTS maintenance_vehicle_id_idx
ON public.maintenance(vehicle_id);


/*
===========================================================
6. INITIAL VEHICLE DATA
===========================================================
*/

INSERT INTO public.vehicles (name)
VALUES
    ('Rescue D-Max Coumpertement 01'),
    ('Rescue Car 02'),
    ('Rescue Car 04'),
    ('Rescue Truck 05'),
    ('Rescue Truck 06'),
    ('Rescue Truck 08'),
    ('Rescue Truck 09'),
    ('Rescue Motorcycle')
ON CONFLICT (name) DO NOTHING;


/*
===========================================================
7. UPDATED_AT TRIGGER
===========================================================
*/

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS vehicles_updated_at
ON public.vehicles;

CREATE TRIGGER vehicles_updated_at
BEFORE UPDATE ON public.vehicles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


DROP TRIGGER IF EXISTS vehicle_logs_updated_at
ON public.vehicle_logs;

CREATE TRIGGER vehicle_logs_updated_at
BEFORE UPDATE ON public.vehicle_logs
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


/*
===========================================================
8. ADMIN CHECK FUNCTION
===========================================================

Admin ditentukan melalui:

Supabase Auth
User Metadata / App Metadata:

{
  "role": "admin"
}

===========================================================
*/

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
        false
    );
$$;


/*
===========================================================
9. ENABLE RLS
===========================================================
*/

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vehicle_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.maintenance ENABLE ROW LEVEL SECURITY;


/*
===========================================================
10. REMOVE OLD POLICIES
===========================================================
*/

DROP POLICY IF EXISTS "shared vehicles select"
ON public.vehicles;

DROP POLICY IF EXISTS "shared vehicles insert"
ON public.vehicles;

DROP POLICY IF EXISTS "shared vehicles update"
ON public.vehicles;

DROP POLICY IF EXISTS "shared vehicles delete"
ON public.vehicles;


DROP POLICY IF EXISTS "shared logs select"
ON public.vehicle_logs;

DROP POLICY IF EXISTS "shared logs insert"
ON public.vehicle_logs;

DROP POLICY IF EXISTS "shared logs update"
ON public.vehicle_logs;

DROP POLICY IF EXISTS "shared logs delete"
ON public.vehicle_logs;


DROP POLICY IF EXISTS "shared maintenance select"
ON public.maintenance;

DROP POLICY IF EXISTS "shared maintenance insert"
ON public.maintenance;

DROP POLICY IF EXISTS "shared maintenance update"
ON public.maintenance;

DROP POLICY IF EXISTS "shared maintenance delete"
ON public.maintenance;


/*
===========================================================
11. VEHICLES POLICIES
===========================================================

Personel:
- hanya dapat melihat kendaraan aktif

Admin:
- full access
===========================================================
*/

CREATE POLICY "public can view active vehicles"
ON public.vehicles
FOR SELECT
TO anon
USING (
    active = true
);


CREATE POLICY "admin can view all vehicles"
ON public.vehicles
FOR SELECT
TO authenticated
USING (
    public.is_admin()
);


CREATE POLICY "admin can insert vehicles"
ON public.vehicles
FOR INSERT
TO authenticated
WITH CHECK (
    public.is_admin()
);


CREATE POLICY "admin can update vehicles"
ON public.vehicles
FOR UPDATE
TO authenticated
USING (
    public.is_admin()
)
WITH CHECK (
    public.is_admin()
);


CREATE POLICY "admin can delete vehicles"
ON public.vehicles
FOR DELETE
TO authenticated
USING (
    public.is_admin()
);


/*
===========================================================
12. VEHICLE LOG POLICIES
===========================================================

Personel tidak diberikan akses SELECT langsung.

Akses personel menggunakan RPC.

Admin dapat membaca dan mengelola seluruh log.
===========================================================
*/

CREATE POLICY "admin can view logs"
ON public.vehicle_logs
FOR SELECT
TO authenticated
USING (
    public.is_admin()
);


CREATE POLICY "admin can insert logs"
ON public.vehicle_logs
FOR INSERT
TO authenticated
WITH CHECK (
    public.is_admin()
);


CREATE POLICY "admin can update logs"
ON public.vehicle_logs
FOR UPDATE
TO authenticated
USING (
    public.is_admin()
)
WITH CHECK (
    public.is_admin()
);


CREATE POLICY "admin can delete logs"
ON public.vehicle_logs
FOR DELETE
TO authenticated
USING (
    public.is_admin()
);


/*
===========================================================
13. MAINTENANCE POLICIES
===========================================================
*/

CREATE POLICY "admin can view maintenance"
ON public.maintenance
FOR SELECT
TO authenticated
USING (
    public.is_admin()
);


CREATE POLICY "admin can insert maintenance"
ON public.maintenance
FOR INSERT
TO authenticated
WITH CHECK (
    public.is_admin()
);


CREATE POLICY "admin can update maintenance"
ON public.maintenance
FOR UPDATE
TO authenticated
USING (
    public.is_admin()
)
WITH CHECK (
    public.is_admin()
);


CREATE POLICY "admin can delete maintenance"
ON public.maintenance
FOR DELETE
TO authenticated
USING (
    public.is_admin()
);


/*
===========================================================
14. RPC - GET ACTIVE VEHICLE LOG
===========================================================

Digunakan ketika personel memilih kendaraan
yang sedang digunakan pada menu KENDARAAN MASUK.

Personel hanya mendapatkan data yang diperlukan.
===========================================================
*/

CREATE OR REPLACE FUNCTION public.get_active_vehicle_log(
    p_vehicle_id uuid
)
RETURNS TABLE (
    id uuid,
    vehicle_id uuid,
    personnel_name text,
    destination text,
    purpose text,
    exit_time timestamptz,
    km_exit numeric,
    exit_odometer_photo text,
    vehicle_condition text,
    notes text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        vl.id,
        vl.vehicle_id,
        vl.personnel_name,
        vl.destination,
        vl.purpose,
        vl.exit_time,
        vl.km_exit,
        vl.exit_odometer_photo,
        vl.vehicle_condition,
        vl.notes
    FROM public.vehicle_logs vl
    WHERE vl.vehicle_id = p_vehicle_id
      AND vl.entry_time IS NULL
    ORDER BY vl.exit_time DESC
    LIMIT 1;
$$;


/*
===========================================================
15. RPC - VEHICLE CHECKOUT
===========================================================

Personel melakukan kendaraan keluar.

Function ini:
1. Memastikan kendaraan tersedia
2. Memastikan KM valid
3. Membuat log
4. Mengubah status kendaraan
5. Mengubah current KM

Semua dilakukan dalam SATU TRANSACTION.
===========================================================
*/

CREATE OR REPLACE FUNCTION public.vehicle_checkout(
    p_vehicle_id uuid,
    p_personnel_name text,
    p_destination text,
    p_purpose text,
    p_km_exit numeric,
    p_exit_odometer_photo text,
    p_vehicle_condition text,
    p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_vehicle_status text;
    v_current_km numeric;
    v_log_id uuid;
BEGIN

    IF trim(p_personnel_name) = '' THEN
        RAISE EXCEPTION 'Nama personel wajib diisi';
    END IF;

    IF trim(p_destination) = '' THEN
        RAISE EXCEPTION 'Tujuan wajib diisi';
    END IF;

    IF trim(p_purpose) = '' THEN
        RAISE EXCEPTION 'Keperluan wajib diisi';
    END IF;

    IF p_km_exit IS NULL OR p_km_exit < 0 THEN
        RAISE EXCEPTION 'KM odometer tidak valid';
    END IF;

    IF p_exit_odometer_photo IS NULL
       OR trim(p_exit_odometer_photo) = '' THEN
        RAISE EXCEPTION 'Foto odometer keluar wajib diisi';
    END IF;

    SELECT
        status,
        current_km
    INTO
        v_vehicle_status,
        v_current_km
    FROM public.vehicles
    WHERE id = p_vehicle_id
      AND active = true
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Kendaraan tidak ditemukan atau tidak aktif';
    END IF;

    IF v_vehicle_status <> 'TERSEDIA' THEN
        RAISE EXCEPTION 'Kendaraan tidak tersedia';
    END IF;

    IF p_km_exit < v_current_km THEN
        RAISE EXCEPTION
            'KM keluar tidak boleh lebih kecil dari KM kendaraan terakhir';
    END IF;

    INSERT INTO public.vehicle_logs (
        vehicle_id,
        personnel_name,
        destination,
        purpose,
        exit_time,
        km_exit,
        exit_odometer_photo,
        vehicle_condition,
        notes
    )
    VALUES (
        p_vehicle_id,
        trim(p_personnel_name),
        trim(p_destination),
        trim(p_purpose),
        now(),
        p_km_exit,
        p_exit_odometer_photo,
        trim(p_vehicle_condition),
        p_notes
    )
    RETURNING id INTO v_log_id;

    UPDATE public.vehicles
    SET
        status = 'SEDANG DIGUNAKAN',
        current_km = p_km_exit,
        updated_at = now()
    WHERE id = p_vehicle_id;

    RETURN v_log_id;
END;
$$;


/*
===========================================================
16. RPC - VEHICLE CHECKIN
===========================================================

Personel melakukan kendaraan masuk.

Function ini:
1. Mencari log aktif
2. Memvalidasi KM
3. Menyimpan KM masuk
4. Menyimpan foto
5. Mengubah status kendaraan menjadi TERSEDIA
6. Mengubah current KM
===========================================================
*/

CREATE OR REPLACE FUNCTION public.vehicle_checkin(
    p_vehicle_id uuid,
    p_km_entry numeric,
    p_entry_odometer_photo text,
    p_vehicle_condition text,
    p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_log_id uuid;
    v_km_exit numeric;
BEGIN

    IF p_km_entry IS NULL OR p_km_entry < 0 THEN
        RAISE EXCEPTION 'KM odometer masuk tidak valid';
    END IF;

    IF p_entry_odometer_photo IS NULL
       OR trim(p_entry_odometer_photo) = '' THEN
        RAISE EXCEPTION 'Foto odometer masuk wajib diisi';
    END IF;

    SELECT
        id,
        km_exit
    INTO
        v_log_id,
        v_km_exit
    FROM public.vehicle_logs
    WHERE vehicle_id = p_vehicle_id
      AND entry_time IS NULL
    ORDER BY exit_time DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Tidak ditemukan log kendaraan yang sedang digunakan';
    END IF;

    IF p_km_entry < v_km_exit THEN
        RAISE EXCEPTION
            'KM masuk tidak boleh lebih kecil dari KM keluar';
    END IF;

    UPDATE public.vehicle_logs
    SET
        entry_time = now(),
        km_entry = p_km_entry,
        entry_odometer_photo = p_entry_odometer_photo,
        vehicle_condition = trim(p_vehicle_condition),
        notes = COALESCE(p_notes, notes),
        updated_at = now()
    WHERE id = v_log_id;

    UPDATE public.vehicles
    SET
        status = 'TERSEDIA',
        current_km = p_km_entry,
        updated_at = now()
    WHERE id = p_vehicle_id;

    RETURN v_log_id;
END;
$$;


/*
===========================================================
17. RPC - GET VEHICLES CURRENTLY IN USE
===========================================================

Personel membutuhkan daftar kendaraan yang sedang digunakan
untuk menu KENDARAAN MASUK.

Hanya mengembalikan informasi kendaraan.
===========================================================
*/

CREATE OR REPLACE FUNCTION public.get_vehicles_in_use()
RETURNS TABLE (
    id uuid,
    name text,
    status text,
    current_km numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        v.id,
        v.name,
        v.status,
        v.current_km
    FROM public.vehicles v
    WHERE v.active = true
      AND v.status = 'SEDANG DIGUNAKAN'
    ORDER BY v.name;
$$;


/*
===========================================================
18. STORAGE BUCKET
===========================================================

Bucket dibuat PRIVATE.

Foto hanya dapat diakses menggunakan authenticated
atau signed URL.
===========================================================
*/

INSERT INTO storage.buckets (
    id,
    name,
    public
)
VALUES (
    'vehicle-odometer',
    'vehicle-odometer',
    false
)
ON CONFLICT (id)
DO UPDATE SET public = false;


/*
===========================================================
19. REMOVE OLD STORAGE POLICIES
===========================================================
*/

DROP POLICY IF EXISTS "public odometer read"
ON storage.objects;

DROP POLICY IF EXISTS "public odometer upload"
ON storage.objects;

DROP POLICY IF EXISTS "public odometer update"
ON storage.objects;

DROP POLICY IF EXISTS "public odometer delete"
ON storage.objects;


/*
===========================================================
20. STORAGE - PERSONNEL UPLOAD
===========================================================

Personel boleh upload foto.

Path yang digunakan aplikasi:

keluar/<uuid>.jpg
masuk/<uuid>.jpg

===========================================================
*/

CREATE POLICY "personnel can upload odometer"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
    bucket_id = 'vehicle-odometer'
    AND (
        name LIKE 'keluar/%'
        OR name LIKE 'masuk/%'
    )
);


/*
===========================================================
21. STORAGE - ADMIN READ
===========================================================
*/

CREATE POLICY "admin can read odometer"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'vehicle-odometer'
    AND public.is_admin()
);


/*
===========================================================
22. STORAGE - ADMIN UPDATE
===========================================================
*/

CREATE POLICY "admin can update odometer"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'vehicle-odometer'
    AND public.is_admin()
)
WITH CHECK (
    bucket_id = 'vehicle-odometer'
    AND public.is_admin()
);


/*
===========================================================
23. STORAGE - ADMIN DELETE
===========================================================
*/

CREATE POLICY "admin can delete odometer"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'vehicle-odometer'
    AND public.is_admin()
);


/*
===========================================================
24. RPC PERMISSIONS
===========================================================

Personel anonymous dapat menjalankan function yang memang
dibutuhkan aplikasi.

Mereka TIDAK mendapatkan akses langsung ke tabel.
===========================================================
*/

GRANT EXECUTE ON FUNCTION public.vehicle_checkout(
    uuid,
    text,
    text,
    text,
    numeric,
    text,
    text,
    text
) TO anon, authenticated;


GRANT EXECUTE ON FUNCTION public.vehicle_checkin(
    uuid,
    numeric,
    text,
    text,
    text
) TO anon, authenticated;


GRANT EXECUTE ON FUNCTION public.get_active_vehicle_log(
    uuid
) TO anon, authenticated;


GRANT EXECUTE ON FUNCTION public.get_vehicles_in_use()
TO anon, authenticated;


/*
===========================================================
25. ADMIN RPC PERMISSIONS
===========================================================
*/

GRANT EXECUTE ON FUNCTION public.is_admin()
TO authenticated;


/*
===========================================================
26. SECURITY SETTINGS
===========================================================
*/

REVOKE ALL
ON public.vehicles
FROM anon;

REVOKE ALL
ON public.vehicle_logs
FROM anon;

REVOKE ALL
ON public.maintenance
FROM anon;


/*
===========================================================
END OF MIGRATION
===========================================================
*/