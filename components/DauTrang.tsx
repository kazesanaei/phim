'use client'

/**
 * Đầu trang trong suốt khi ở đỉnh, chuyển sang nền đặc khi cuộn xuống — để
 * banner phim đầu trang chủ không bị một thanh đen cắt ngang.
 *
 * Ba thứ nạp qua `/api/dau-trang` chứ không dựng sẵn trong layout: phim đang
 * xem dở, danh sách thể loại / quốc gia / năm. Lý do ghi ở đầu route đó.
 *
 * Menu mở bằng CLICK chứ không phải rê chuột: điều khiển TV và màn cảm ứng
 * không có "rê chuột", mà đây là hai thứ máy này hay dùng nhất.
 */
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { urlAnh } from '@/components/Anh'
import NutCheDo from '@/components/NutCheDo'
import MenuTv from '@/components/MenuTv'
import Logo from '@/components/Logo'
import { ChoLink } from '@/components/ThanhTai'
import { dungCheDo } from '@/components/dung-che-do'

/**
 * `phu`: mức ưu tiên khi đầu trang hẹp. 1 = giấu trước khi chật, 2 = giấu sớm
 * nhất. Mọi mục bị giấu vẫn có trong ngăn menu (nút ☰ hiện ra khi nav thu gọn).
 */
type Muc = { href: string; nhan: string; phu?: 1 | 2 }

const MENU: Muc[] = [
  { href: '/', nhan: 'Trang chủ' },
  { href: '/duyet?danh-sach=phim-moi-cap-nhat', nhan: 'Mới cập nhật' },
  { href: '/duyet?danh-sach=phim-le', nhan: 'Phim lẻ' },
  { href: '/duyet?danh-sach=phim-bo', nhan: 'Phim bộ' },
  { href: '/duyet?nguon=local', nhan: 'Kho của tôi', phu: 1 },
  { href: '/bo-suu-tap', nhan: 'Bộ sưu tập', phu: 2 },
  { href: '/lich', nhan: 'Lịch tuần', phu: 2 },
  { href: '/tai-ve', nhan: 'Tải về', phu: 2 },
]

type MucDanhMuc = { ten: string; slug: string }
type MucTiepTuc = {
  khoa: string
  slug: string
  tap: string | null
  ten: string
  poster: string | null
  phanTram: number
  nhan: string
}
type DuLieu = { tiepTuc: MucTiepTuc[]; theLoai: MucDanhMuc[]; quocGia: MucDanhMuc[]; nam: MucDanhMuc[] }

const RONG = 20000 // dữ liệu cũ hơn ngần này thì nạp lại khi mở menu

/**
 * Mục đang mở là mục có ĐỦ mọi tham số của nó trong URL hiện tại. Nhờ vậy
 * `/duyet?danh-sach=phim-le&the-loai=kinh-di` vẫn sáng ở "Phim lẻ", còn
 * `/duyet?nguon=local` thì không sáng nhầm sang đó.
 */
function khop(m: Muc, duong: string, tim: URLSearchParams): boolean {
  const [d, q] = m.href.split('?')
  if (d !== duong) return false
  if (!q) return true
  for (const [k, v] of new URLSearchParams(q)) if (tim.get(k) !== v) return false
  return true
}

/* ================================================================== */
/* Danh sách mục — một hàm dựng, hai nơi gọi (có và chưa có tham số)   */
/* ================================================================== */

function DsMuc({ chon, dong }: { chon: (m: Muc) => boolean; dong?: () => void }) {
  return (
    <>
      {MENU.map((m) => (
        <Link
          key={m.href}
          href={m.href}
          onClick={dong}
          data-chon={chon(m) ? '1' : undefined}
          /* `muc-phu-tv`: ở chế độ TV chữ to lên nên hàng menu vỡ thành 2–3 dòng.
             Mọi mục này đều đã có trong menu Duyệt, nên trên TV giấu bớt đi cho
             thanh đầu trang gọn lại — trừ Trang chủ. */
          data-phu-tv={m.href === '/' ? undefined : '1'}
          className={`gach-chan muc-menu whitespace-nowrap rounded-sm px-0.5 py-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white ${
            chon(m) ? 'font-semibold text-white' : 'hover:text-white'
          } ${m.phu === 2 ? 'hidden @min-[96rem]:inline-block' : m.phu === 1 ? 'hidden @min-[84rem]:inline-block' : ''}`}
        >
          {m.nhan}
          <ChoLink />
        </Link>
      ))}
    </>
  )
}

