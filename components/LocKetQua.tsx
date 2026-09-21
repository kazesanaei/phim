'use client'

/**
 * Thanh lọc ngay trong trang kết quả tìm kiếm.
 *
 * VÌ SAO LỌC BẰNG KHO TRONG MÁY: endpoint tìm kiếm của nguồn chỉ nhận từ khoá,
 * không nhận thêm điều kiện nào. Nên hễ bật một bộ lọc là trang chuyển sang
 * truy vấn kho đệm — chỗ duy nhất lọc được theo loại, năm và trạng thái đã xem.
 * Trang Duyệt cũng đang làm đúng như vậy, nên cách hành xử nhất quán.
 *
 * Bộ lọc đi qua URL chứ không giữ trong state: chia sẻ được link, và bấm Back
 * quay lại đúng bộ lọc trước đó.
 */
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

const LOAI = [
  { ma: '', nhan: 'Tất cả' },
  { ma: 'le', nhan: 'Phim lẻ' },
  { ma: 'bo', nhan: 'Phim bộ' },
]

export default function LocKetQua({ nam }: { nam: number[] }) {
  const router = useRouter()
  const sp = useSearchParams()

  const dat = useCallback(
    (khoa: string, giaTri: string) => {
      const m = new URLSearchParams(sp.toString())
      if (giaTri) m.set(khoa, giaTri)
      else m.delete(khoa)
      // Đổi bộ lọc thì về trang 1, không thì rơi vào trang trống.
      m.delete('trang')
      router.push('/tim-kiem?' + m.toString())
    },
    [router, sp],
  )

  const dangLoai = sp.get('loai') ?? ''
  const dangNam = sp.get('nam') ?? ''
  const chuaXem = sp.get('chua-xem') === '1'
  const coLoc = !!(dangLoai || dangNam || chuaXem)

  const oChip = (bat: boolean) =>
    `shrink-0 rounded-full px-3 py-1.5 text-xs transition ${
      bat
        ? 'bg-white font-semibold text-black'
        : 'bg-[var(--color-nen-2)] text-white/65 hover:bg-white/15 hover:text-white'
    }`

  return (
    <div className="mt-4 space-y-2">
      <div className="cuon-ngang flex items-center gap-2 overflow-x-auto pb-1">
        <span className="shrink-0 text-xs uppercase tracking-wide text-white/30">Loại</span>
        {LOAI.map((l) => (
          <button key={l.ma} onClick={() => dat('loai', l.ma)} className={oChip(dangLoai === l.ma)}>
            {l.nhan}
          </button>
        ))}

        <span className="ml-3 shrink-0 text-xs uppercase tracking-wide text-white/30">Năm</span>
        <button onClick={() => dat('nam', '')} className={oChip(!dangNam)}>
          Tất cả
        </button>
        {nam.map((n) => (
          <button key={n} onClick={() => dat('nam', String(n))} className={oChip(dangNam === String(n))}>
            {n}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => dat('chua-xem', chuaXem ? '' : '1')} className={oChip(chuaXem)}>
          {chuaXem ? '✓ ' : ''}Chưa xem
        </button>
        {coLoc && (
          <>
            <button
              onClick={() => router.push('/tim-kiem?q=' + encodeURIComponent(sp.get('q') ?? ''))}
              className="rounded-full px-3 py-1.5 text-xs text-white/45 underline underline-offset-2 transition hover:text-white"
            >
              Bỏ lọc
            </button>
            <span className="text-xs text-white/30">Đang lọc từ kho trong máy</span>
          </>
        )}
      </div>
    </div>
  )
}
