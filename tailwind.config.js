import defaultTheme from 'tailwindcss/defaultTheme'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      // Token warna tema — nilainya CSS variable (didefinisikan di index.css,
      // berubah saat <html class="dark">). Semua halaman memakai token ini,
      // bukan warna literal, agar tema terang/gelap konsisten.
      colors: {
        canvas: 'rgb(var(--c-canvas) / <alpha-value>)', //   latar halaman
        surface: 'rgb(var(--c-surface) / <alpha-value>)', // kartu
        surface2: 'rgb(var(--c-surface2) / <alpha-value>)', // panel halus/chip
        line: 'rgb(var(--c-line) / <alpha-value>)', //       border & track
        ink: 'rgb(var(--c-ink) / <alpha-value>)', //         teks utama
        dim: 'rgb(var(--c-dim) / <alpha-value>)', //         teks sekunder
        faint: 'rgb(var(--c-faint) / <alpha-value>)', //     teks samar
      },
      fontFamily: {
        sans: ['Nunito', ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
}
