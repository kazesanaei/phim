'use client'

/**
 * Menu chính cho chế độ TV: ngăn trượt ra từ trái, hai tầng.
 *
 * VÌ SAO KHÔNG DÙNG BẢNG THẢ XUỐNG NHƯ BẢN PC:
 * màn hình Box chỉ cao 540px CSS. Một bảng thả xuống chứa ~40 thể loại + 24
 * quốc gia + 18 năm không có chỗ mà nằm — đã thử, nó bị cắt cụt chỉ còn ba dòng
 * tiêu đề. Chia hai tầng thì cột trái luôn ngắn, cột phải chỉ hiện đúng nhóm
 * đang chọn.
 *
 * VỀ ĐIỀU KHIỂN: remote của người dùng lái con trỏ ảo chứ không gửi phím. Nên
 * mọi thứ ở đây phải BẤM được, và vùng bấm phải rộng — con trỏ ảo đi chậm và
 * khó nhắm. Nhóm ở cột trái đổi theo cả rê chuột lẫn bấm: rê tới là hiện luôn,
 * đỡ được một nhịp bấm.
 */
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

type Muc = { ten: string; slug: string }
export type DuMenu = {
  tiepTuc: { khoa: string; slug: string; ten: string; phanTram: number; nhan: string }[]
  theLoai: Muc[]
  quocGia: Muc[]
  nam: Muc[]
}

/** Lối đi chính — không phụ thuộc dữ liệu nên luôn bấm được, kể cả khi API lỗi. */
const CHINH = [
  { href: '/', nhan: 'Trang chủ' },
  { href: '/duyet?danh-sach=phim-moi-cap-nhat', nhan: 'Mới cập nhật' },
  { href: '/duyet?danh-sach=phim-le', nhan: 'Phim lẻ' },
  { href: '/duyet?danh-sach=phim-bo', nhan: 'Phim bộ' },
  { href: '/duyet?nguon=local', nhan: 'Kho của tôi' },
  { href: '/bo-suu-tap', nhan: 'Bộ sưu tập' },
  { href: '/tai-ve', nhan: 'Tải về' },
]

type Nhom = 'the-loai' | 'quoc-gia' | 'nam' | 'tiep-tuc'

const TEN_NHOM: Record<Nhom, string> = {
  'the-loai': 'Thể loại',
  'quoc-gia': 'Quốc gia',
  nam: 'Năm',
  'tiep-tuc': 'Tiếp tục xem',
}

