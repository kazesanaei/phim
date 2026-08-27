'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type { MucDanhMuc } from '@/lib/vsmov'

type Props = {
  theLoai: MucDanhMuc[]
  quocGia: MucDanhMuc[]
  nam: MucDanhMuc[]
  /** Kho đệm đã có dữ liệu thì mới bật sắp xếp và chọn nhiều thể loại. */
  coKho?: boolean
}

const DANH_SACH = [
  { slug: '', ten: 'Tất cả' },
  { slug: 'phim-moi-cap-nhat', ten: 'Mới cập nhật' },
  { slug: 'phim-le', ten: 'Phim lẻ' },
  { slug: 'phim-bo', ten: 'Phim bộ' },
  { slug: 'subteam', ten: 'Subteam' },
]

const SAP_XEP = [
  { ma: '', ten: 'Mặc định của nguồn' },
  { ma: 'diem', ten: 'Điểm cao nhất' },
  { ma: 'nam', ten: 'Mới nhất theo năm' },
  { ma: 'ten', ten: 'Tên A → Z' },
]

export default function ThanhLoc({ theLoai, quocGia, nam, coKho }: Props) {
  const router = useRouter()
  const sp = useSearchParams()
  const nguonLocal = sp.get('nguon') === 'local'
  const dsTheLoai = (sp.get('the-loai') || '').split(',').filter(Boolean)

  function doi(khoa: string, giaTri: string) {
    const m = new URLSearchParams(sp.toString())
    if (giaTri) m.set(khoa, giaTri)
    else m.delete(khoa)
    m.delete('trang')
    router.push('/duyet?' + m.toString())
  }

  /** Bật/tắt một thể loại trong danh sách nhiều thể loại. */
  function doiTheLoai(slug: string) {
    const co = dsTheLoai.includes(slug)
    const moi = co ? dsTheLoai.filter((x) => x !== slug) : [...dsTheLoai, slug]
    doi('the-loai', moi.join(','))
  }

  const coLoc = ['the-loai', 'quoc-gia', 'nam', 'danh-sach', 'sap-xep'].some((k) => sp.get(k))

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <O nhan="Nguồn" giaTri={nguonLocal ? 'local' : ''} onDoi={(v) => doi('nguon', v)}>
          <option value="">Từ vsmov</option>
          <option value="local">Trong máy</option>
        </O>

        {!nguonLocal && (
          <O nhan="Danh sách" giaTri={sp.get('danh-sach') || ''} onDoi={(v) => doi('danh-sach', v)}>
            {DANH_SACH.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.ten}
              </option>
            ))}
          </O>
        )}

        {/* Một thể loại: dùng được với cả nguồn trực tiếp lẫn kho đệm */}
        <O nhan="Thể loại" giaTri={dsTheLoai[0] || ''} onDoi={(v) => doi('the-loai', v)}>
          <option value="">Mọi thể loại</option>
          {theLoai.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.ten}
            </option>
          ))}
        </O>

        <O nhan="Quốc gia" giaTri={sp.get('quoc-gia') || ''} onDoi={(v) => doi('quoc-gia', v)}>
          <option value="">Mọi quốc gia</option>
          {quocGia.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.ten}
            </option>
          ))}
        </O>

        <O nhan="Năm" giaTri={sp.get('nam') || ''} onDoi={(v) => doi('nam', v)}>
          <option value="">Mọi năm</option>
          {nam.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.ten}
            </option>
          ))}
        </O>

        {coKho && !nguonLocal && (
          <O nhan="Sắp xếp" giaTri={sp.get('sap-xep') || ''} onDoi={(v) => doi('sap-xep', v)}>
            {SAP_XEP.map((s) => (
              <option key={s.ma} value={s.ma}>
                {s.ten}
              </option>
            ))}
          </O>
        )}

        {coLoc && (
          <button
            onClick={() => router.push(nguonLocal ? '/duyet?nguon=local' : '/duyet')}
            className="rounded border border-[var(--color-vien)] px-3 py-1.5 text-xs text-white/60 hover:text-white"
          >
            Xoá lọc
          </button>
        )}
      </div>

      {/* Chọn nhiều thể loại — chỉ kho đệm làm được, nguồn chỉ nhận một */}
      {coKho && !nguonLocal && (
        <details className="w-full max-w-2xl" open={dsTheLoai.length > 1}>
          <summary className="cursor-pointer list-none text-right text-xs text-white/45 hover:text-white">
            Lọc nhiều thể loại {dsTheLoai.length > 1 && `(${dsTheLoai.length})`} ▾
          </summary>
          <div className="mt-2 flex flex-wrap justify-end gap-1.5">
            {theLoai.map((t) => {
              const chon = dsTheLoai.includes(t.slug)
              return (
                <button
                  key={t.slug}
                  onClick={() => doiTheLoai(t.slug)}
                  className={`rounded-full px-2.5 py-1 text-xs transition ${
                    chon ? 'bg-white font-medium text-black' : 'bg-white/10 text-white/65 hover:bg-white/20'
                  }`}
                >
                  {t.ten}
                </button>
              )
            })}
          </div>
        </details>
      )}
    </div>
  )
}

function O({
  nhan,
  giaTri,
  onDoi,
  children,
}: {
  nhan: string
  giaTri: string
  onDoi: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-white/45">
      {nhan}
      <select
        value={giaTri}
        onChange={(e) => onDoi(e.target.value)}
        className="max-w-44 rounded border border-[var(--color-vien)] bg-[var(--color-nen-2)] px-2 py-1.5 text-sm text-white outline-none focus:border-white/40"
      >
        {children}
      </select>
    </label>
  )
}
