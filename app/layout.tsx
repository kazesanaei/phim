import type { Metadata } from 'next'
import { Suspense, ViewTransition } from 'react'
import { Inter } from 'next/font/google'
import './globals.css'
import OTimKiem from '@/components/OTimKiem'
import DauTrang from '@/components/DauTrang'
import PhimRemote from '@/components/PhimRemote'
import { SCRIPT_CHE_DO } from '@/lib/che-do'

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
    <html lang="vi" className={`${inter.variable} h-full antialiased`} data-che-do="pc">
      <head>
        {/* Đặt data-che-do TRƯỚC khi trang vẽ, nếu không màn TV sẽ chớp một nhịp
            giao diện PC rồi mới phóng to. Lý do không đọc cookie phía máy chủ:
            xem chú thích đầu lib/che-do.ts. */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_CHE_DO }} />
      </head>
      <body className="flex min-h-full flex-col">
        <DauTrang
          oTim={
            // useSearchParams() cần Suspense, không thì trang 404 tĩnh không prerender được
            <Suspense fallback={<div className="h-8 w-36 rounded border border-[var(--color-vien)] sm:w-48" />}>
              <OTimKiem />
            </Suspense>
          }
        />

        {/* Đầu trang giờ là fixed nên phải chừa chỗ; trang chủ thì banner chạy lên dưới nó.
            ViewTransition: nội dung cũ mờ đi rồi nội dung mới về, thay cho cú nhảy khô khốc.
            Trình duyệt không hỗ trợ thì bỏ qua, trang vẫn đổi bình thường — dáng animation
            nằm ở ::view-transition-old/new(root) trong globals.css. */}
        <main className="flex-1 pt-14 [&:has(.co-banner)]:pt-0">
          <ViewTransition>{children}</ViewTransition>
        </main>
        {/* Khe cho hộp thoại xem nhanh (intercepting route) */}
        {modal}

        {/* Nút Back của remote và điều hướng bằng mũi tên — chỉ có tác dụng ở chế độ TV */}
        <PhimRemote />

        <footer className="border-t border-[var(--color-vien)] px-4 py-6 text-center text-xs text-white/35">
          Chạy trên máy, dùng cá nhân
        </footer>
      </body>
    </html>
  )
}