export default function MenuTv({ du, dong }: { du: DuMenu | null; dong: () => void }) {
  const [nhom, datNhom] = useState<Nhom | null>(null)
  const oNgan = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && dong()
    window.addEventListener('keydown', f)
    // Đưa tiêu điểm vào ngăn để trình duyệt nào có gửi phím thì đi lại được ngay.
    oNgan.current?.querySelector('a,button')?.dispatchEvent(new Event('focus'))
    return () => window.removeEventListener('keydown', f)
  }, [dong])

  const muc: Muc[] =
    nhom === 'the-loai' ? (du?.theLoai ?? []) : nhom === 'quoc-gia' ? (du?.quocGia ?? []) : nhom === 'nam' ? (du?.nam ?? []) : []

  const duong = (m: Muc) =>
    nhom === 'the-loai' ? `/duyet?the-loai=${m.slug}` : nhom === 'quoc-gia' ? `/duyet?quoc-gia=${m.slug}` : `/duyet?nam=${m.slug}`

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Menu" data-lop-phu-mo="1">
      <button
        aria-label="Đóng menu"
        onClick={dong}
        className="mo-man absolute inset-0 h-full w-full cursor-default bg-black/75 backdrop-blur-sm"
      />

      <div
        ref={oNgan}
        className="truot-vao absolute inset-y-0 left-0 flex border-r border-[var(--color-vien)] bg-[var(--color-nen)]"
      >
        {/* ---- Cột trái: lối đi chính + tên nhóm ---- */}
        <nav className="flex w-[15rem] shrink-0 flex-col overflow-y-auto py-3">
          <p className="px-4 pb-2 text-lg font-extrabold tracking-tight text-[var(--color-nhan)]">KHO PHIM</p>

          {/* Việc một-bấm-là-xong, để trên cùng: trên TV đây là thứ hay dùng nhất
              và nó vốn nằm ở đầu trang, giờ đầu trang đã rút gọn nên phải có chỗ.
              Thẻ <a> chứ không phải <Link>: /ngau-nhien là route handler trả
              chuyển hướng, đi qua bộ định tuyến phía client là hỏng. */}
          <a
            href="/ngau-nhien"
            className="muc-tv mx-3 mb-2 flex items-center justify-center gap-2 rounded bg-white px-3 py-2 font-semibold text-black transition hover:bg-white/85"
          >
            <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 fill-current">
              <path d="M8 5v14l11-7z" />
            </svg>
            Xem gì đó đi
          </a>

          {CHINH.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              onClick={dong}
              onMouseEnter={() => datNhom(null)}
              className="muc-tv px-4 py-1.5 text-white/80 transition hover:bg-white/12 hover:text-white"
            >
              {m.nhan}
            </Link>
          ))}

          <div className="my-2 border-t border-[var(--color-vien)]" />

          {(['the-loai', 'quoc-gia', 'nam', 'tiep-tuc'] as Nhom[]).map((n) => (
            <button
              key={n}
              // Rê tới là mở luôn: con trỏ ảo đi chậm, tiết kiệm được một nhịp bấm.
              onMouseEnter={() => datNhom(n)}
              onFocus={() => datNhom(n)}
              onClick={() => datNhom(n)}
              aria-expanded={nhom === n}
              /* Nhóm đang mở đánh dấu bằng NỀN ĐẶC + mũi tên đỏ chỉ sang phải,
                 chứ không phải vạch màu bên trái. Từ 2,5 m một khối nền liền
                 đọc ra nhanh hơn một vạch 4px, và mũi tên nói đúng thứ đang xảy
                 ra: nội dung của nhóm này đang nằm ở cột bên phải. */
              className={`muc-tv flex items-center justify-between px-4 py-1.5 text-left transition ${
                nhom === n
                  ? 'bg-white/15 font-semibold text-white'
                  : 'text-white/80 hover:bg-white/12 hover:text-white'
              }`}
            >
              {TEN_NHOM[n]}
              <span aria-hidden className={nhom === n ? 'text-[var(--color-nhan)]' : 'text-white/30'}>
                ›
              </span>
            </button>
          ))}

          <div className="my-2 border-t border-[var(--color-vien)]" />

          <Link
            href="/quan-tri"
            onClick={dong}
            onMouseEnter={() => datNhom(null)}
            className="muc-tv px-4 py-1.5 text-white/60 transition hover:bg-white/12 hover:text-white"
          >
            Quản trị
          </Link>
        </nav>

        {/* ---- Cột phải: chỉ hiện khi đã chọn nhóm, nên màn không bị chật vô cớ ---- */}
        {nhom && (
          <div className="w-[32rem] max-w-[52vw] overflow-y-auto border-l border-[var(--color-vien)] bg-[var(--color-nen-2)] p-3">
            <p className="px-1 pb-2 text-xs uppercase tracking-wide text-white/35">{TEN_NHOM[nhom]}</p>

            {nhom === 'tiep-tuc' ? (
              du?.tiepTuc.length ? (
                <div className="flex flex-col gap-1">
                  {du.tiepTuc.slice(0, 12).map((p) => (
                    <Link
                      key={p.khoa}
                      href={`/xem/${p.slug}`}
                      onClick={dong}
                      className="rounded px-2 py-2 text-sm text-white/85 transition hover:bg-white/10 hover:text-white"
                    >
                      <span className="block truncate">{p.ten}</span>
                      <span className="text-xs text-white/40">{p.nhan}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="px-2 py-6 text-sm text-white/40">Chưa xem dở phim nào.</p>
              )
            ) : muc.length ? (
              /* Ba cột chứ không phải hai: ~40 thể loại xếp 2 cột thành 20 hàng
                 = 680px, quá màn 540px nên phải cuộn — mà cuộn bằng con trỏ ảo
                 chính là thứ cần tránh. Ba cột còn 14 hàng, vừa trong màn. */
              <div className="grid grid-cols-3 gap-1">
                {muc.map((m) => (
                  <Link
                    key={m.slug}
                    href={duong(m)}
                    onClick={dong}
                    className="truncate rounded px-2 py-1.5 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
                  >
                    {m.ten}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="px-2 py-6 text-sm text-white/40">Đang nạp...</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