/** Bản có đọc tham số URL. Phải nằm trong <Suspense> để trang tĩnh còn dựng sẵn được. */
function DsMucDong({ dong }: { dong?: () => void }) {
  const duong = usePathname()
  const tim = useSearchParams()
  return <DsMuc chon={(m) => khop(m, duong, tim)} dong={dong} />
}

/* ================================================================== */

export default function DauTrang({ oTim }: { oTim: React.ReactNode }) {
  const [daCuon, datDaCuon] = useState(false)
  const [moMenu, datMoMenu] = useState<'duyet' | 'tiep' | null>(null)
  const [moNgan, datMoNgan] = useState(false)
  const [du, datDu] = useState<DuLieu | null>(null)
  const napLuc = useRef(0)
  const dangNap = useRef(false)
  const oHeader = useRef<HTMLElement>(null)
  const oNgan = useRef<HTMLDivElement>(null)
  const duong = usePathname()
  const laTv = dungCheDo() === 'tv'

  // Chỉ trang chủ mới có banner để mà trong suốt lên trên; trang khác nền đặc luôn.
  const coBanner = duong === '/'

  useEffect(() => {
    const f = () => datDaCuon(window.scrollY > 24)
    f()
    window.addEventListener('scroll', f, { passive: true })
    return () => window.removeEventListener('scroll', f)
  }, [])

  // Đổi trang thì đóng hết, không để menu treo lại trên trang mới.
  useEffect(() => {
    datMoMenu(null)
    datMoNgan(false)
  }, [duong])

  const nap = useCallback(async () => {
    if (dangNap.current || Date.now() - napLuc.current < RONG) return
    dangNap.current = true
    try {
      const r = await fetch('/api/dau-trang')
      if (r.ok) {
        datDu((await r.json()) as DuLieu)
        napLuc.current = Date.now()
      }
    } catch {
      // Mất mạng hoặc chưa đăng nhập: giữ nguyên dữ liệu cũ, menu vẫn mở được.
    } finally {
      dangNap.current = false
    }
  }, [])

  function batMenu(ten: 'duyet' | 'tiep') {
    datMoMenu((cu) => (cu === ten ? null : ten))
    void nap()
  }

  function batNgan() {
    datMoNgan((cu) => !cu)
    void nap()
  }

  // Escape đóng mọi thứ; bấm ra ngoài đóng menu thả xuống.
  useEffect(() => {
    if (!moMenu && !moNgan) return
    const phim = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        datMoMenu(null)
        datMoNgan(false)
      }
    }
    const cham = (e: MouseEvent) => {
      if (moMenu && oHeader.current && !oHeader.current.contains(e.target as Node)) datMoMenu(null)
    }
    document.addEventListener('keydown', phim)
    document.addEventListener('mousedown', cham)
    return () => {
      document.removeEventListener('keydown', phim)
      document.removeEventListener('mousedown', cham)
    }
  }, [moMenu, moNgan])

  // Ngăn kéo mở thì khoá cuộn nền và đưa con trỏ vào trong.
  useEffect(() => {
    if (!moNgan) return
    const cu = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    oNgan.current?.querySelector<HTMLElement>('a, button')?.focus()
    return () => {
      document.body.style.overflow = cu
    }
  }, [moNgan])

  /** Mũi tên lên/xuống chạy trong ngăn kéo — điều khiển TV chỉ có bấy nhiêu phím. */
  function phimTrongNgan(e: React.KeyboardEvent) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const cac = Array.from(oNgan.current?.querySelectorAll<HTMLElement>('a, button') ?? [])
    if (!cac.length) return
    e.preventDefault()
    const i = cac.indexOf(document.activeElement as HTMLElement)
    const buoc = e.key === 'ArrowDown' ? 1 : -1
    cac[(i + buoc + cac.length) % cac.length].focus()
  }

  const dac = daCuon || !coBanner || moMenu !== null

  return (
    <>
      <header
        ref={oHeader}
        className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
          dac
            ? 'border-b border-[var(--color-vien)] bg-[var(--color-nen)]/95 backdrop-blur'
            : 'bg-gradient-to-b from-black/80 to-transparent'
        }`}
      >
        {/*
          `@container`: đầu trang co giãn theo CHÍNH BỀ RỘNG CỦA NÓ tính bằng rem,
          không theo bề rộng màn hình (lg, xl...). Lý do: điểm ngắt màn hình luôn
          tính theo 16px gốc, còn cài đặt cỡ màn hình laptop (lib/man-hinh.ts)
          phóng cỡ chữ gốc lên — màn 1920px phóng 143% thì nội dung rộng như màn
          1340px, mà `xl:` vẫn tưởng là màn to và bày hết ra, tràn mất nút bên
          phải. Ngưỡng `@min-[..rem]` thì giãn theo đúng cỡ chữ đó.
        */}
        <div className="@container mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4 @min-[66rem]:gap-5">
          <button
            onClick={batNgan}
            aria-label="Mở menu"
            aria-expanded={moNgan}
            className="-ml-1 grid h-9 w-9 shrink-0 place-items-center rounded text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white @min-[66rem]:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z" />
            </svg>
          </button>

          <Link
            href="/"
            aria-label="Kho phim — trang chủ"
            className="shrink-0 transition-transform hover:scale-105"
          >
            <Logo />
          </Link>

          <nav className="an-tren-tv hidden items-center gap-3 text-sm text-white/70 @min-[66rem]:flex @min-[92rem]:gap-4">
            <Suspense fallback={<DsMuc chon={() => false} />}>
              <DsMucDong />
            </Suspense>

            <button
              onClick={() => batMenu('duyet')}
              aria-expanded={moMenu === 'duyet'}
              aria-haspopup="true"
              className={`gach-chan flex items-center gap-1 rounded-sm px-0.5 py-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white ${
                moMenu === 'duyet' ? 'font-semibold text-white' : 'hover:text-white'
              }`}
              data-chon={moMenu === 'duyet' ? '1' : undefined}
            >
              Duyệt
              <MuiTen mo={moMenu === 'duyet'} />
            </button>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => batMenu('tiep')}
              aria-expanded={moMenu === 'tiep'}
              aria-haspopup="true"
              title="Phim đang xem dở"
              className={`an-tren-tv hidden items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs transition @min-[46rem]:flex @min-[97rem]:px-3 ${
                moMenu === 'tiep'
                  ? 'border-white/40 text-white'
                  : 'border-[var(--color-vien)] text-white/70 hover:text-white'
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
                <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 10.6V6h-2v7.4l5.2 3.1 1-1.7z" />
              </svg>
              <span className="hidden @min-[97rem]:inline">Tiếp tục xem</span>
              <MuiTen mo={moMenu === 'tiep'} />
            </button>

            {/* Thẻ <a> chứ không phải <Link>: /ngau-nhien là route handler trả
                chuyển hướng, đi qua bộ định tuyến phía client là hỏng. */}
            <a
              href="/ngau-nhien"
              title="Bốc đại một phim rồi phát luôn"
              className="an-tren-tv flex items-center gap-1.5 rounded border border-[var(--color-vien)] px-2.5 py-1.5 text-xs text-white/70 transition hover:border-white/40 hover:text-white sm:px-3"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
                <path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm3 3.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm8 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-4 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-4 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm8 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" />
              </svg>
              <span className="hidden @min-[97rem]:inline">Xem gì đó đi</span>
            </a>

            {oTim}

            <NutCheDo />

            <Link
              href="/quan-tri"
              title="Quản trị"
              aria-label="Quản trị"
              className="an-tren-tv hidden items-center gap-1.5 rounded border border-[var(--color-vien)] px-2.5 py-1.5 text-xs text-white/70 transition hover:border-white/40 hover:text-white sm:flex @min-[88rem]:px-3"
            >
              <svg viewBox="0 0 24 24" aria-hidden className="h-3.5 w-3.5 fill-current @min-[88rem]:hidden">
                <path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7 7 0 0 0-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84a.48.48 0 0 0-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.74 8.87a.48.48 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.48.48 0 0 0-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z" />
              </svg>
              <span className="hidden @min-[88rem]:inline">Quản trị</span>
            </Link>
          </div>
        </div>

        {moMenu === 'duyet' && <BangDuyet du={du} dong={() => datMoMenu(null)} />}
        {moMenu === 'tiep' && <BangTiepTuc du={du} dong={() => datMoMenu(null)} />}
      </header>

      {/* Chế độ TV dùng ngăn hai tầng riêng: bảng thả xuống của bản PC không có
          chỗ nằm trên màn cao 540px, còn ngăn kéo điện thoại thì một cột dài
          phải cuộn nhiều — cả hai đều khổ khi lái bằng con trỏ ảo. */}
      {moNgan && laTv && <MenuTv du={du} dong={() => datMoNgan(false)} />}

      {moNgan && !laTv && (
        <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Menu">
          {/* Không gắn lg:hidden: nút ☰ giờ hiện cả trên laptop khi đầu trang chật */}
          <button
            aria-label="Đóng menu"
            onClick={() => datMoNgan(false)}
            className="mo-man absolute inset-0 h-full w-full cursor-default bg-black/70 backdrop-blur-sm"
          />
          <div
            ref={oNgan}
            onKeyDown={phimTrongNgan}
            className="truot-vao absolute inset-y-0 left-0 flex w-[86vw] max-w-sm flex-col overflow-y-auto border-r border-[var(--color-vien)] bg-[var(--color-nen)] p-5"
          >
            <NganKeo du={du} dong={() => datMoNgan(false)} />
          </div>
        </div>
      )}
    </>
  )
}

