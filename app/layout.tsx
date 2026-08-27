import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Inter } from 'next/font/google'
import './globals.css'
import OTimKiem from '@/components/OTimKiem'
import DauTrang from '@/components/DauTrang'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin', 'vietnamese'],
})

export const metadata: Metadata = {
  title: 'Kho phim',
  description: 'Trang xem phim cá nhân chạy trên máy',
}

export default function RootLayout({ children, modal }: LayoutProps<'/'>) {
  return (
    <html lang="vi" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <DauTrang
          oTim={
            // useSearchParams() cần Suspense, không thì trang 404 tĩnh không prerender được
            <Suspense fallback={<div className="h-8 w-36 rounded border border-[var(--color-vien)] sm:w-48" />}>
              <OTimKiem />
            </Suspense>
          }
        />

        {/* Đầu trang giờ là fixed nên phải chừa chỗ; trang chủ thì banner chạy lên dưới nó */}
        <main className="flex-1 pt-14 [&:has(.co-banner)]:pt-0">{children}</main>
        {/* Khe cho hộp thoại xem nhanh (intercepting route) */}
        {modal}

        <footer className="border-t border-[var(--color-vien)] px-4 py-6 text-center text-xs text-white/35">
          Chạy trên máy, dùng cá nhân
        </footer>
      </body>
    </html>
  )
}
