// =============================================================================
// CodeQuest — Edge Function: student-login
// Rujukan: TechDecisions.md §2.2, DataModel.md §7.B, PRD §5.2
//
// Siswa tidak punya email. Login = Kelas -> Nama -> Password.
// Satu function, tiga action (agar deploy cukup satu):
//
//   { action: "options" }                      -> daftar kelas (untuk layar login)
//   { action: "options", class_id }            -> daftar nama siswa di kelas itu
//   { action: "login", class_id, name, password }
//       -> verifikasi password_hash, terbitkan JWT berisi klaim `student_id`
//   { action: "change_password", token, old_password, new_password }
//       -> wajib ganti password pertama kali (student.must_change_password)
//
// Kenapa "options" lewat function (service role), bukan query anon langsung?
// RLS sengaja menutup SEMUA akses anon; roster kelas hanya diekspos secukupnya
// (nama untuk dropdown login — alur yang memang diminta PRD §5.2).
//
// Guru TIDAK memakai fungsi ini — guru pakai Supabase Auth (email/password).
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SignJWT, jwtVerify } from 'https://esm.sh/jose@5'
import bcrypt from 'https://esm.sh/bcryptjs@2'

// Masa berlaku token sesi siswa: 12 jam — cukup untuk satu hari sekolah agar
// sesi tidak kedaluwarsa di tengah jam pelajaran. Risiko rendah: token siswa
// hanya membuka data miliknya sendiri (RLS), dan gamifikasi tidak memengaruhi
// nilai akademik (PRD prinsip #3).
const TOKEN_LIFETIME_SECONDS = 12 * 60 * 60

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  // SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY disuntik otomatis oleh Supabase.
  // JWT_SECRET di-set manual sebagai Edge Function Secret (nama secret buatan
  // sendiri tidak boleh diawali "SUPABASE_"); nilainya = JWT Secret project.
  // Fallback SUPABASE_JWT_SECRET untuk `supabase functions serve` lokal.
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const jwtSecret = Deno.env.get('JWT_SECRET') ?? Deno.env.get('SUPABASE_JWT_SECRET')
  if (!supabaseUrl || !serviceRoleKey || !jwtSecret) {
    return json({ error: 'Server misconfigured' }, 500)
  }

  // deno-lint-ignore no-explicit-any
  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  // Klien service role — mem-bypass RLS; HANYA untuk keperluan auth ini.
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const secret = new TextEncoder().encode(jwtSecret)
  const action = body.action ?? 'login'

  // ---------------------------------------------------------------------------
  // action: options — pilihan untuk layar login (kelas, lalu nama per kelas)
  // ---------------------------------------------------------------------------
  if (action === 'options') {
    if (body.class_id) {
      const { data, error } = await admin
        .from('student')
        .select('name')
        .eq('class_id', body.class_id)
        .order('name')
      if (error) return json({ error: 'Gagal memuat daftar nama' }, 500)
      return json({ students: (data ?? []).map((s) => s.name) })
    }

    const { data, error } = await admin
      .from('class')
      .select('id, name, semester:semester_id(name, academic_year:academic_year_id(label))')
      .order('created_at', { ascending: false })
    if (error) return json({ error: 'Gagal memuat daftar kelas' }, 500)
    return json({
      // deno-lint-ignore no-explicit-any
      classes: (data ?? []).map((c: any) => ({
        id: c.id,
        name: c.name,
        semester: c.semester?.name ?? null,
        year: c.semester?.academic_year?.label ?? null,
      })),
    })
  }

  // ---------------------------------------------------------------------------
  // action: login
  // ---------------------------------------------------------------------------
  if (action === 'login') {
    const { class_id, name, password } = body
    if (!class_id || !name || !password) {
      return json({ error: 'class_id, name, dan password wajib diisi' }, 400)
    }

    const { data: student, error } = await admin
      .from('student')
      .select('id, class_id, name, password_hash, must_change_password, total_xp, level')
      .eq('class_id', class_id)
      .eq('name', name)
      .maybeSingle()

    // Pesan seragam untuk kredensial salah (jangan bocorkan bagian mana yang salah).
    const invalid = () => json({ error: 'Kelas, nama, atau password salah' }, 401)
    if (error || !student) return invalid()

    const ok = bcrypt.compareSync(password, student.password_hash)
    if (!ok) return invalid()

    // Terbitkan JWT Supabase. sub = student.id; klaim student_id dibaca RLS
    // (current_student_id() di 0002_functions_triggers.sql).
    const now = Math.floor(Date.now() / 1000)
    const accessToken = await new SignJWT({
      role: 'authenticated',
      student_id: student.id,
      user_metadata: { name: student.name, kind: 'student' },
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(student.id)
      .setAudience('authenticated')
      .setIssuedAt(now)
      .setExpirationTime(now + TOKEN_LIFETIME_SECONDS)
      .sign(secret)

    return json({
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: TOKEN_LIFETIME_SECONDS,
      student: {
        id: student.id,
        class_id: student.class_id,
        name: student.name,
        must_change_password: student.must_change_password,
        total_xp: student.total_xp,
        level: student.level,
      },
    })
  }

  // ---------------------------------------------------------------------------
  // action: change_password — dipakai layar "wajib ganti password pertama kali"
  // ---------------------------------------------------------------------------
  if (action === 'change_password') {
    const { token, old_password, new_password } = body
    if (!token || !old_password || !new_password) {
      return json({ error: 'token, old_password, dan new_password wajib diisi' }, 400)
    }
    if (typeof new_password !== 'string' || new_password.length < 6) {
      return json({ error: 'Password baru minimal 6 karakter' }, 400)
    }

    // Verifikasi token sesi siswa yang diterbitkan action login di atas.
    let studentId: string | undefined
    try {
      const { payload } = await jwtVerify(token, secret)
      studentId = payload.student_id as string | undefined
    } catch {
      return json({ error: 'Sesi tidak valid atau kedaluwarsa' }, 401)
    }
    if (!studentId) return json({ error: 'Sesi tidak valid' }, 401)

    const { data: student, error } = await admin
      .from('student')
      .select('id, password_hash')
      .eq('id', studentId)
      .maybeSingle()
    if (error || !student) return json({ error: 'Siswa tidak ditemukan' }, 404)

    if (!bcrypt.compareSync(old_password, student.password_hash)) {
      return json({ error: 'Password lama salah' }, 401)
    }

    const { error: updateError } = await admin
      .from('student')
      .update({
        password_hash: bcrypt.hashSync(new_password, 10),
        must_change_password: false,
      })
      .eq('id', studentId)
    if (updateError) return json({ error: 'Gagal mengganti password' }, 500)

    return json({ ok: true })
  }

  return json({ error: `Action tidak dikenal: ${action}` }, 400)
})
