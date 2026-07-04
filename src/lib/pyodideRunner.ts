/**
 * Eksekusi kode Python siswa — Pyodide (WebAssembly) di dalam Web Worker.
 * Rujukan: TechDecisions §2.1, MVP-Scope §6.
 *
 * - Aman secara alami: WASM di browser tidak punya akses OS/filesystem.
 * - Timeout 5 detik: worker di-terminate dari main thread bila lewat batas
 *   (menangani infinite loop). Setelah terminate, worker baru dibuat dan
 *   Pyodide dimuat ulang pada run berikutnya.
 * - Input disuplai dari test case (bukan diketik interaktif): input() dibaca
 *   dari teks stdin baris per baris; habis = EOFError.
 * - Pyodide dimuat dari CDN agar ter-cache browser (isu ukuran unduhan,
 *   TechDecisions §5.3).
 */

const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/'
export const RUN_TIMEOUT_MS = 5000
const LOAD_TIMEOUT_MS = 120_000 // pemuatan pertama bisa lama di koneksi sekolah

export interface RunResult {
  stdout: string
  /** Traceback Python bila kode error; null bila sukses. */
  error: string | null
  timedOut: boolean
}

// Kode worker sebagai string (classic worker + importScripts CDN) — menghindari
// kerumitan bundling WASM; browser meng-cache unduhan Pyodide antar sesi.
const WORKER_SOURCE = `
importScripts('${PYODIDE_CDN}pyodide.js');
let pyodidePromise = loadPyodide({ indexURL: '${PYODIDE_CDN}' });

const HARNESS = \`
import sys, builtins, json, traceback
from io import StringIO

_lines = iter(__stdin_text.split('\\\\n'))
def _input(prompt=''):
    try:
        return next(_lines)
    except StopIteration:
        raise EOFError('Program meminta input lebih banyak dari yang disediakan test case')

_old_input = builtins.input
_old_stdout = sys.stdout
builtins.input = _input
_buf = StringIO()
sys.stdout = _buf
_error = None
try:
    exec(compile(__user_code, '<program>', 'exec'), {'__name__': '__main__'})
except BaseException:
    _error = traceback.format_exc(limit=-3)
finally:
    sys.stdout = _old_stdout
    builtins.input = _old_input
json.dumps({'stdout': _buf.getvalue(), 'error': _error})
\`;

self.onmessage = async (e) => {
  const { id, code, stdin } = e.data;
  try {
    const pyodide = await pyodidePromise;
    self.postMessage({ id, type: 'started' });
    pyodide.globals.set('__user_code', code);
    pyodide.globals.set('__stdin_text', stdin);
    const raw = await pyodide.runPythonAsync(HARNESS);
    const result = JSON.parse(raw);
    self.postMessage({ id, type: 'result', stdout: result.stdout, error: result.error });
  } catch (err) {
    self.postMessage({ id, type: 'result', stdout: '', error: String(err) });
  }
};
self.postMessage({ type: 'boot' });
`

type Pending = {
  resolve: (r: RunResult) => void
  timer: number | undefined
}

/**
 * Pengelola satu worker Pyodide. Antrean sederhana: satu run pada satu waktu
 * (cukup untuk auto-check yang menjalankan test case berurutan).
 */
class PyodideRunner {
  private worker: Worker | null = null
  private nextId = 1
  private pending = new Map<number, Pending>()
  private chain: Promise<unknown> = Promise.resolve()

  /** Mulai memuat Pyodide di latar (dipanggil saat halaman quest dibuka). */
  preload(): void {
    this.ensureWorker()
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker
    const blob = new Blob([WORKER_SOURCE], { type: 'application/javascript' })
    this.worker = new Worker(URL.createObjectURL(blob))
    this.worker.onmessage = (e: MessageEvent) => {
      const { id, type } = e.data
      if (type === 'started' && id !== undefined) {
        // Pyodide siap & kode mulai dieksekusi -> baru mulai hitung timeout 5 dtk.
        const p = this.pending.get(id)
        if (p && p.timer === undefined) {
          p.timer = window.setTimeout(() => this.onTimeout(id), RUN_TIMEOUT_MS)
        }
        return
      }
      if (type === 'result' && id !== undefined) {
        const p = this.pending.get(id)
        if (!p) return
        this.pending.delete(id)
        if (p.timer !== undefined) clearTimeout(p.timer)
        p.resolve({ stdout: e.data.stdout ?? '', error: e.data.error ?? null, timedOut: false })
      }
    }
    return this.worker
  }

  private onTimeout(id: number) {
    const p = this.pending.get(id)
    if (!p) return
    this.pending.delete(id)
    // Bunuh worker (satu-satunya cara menghentikan loop tak berujung di WASM).
    this.worker?.terminate()
    this.worker = null
    p.resolve({
      stdout: '',
      error: `Waktu habis: program berjalan lebih dari ${RUN_TIMEOUT_MS / 1000} detik (kemungkinan perulangan tak berhenti).`,
      timedOut: true,
    })
  }

  /** Jalankan kode dengan stdin tertentu; hasil selalu resolve (tidak throw). */
  run(code: string, stdin: string): Promise<RunResult> {
    const exec = () =>
      new Promise<RunResult>((resolve) => {
        const worker = this.ensureWorker()
        const id = this.nextId++
        // Jaga-jaga bila pemuatan Pyodide sendiri macet (jaringan sekolah).
        const loadGuard = window.setTimeout(() => this.onTimeout(id), LOAD_TIMEOUT_MS)
        this.pending.set(id, {
          resolve: (r) => {
            clearTimeout(loadGuard)
            resolve(r)
          },
          timer: undefined,
        })
        worker.postMessage({ id, code, stdin })
      })
    // Antrekan agar run berurutan memakai worker yang sama.
    const result = this.chain.then(exec, exec)
    this.chain = result
    return result as Promise<RunResult>
  }
}

/** Satu instance dipakai seluruh app (Pyodide berat — jangan dimuat ganda). */
export const pyodideRunner = new PyodideRunner()