/* ================================================================== */

function MuiTen({ mo }: { mo: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={`h-3 w-3 fill-current transition-transform duration-200 ${mo ? 'rotate-180' : ''}`}
    >
      <path d="M7 10l5 5 5-5z" />
    </svg>
  )
}

function TieuDeCot({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/35">{children}</p>
}

function Vien({ children }: { children: React.ReactNode }) {
  return (
    <div className="buong-xuong max-h-[72vh] overflow-y-auto border-t border-[var(--color-vien)] bg-[var(--color-nen)]/98 backdrop-blur">
      <div className="mx-auto max-w-[1600px] px-4 py-5">{children}</div>
    </div>
  )
}

function ChoNap() {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: 14 }).map((_, i) => (
        <span key={i} className="o-cho relative h-6 w-20 overflow-hidden rounded-full bg-[var(--color-nen-2)]" />
      ))}
    </div>
  )
}

function Vien1({ href, ten, dong }: { href: string; ten: string; dong: () => void }) {
  return (
    <Link
      href={href}
      onClick={dong}
      className="rounded-full bg-white/8 px-2.5 py-1 text-xs text-white/70 transition hover:bg-white/20 hover:text-white focus-visible:ring-2 focus-visible:ring-white"
    >
      {ten}
      <ChoLink />
    </Link>
  )
}

