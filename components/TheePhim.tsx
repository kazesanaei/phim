'use client'

/**
 * Thẻ phim + bảng nở ra khi rê chuột (kiểu Netflix).
 *
 * Bảng nở phải vẽ bằng portal ra <body>: hàng phim cuộn ngang dùng
 * `overflow-x: auto`, mà theo chuẩn CSS thì overflow-y khi đó không thể là
 * `visible` — vẽ tại chỗ là bị cắt cụt ngay.
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Anh from '@/components/Anh'
import type { PhimTom } from '@/lib/vsmov'
import { dungCheDo } from '@/components/dung-che-do'
import { docCheDo } from '@/lib/che-do'
import NutLuuNhanh from '@/components/NutLuuNhanh'

export type TienDoThe = { phanTram: number; nhan?: string }

const TRE_HIEN = 450
const TRE_AN = 120

type ViTri = { trai: number; tren: number; rong: number }

export default function TheePhim({
  phim,
  tienDo,
  huyHieu,
  href,
  soPhan,
  tenHienThi,
  thuHang,
  khoaXoa,
}: {
  phim: PhimTom
  tienDo?: TienDoThe
  huyHieu?: string
  href?: string
  soPhan?: number
  tenHienThi?: string
  /** Có giá trị thì vẽ số thứ hạng to phía sau thẻ (hàng Top 10). */
  thuHang?: number
  /** Khoá bản ghi "đang xem" — có thì hiện nút gỡ khỏi hàng Tiếp tục xem. */
  khoaXoa?: string
}) {
  const router = useRouter()
  const oRef = useRef<HTMLDivElement>(null)
  const hen = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [viTri, datViTri] = useState<ViTri | null>(null)

  const laTv = dungCheDo() === 'tv'
  const dich = href || `/phim/${phim.slug}`
  const ten = tenHienThi || phim.ten
  const nhieuPhan = (soPhan ?? 0) > 1

  const huyHen = () => {
    if (hen.current) clearTimeout(hen.current)
    hen.current = null
  }

  const moBang = useCallback(() => {
    /**
     * Không mở bảng ở chế độ TV.
     *
     * Remote lái một con trỏ ảo; nó đi ngang qua thẻ là bảng bật lên che mất
     * phần đang xem, mà bảng lại nằm ngoài luồng nên khó thoát. Trên máy tính
     * có chuột thật thì rê chuột là chủ ý, nên giữ nguyên.
     */
    if (docCheDo() === 'tv') return
    huyHen()
    hen.current = setTimeout(() => {
      const e = oRef.current
      if (!e) return
      const r = e.getBoundingClientRect()
      // Bảng rộng gấp rưỡi thẻ, canh giữa thẻ rồi kẹp lại trong màn hình.
      const rong = Math.max(r.width * 1.5, 240)
      const trai = Math.min(Math.max(8, r.left - (rong - r.width) / 2), window.innerWidth - rong - 8)
      datViTri({ trai, tren: r.top - 28, rong })
    }, TRE_HIEN)
  }, [])

  const dongBang = useCallback(() => {
    huyHen()
    hen.current = setTimeout(() => datViTri(null), TRE_AN)
  }, [])

  // Cuộn hoặc đổi cỡ màn hình thì toạ độ đã tính không còn đúng -> đóng luôn.
  useEffect(() => {
    if (!viTri) return
    const dong = () => datViTri(null)
    window.addEventListener('scroll', dong, true)
    window.addEventListener('resize', dong)
    return () => {
      window.removeEventListener('scroll', dong, true)
      window.removeEventListener('resize', dong)
    }
  }, [viTri])

  useEffect(() => () => huyHen(), [])

  async function goKhoiDangXem(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!khoaXoa) return
    await fetch('/api/xem', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ viec: 'xoa-tien-do', khoa: khoaXoa }),
    })
    datViTri(null)
    router.refresh()
  }

  return (
    <div ref={oRef} className="the-phim group/the relative" onMouseEnter={moBang} onMouseLeave={dongBang}>
      {/* Đặt NGOÀI <Link> để bấm lưu không kích hoạt link mở phim */}
      <NutLuuNhanh phim={phim} ten={ten} />

      <Link href={dich} title={ten} aria-label={ten} className="relative block focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
        {thuHang !== undefined && (
          /**
           * Số thứ hạng nằm BÊN TRÁI poster, chỉ gối lên mép một đoạn nhỏ.
           *
           * Neo theo <Link> (bọc đúng phần poster) chứ KHÔNG theo cả thẻ: neo
           * theo thẻ thì `bottom` rơi vào vùng chữ và số đè lên tên phim — đã
           * thấy thật trên ảnh chụp.
           *
           * `translate-x-full` đẩy số sang trái trọn bề rộng của chính nó, nên
           * mép phải của số luôn dừng đúng ở mốc `left`, không phụ thuộc số có
           * mấy chữ. Cách cũ đặt `-left-3` cố định nên số 1 chữ lòi ra 35%, số 2
           * chữ chỉ 22%; giờ mọi số đều gối vào poster đúng 12px.
           */
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-1 left-3 z-0 select-none text-[64px] font-black leading-none text-black [-webkit-text-stroke:2px_rgba(255,255,255,.35)] -translate-x-full sm:text-[76px]"
          >
            {thuHang}
          </span>
        )}

        {/* `khung-anh`: tỉ lệ khung do CSS quyết định (TV đổi sang 16/9), nên đổi
            chế độ không làm nhảy bố cục. Nguồn ảnh thì phải đổi bằng JS vì CSS
            không thay được `src`. */}
        <div className="khung-anh relative aspect-[2/3] overflow-hidden rounded-lg bg-[var(--color-nen-2)] shadow-lg ring-1 ring-white/5 transition duration-300 group-hover/the:ring-white/30">
          <Anh
            /**
             * TV dùng ảnh ngang 16:9 như Netflix/YouTube trên TV: ở 2,5 m mắt
             * đọc ảnh ngang kèm tên nhanh hơn poster dọc, và màn chỉ cao 540px
             * nên thẻ thấp hơn là thấy được nhiều hàng hơn. 18.351/18.719 phim
             * đã có sẵn ảnh ngang; phim nào không có thì lùi về poster.
             */
            src={laTv ? phim.anhNgang || phim.poster : phim.poster}
            alt={ten}
            rong={400}
            duPhong={ten}
            khungCho
            className="h-full w-full object-cover transition-transform duration-500 group-hover/the:scale-[1.06]"
          />

          {huyHieu ? (
            <span className="absolute left-1.5 top-1.5 rounded bg-[var(--color-nhan)] px-1.5 py-0.5 text-[10px] font-bold uppercase">
              {huyHieu}
            </span>
          ) : nhieuPhan ? (
            <span className="absolute left-1.5 top-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur">
              {soPhan} phần
            </span>
          ) : (
            phim.chatLuong && (
              <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white/85">
                {phim.chatLuong}
              </span>
            )
          )}

          {!nhieuPhan && phim.tapHienTai && (
            <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[10px] text-white/85">
              {phim.tapHienTai}
            </span>
          )}

          {tienDo && (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-black/60">
              <div
                className="h-full bg-[var(--color-nhan)]"
                style={{ width: Math.min(100, Math.max(2, tienDo.phanTram)) + '%' }}
              />
            </div>
          )}
        </div>
      </Link>

      <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-white/85 transition group-hover/the:text-white">
        {ten}
      </p>
      <p className="text-[11px] text-white/40">
        {tienDo?.nhan || [phim.nam, nhieuPhan ? `${soPhan} phần` : phim.tenGoc].filter(Boolean).join(' · ')}
      </p>

      {viTri &&
        createPortal(
          <div
            className="fixed z-[100] hidden animate-[hienBang_.18s_ease-out] overflow-hidden rounded-lg bg-[#181818] shadow-[0_16px_40px_rgba(0,0,0,.8)] ring-1 ring-white/10 md:block"
            style={{ left: viTri.trai, top: viTri.tren, width: viTri.rong }}
            onMouseEnter={huyHen}
            onMouseLeave={dongBang}
          >
            <Link href={dich} className="block">
              <div className="relative aspect-video w-full bg-black">
                <Anh src={phim.anhNgang || phim.poster} rong={400} anAnToan className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-transparent to-transparent" />
              </div>
            </Link>

            <div className="p-3">
              <div className="flex items-center gap-2">
                <Link
                  href={`/xem/${phim.slug}`}
                  aria-label={'Xem ' + ten}
                  className="grid h-9 w-9 place-items-center rounded-full bg-white text-black transition hover:bg-white/85"
                >
                  <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5 fill-current">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </Link>

                {khoaXoa ? (
                  <button
                    onClick={goKhoiDangXem}
                    title="Gỡ khỏi Tiếp tục xem"
                    aria-label="Gỡ khỏi Tiếp tục xem"
                    className="grid h-9 w-9 place-items-center rounded-full border-2 border-white/40 text-white/80 transition hover:border-white hover:text-white"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                      <path d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z" />
                    </svg>
                  </button>
                ) : (
                  <Link
                    href={dich}
                    title="Xem thông tin"
                    aria-label="Xem thông tin"
                    className="grid h-9 w-9 place-items-center rounded-full border-2 border-white/40 text-white/80 transition hover:border-white hover:text-white"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                      <path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
                    </svg>
                  </Link>
                )}

                <span className="ml-auto text-[11px] text-white/45">{phim.nguon === 'local' ? 'Trong máy' : ''}</span>
              </div>

              <p className="mt-2.5 line-clamp-1 text-sm font-semibold">{ten}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-white/60">
                {phim.diem && <span className="font-semibold text-emerald-400">{phim.diem} điểm</span>}
                {phim.nam && <span>{phim.nam}</span>}
                {phim.chatLuong && <span className="rounded-sm border border-white/25 px-1">{phim.chatLuong}</span>}
                {nhieuPhan ? <span>{soPhan} phần</span> : phim.tapHienTai && <span>{phim.tapHienTai}</span>}
              </p>
              {phim.tenGoc && <p className="mt-1 line-clamp-1 text-[11px] text-white/35">{phim.tenGoc}</p>}
              {tienDo?.nhan && <p className="mt-1 text-[11px] text-white/50">{tienDo.nhan}</p>}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
