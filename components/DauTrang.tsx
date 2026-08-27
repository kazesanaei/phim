'use client'

/**
 * Đầu trang trong suốt khi ở đỉnh, chuyển sang nền đặc khi cuộn xuống — để
 * banner phim đầu trang chủ không bị một thanh đen cắt ngang.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const MENU = [
  { href: '/', nhan: 'Trang chủ' },
  { href: '/duyet?danh-sach=phim-moi-cap-nhat', nhan: 'Mới cập nhật' },
  { href: '/duyet?danh-sach=phim-le', nhan: 'Phim lẻ' },
  { href: '/duyet?danh-sach=phim-bo', nhan: 'Phim bộ' },
  { href: '/duyet?nguon=local', nhan: 'Kho của tôi' },
  { href: '/bo-suu-tap', nhan: 'Bộ sưu tập' },
  { href: '/tai-ve', nhan: 'Tải về' },
]

export default function DauTrang({ oTim }: { oTim: React.ReactNode }) {
  const [daCuon, datDaCuon] = useState(false)
  const duong = usePathname()
  // Chỉ trang chủ mới có banner để mà trong suốt lên trên; trang khác nền đặc luôn.
  const coBanner = duong === '/'

  useEffect(() => {
    const f = () => datDaCuon(window.scrollY > 24)
    f()
    window.addEventListener('scroll', f, { passive: true })
    return () => window.removeEventListener('scroll', f)
  }, [])

  const dac = daCuon || !coBanner

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        dac
          ? 'border-b border-[var(--color-vien)] bg-[var(--color-nen)]/95 backdrop-blur'
          : 'bg-gradient-to-b from-black/80 to-transparent'
      }`}
    >
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-5 px-4">
        <Link href="/" className="shrink-0 text-lg font-extrabold tracking-tight text-[var(--color-nhan)]">
          KHO PHIM
        </Link>
        <nav className="hidden items-center gap-4 text-sm text-white/70 md:flex">
          {MENU.map((m) => (
            <Link key={m.href} href={m.href} className="transition hover:text-white">
              {m.nhan}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {oTim}
          <Link
            href="/quan-tri"
            className="rounded border border-[var(--color-vien)] px-3 py-1.5 text-xs text-white/70 transition hover:text-white"
          >
            Quản trị
          </Link>
        </div>
      </div>
    </header>
  )
}