function BangDuyet({ du, dong }: { du: DuLieu | null; dong: () => void }) {
  if (!du) {
    return (
      <Vien>
        <ChoNap />
      </Vien>
    )
  }
  const trong = !du.theLoai.length && !du.quocGia.length && !du.nam.length
  return (
    <Vien>
      {trong ? (
        <p className="text-sm text-white/50">
          Chưa lấy được danh mục từ nguồn. Vẫn lọc được trong{' '}
          <Link href="/duyet" onClick={dong} className="underline hover:text-white">
            trang Duyệt
          </Link>
          .
        </p>
      ) : (
        <div className="grid gap-6 md:grid-cols-[2fr_1fr_1fr]">
          <div>
            <TieuDeCot>Thể loại</TieuDeCot>
            <div className="flex flex-wrap gap-1.5">
              {du.theLoai.map((t) => (
                <Vien1 key={t.slug} href={`/duyet?the-loai=${t.slug}`} ten={t.ten} dong={dong} />
              ))}
            </div>
          </div>
          <div>
            <TieuDeCot>Quốc gia</TieuDeCot>
            <div className="flex flex-wrap gap-1.5">
              {du.quocGia.map((t) => (
                <Vien1 key={t.slug} href={`/duyet?quoc-gia=${t.slug}`} ten={t.ten} dong={dong} />
              ))}
            </div>
          </div>
          <div>
            <TieuDeCot>Năm</TieuDeCot>
            <div className="flex flex-wrap gap-1.5">
              {du.nam.map((t) => (
                <Vien1 key={t.slug} href={`/duyet?nam=${t.slug}`} ten={t.ten} dong={dong} />
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--color-vien)] pt-4 text-xs">
        <Vien1 href="/duyet?sap-xep=diem" ten="Điểm cao nhất" dong={dong} />
        <Vien1 href="/duyet?sap-xep=nam" ten="Mới nhất theo năm" dong={dong} />
        <Vien1 href="/duyet" ten="Xem tất cả" dong={dong} />
        {/* Ba mục này bị giấu khỏi thanh đầu trang khi chật (laptop 14", xem
            `phu` trong MENU) — phải luôn còn lối vào ở đây. */}
        <span className="mx-1 self-center text-white/20" aria-hidden>
          |
        </span>
        {MENU.filter((m) => m.phu).map((m) => (
          <Vien1 key={m.href} href={m.href} ten={m.nhan} dong={dong} />
        ))}
      </div>
    </Vien>
  )
}

function BangTiepTuc({ du, dong }: { du: DuLieu | null; dong: () => void }) {
  if (!du) {
    return (
      <Vien>
        <ChoNap />
      </Vien>
    )
  }
  if (!du.tiepTuc.length) {
    return (
      <Vien>
        <p className="text-sm text-white/50">Chưa có phim nào đang xem dở.</p>
      </Vien>
    )
  }
  return (
    <Vien>
      <TieuDeCot>Đang xem dở</TieuDeCot>
      <div className="an-cuon flex gap-3 overflow-x-auto pb-1">
        {du.tiepTuc.map((x) => (
          <Link
            key={x.khoa}
            href={`/xem/${x.slug}${x.tap ? '?tap=' + x.tap : ''}`}
            onClick={dong}
            className="group/tt w-40 shrink-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <div className="relative aspect-video overflow-hidden rounded bg-[var(--color-nen-2)]">
              {x.poster && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={urlAnh(x.poster, 400)}
                  alt=""
                  aria-hidden
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover/tt:scale-105"
                />
              )}
              <div className="absolute inset-x-0 bottom-0 h-1 bg-black/60">
                <div className="h-full bg-[var(--color-nhan)]" style={{ width: x.phanTram + '%' }} />
              </div>
            </div>
            <p className="mt-1.5 line-clamp-1 text-xs text-white/85">{x.ten}</p>
            <p className="text-[11px] text-white/40">{x.nhan}</p>
          </Link>
        ))}
      </div>
    </Vien>
  )
}

function NganKeo({ du, dong }: { du: DuLieu | null; dong: () => void }) {
  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <Logo />
        <button
          onClick={dong}
          aria-label="Đóng menu"
          className="grid h-9 w-9 place-items-center rounded text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
            <path d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z" />
          </svg>
        </button>
      </div>

      <a
        href="/ngau-nhien"
        className="mb-5 flex items-center justify-center gap-2 rounded bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/85"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
          <path d="M8 5v14l11-7z" />
        </svg>
        Xem gì đó đi
      </a>

      <nav className="flex flex-col gap-1 text-[15px] text-white/75">
        <Suspense fallback={<DsMucNgan chon={() => false} dong={dong} />}>
          <DsMucNganDong dong={dong} />
        </Suspense>
        <Link
          href="/quan-tri"
          onClick={dong}
          className="rounded px-2 py-2.5 transition hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white"
        >
          Quản trị
        </Link>
      </nav>

      <div className="mt-4 border-t border-[var(--color-vien)] pt-4">
        <NutCheDo dayDu />
      </div>

      {du && du.tiepTuc.length > 0 && (
        <div className="mt-6 border-t border-[var(--color-vien)] pt-4">
          <TieuDeCot>Đang xem dở</TieuDeCot>
          <div className="flex flex-col gap-1">
            {du.tiepTuc.slice(0, 5).map((x) => (
              <Link
                key={x.khoa}
                href={`/xem/${x.slug}${x.tap ? '?tap=' + x.tap : ''}`}
                onClick={dong}
                className="flex items-center gap-3 rounded p-1.5 transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white"
              >
                <span className="relative h-12 w-8 shrink-0 overflow-hidden rounded bg-[var(--color-nen-2)]">
                  {x.poster && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={urlAnh(x.poster, 200)} alt="" aria-hidden loading="lazy" className="h-full w-full object-cover" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 block text-sm text-white/85">{x.ten}</span>
                  <span className="block text-[11px] text-white/40">{x.nhan}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {du && du.theLoai.length > 0 && (
        <div className="mt-6 border-t border-[var(--color-vien)] pt-4">
          <TieuDeCot>Thể loại</TieuDeCot>
          <div className="flex flex-wrap gap-1.5">
            {du.theLoai.slice(0, 20).map((t) => (
              <Vien1 key={t.slug} href={`/duyet?the-loai=${t.slug}`} ten={t.ten} dong={dong} />
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function DsMucNgan({ chon, dong }: { chon: (m: Muc) => boolean; dong: () => void }) {
  return (
    <>
      {MENU.map((m) => (
        <Link
          key={m.href}
          href={m.href}
          onClick={dong}
          className={`rounded px-2 py-2.5 transition focus-visible:ring-2 focus-visible:ring-white ${
            chon(m)
              ? 'bg-white/10 font-semibold text-white'
              : 'hover:bg-white/10 hover:text-white'
          }`}
        >
          {m.nhan}
          <ChoLink />
        </Link>
      ))}
    </>
  )
}

function DsMucNganDong({ dong }: { dong: () => void }) {
  const duong = usePathname()
  const tim = useSearchParams()
  return <DsMucNgan chon={(m) => khop(m, duong, tim)} dong={dong} />
}
