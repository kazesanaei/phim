'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'

type ThuMuc = { id: number; duong_dan: string; bat: number; la_thu_muc_tai: number }
type PhimHang = {
  slug: string
  ten: string
  tenGoc?: string
  nam?: number
  poster?: string
  loai?: string
  tapHienTai?: string
}
type TapHang = { id: number; so_tap: number; ten: string | null; duong_dan_file: string | null; can_chuyen_ma: number }

const TAB = [
  { ma: 'thu-muc', ten: 'Thư mục nguồn' },
  { ma: 'tai-len', ten: 'Tải file lên' },
  { ma: 'thu-vien', ten: 'Thư viện' },
  { ma: 'gom-tap', ten: 'Gom tập' },
  { ma: 'kho', ten: 'Kho đệm' },
] as const
type MaTab = (typeof TAB)[number]['ma']

async function goi(than: Record<string, unknown>) {
  const r = await fetch('/api/thu-vien', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(than),
  })
  return { ok: r.ok, ...(await r.json()) }
}

export default function TrangQuanTri() {
  const [tab, datTab] = useState<MaTab>('thu-muc')
  const [thuMuc, datThuMuc] = useState<ThuMuc[]>([])
  const [soPhim, datSoPhim] = useState(0)
  const [soTap, datSoTap] = useState(0)
  const [coFfmpeg, datCoFfmpeg] = useState(true)
  const [soViecTai, datSoViecTai] = useState('1')
  const [lan, datLan] = useState<{ bat: boolean; coMatKhau: boolean; diaChi: string[] } | null>(null)
  const [tin, datTin] = useState<string | null>(null)

  const nap = useCallback(async () => {
    const r = await fetch('/api/thu-vien')
    const j = await r.json()
    datThuMuc(j.thuMuc || [])
    datSoPhim(j.soPhim || 0)
    datSoTap(j.soTap || 0)
    datCoFfmpeg(j.coFfmpeg !== false)
    datSoViecTai(String(j.soViecTai || '1'))
    datLan(j.lan ?? null)
  }, [])

  useEffect(() => {
    nap()
  }, [nap])

  const bao = useCallback((t: string) => {
    datTin(t)
    setTimeout(() => datTin(null), 6000)
  }, [])

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Quản trị kho phim</h1>
          <p className="mt-1 text-sm text-white/45">
            {soPhim} phim · {soTap} tập trong máy
            {!coFfmpeg && ' · chưa thấy ffmpeg'}
          </p>
        </div>
        <Link href="/duyet?nguon=local" className="text-sm text-white/50 underline underline-offset-2 hover:text-white">
          Xem kho của tôi
        </Link>
      </div>

      <div className="mt-5 flex flex-wrap gap-1 border-b border-[var(--color-vien)]">
        {TAB.map((t) => (
          <button
            key={t.ma}
            onClick={() => datTab(t.ma)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm transition ${
              tab === t.ma
                ? 'border-[var(--color-nhan)] font-medium text-white'
                : 'border-transparent text-white/50 hover:text-white'
            }`}
          >
            {t.ten}
          </button>
        ))}
      </div>

      {tin && (
        <p className="mt-4 rounded border border-sky-500/30 bg-sky-500/10 px-4 py-2.5 text-sm text-sky-200">{tin}</p>
      )}

      <div className="mt-5">
        {tab === 'thu-muc' && (
          <TabThuMuc
            thuMuc={thuMuc}
            datThuMuc={datThuMuc}
            bao={bao}
            nap={nap}
            coFfmpeg={coFfmpeg}
            soViecTai={soViecTai}
            datSoViecTai={datSoViecTai}
            lan={lan}
          />
        )}
        {tab === 'tai-len' && <TabTaiLen thuMuc={thuMuc} bao={bao} />}
        {tab === 'thu-vien' && <TabThuVien bao={bao} nap={nap} />}
        {tab === 'gom-tap' && <TabGomTap bao={bao} nap={nap} />}
        {tab === 'kho' && <TabKho bao={bao} />}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function TabThuMuc({
  thuMuc,
  datThuMuc,
  bao,
  nap,
  coFfmpeg,
  soViecTai,
  datSoViecTai,
  lan,
}: {
  thuMuc: ThuMuc[]
  datThuMuc: (t: ThuMuc[]) => void
  bao: (t: string) => void
  nap: () => void
  coFfmpeg: boolean
  soViecTai: string
  datSoViecTai: (s: string) => void
  lan: { bat: boolean; coMatKhau: boolean; diaChi: string[] } | null
}) {
  const [duongDan, datDuongDan] = useState('')
  const [laTai, datLaTai] = useState(false)
  const [kiem, datKiem] = useState<string | null>(null)
  const [dangQuet, datDangQuet] = useState(false)

  async function kiemTra() {
    if (!duongDan.trim()) return
    datKiem('Đang kiểm...')
    const j = await goi({ viec: 'kiem-thu-muc', duongDan })
    datKiem(j.tin || j.loi || 'Không kiểm được')
  }

  async function them() {
    const j = await goi({ viec: 'them-thu-muc', duongDan, laThuMucTai: laTai })
    if (j.thuMuc) {
      datThuMuc(j.thuMuc)
      datDuongDan('')
      datKiem(null)
      bao('Đã thêm thư mục. Bấm "Quét lại" để nạp phim vào thư viện.')
    } else bao(j.loi || 'Không thêm được')
  }

  async function quet() {
    datDangQuet(true)
    const j = await goi({ viec: 'quet' })
    datDangQuet(false)
    nap()
    if (j.kq) {
      const k = j.kq
      bao(
        `Quét xong ${k.thuMuc} thư mục: thêm ${k.themPhim} phim, ${k.themTap} tập` +
          (k.boQua ? `, dọn ${k.boQua} bản ghi mất file` : '') +
          (k.loi?.length ? ` · ${k.loi.join('; ')}` : ''),
      )
    } else bao(j.loi || 'Quét lỗi')
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-sm font-semibold">Thêm thư mục</h2>
        <div className="flex flex-wrap gap-2">
          <input
            value={duongDan}
            onChange={(e) => {
              datDuongDan(e.target.value)
              datKiem(null)
            }}
            placeholder="D:\Phim   (dán đường dẫn thư mục)"
            className="min-w-64 flex-1 rounded border border-[var(--color-vien)] bg-[var(--color-nen-2)] px-3 py-2 text-sm outline-none focus:border-white/40"
          />
          <button onClick={kiemTra} className="rounded bg-white/10 px-4 py-2 text-sm hover:bg-white/20">
            Kiểm tra
          </button>
          <button
            onClick={them}
            disabled={!duongDan.trim()}
            className="rounded bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
          >
            Thêm
          </button>
        </div>
        <label className="mt-2 flex w-fit cursor-pointer items-center gap-2 text-sm text-white/60">
          <input type="checkbox" checked={laTai} onChange={(e) => datLaTai(e.target.checked)} />
          Dùng làm thư mục lưu phim tải về
        </label>
        {kiem && <p className="mt-2 text-sm text-white/60">{kiem}</p>}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Đang theo dõi ({thuMuc.length})</h2>
          <button
            onClick={quet}
            disabled={dangQuet || thuMuc.length === 0}
            className="rounded bg-white/10 px-4 py-2 text-sm hover:bg-white/20 disabled:opacity-40"
          >
            {dangQuet ? 'Đang quét...' : 'Quét lại'}
          </button>
        </div>

        {thuMuc.length === 0 ? (
          <p className="rounded border border-dashed border-[var(--color-vien)] px-4 py-8 text-center text-sm text-white/40">
            Chưa có thư mục nào. Dán đường dẫn ở trên để bắt đầu.
          </p>
        ) : (
          <ul className="space-y-2">
            {thuMuc.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center gap-3 rounded border border-[var(--color-vien)] bg-[var(--color-nen-2)] px-3 py-2.5"
              >
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!t.bat}
                    onChange={async (e) => {
                      const j = await goi({ viec: 'sua-thu-muc', id: t.id, bat: e.target.checked })
                      if (j.thuMuc) datThuMuc(j.thuMuc)
                    }}
                  />
                  <span className="break-all text-sm">{t.duong_dan}</span>
                </label>
                {!!t.la_thu_muc_tai && (
                  <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] text-emerald-300">
                    Thư mục tải về
                  </span>
                )}
                <div className="ml-auto flex gap-1.5">
                  {!t.la_thu_muc_tai && (
                    <button
                      onClick={async () => {
                        const j = await goi({ viec: 'sua-thu-muc', id: t.id, laThuMucTai: true })
                        if (j.thuMuc) datThuMuc(j.thuMuc)
                      }}
                      className="rounded bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20"
                    >
                      Đặt làm nơi tải về
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      if (!confirm('Bỏ thư mục này khỏi danh sách nguồn? File trên ổ đĩa không bị xoá.')) return
                      const j = await goi({ viec: 'xoa-thu-muc', id: t.id })
                      if (j.thuMuc) datThuMuc(j.thuMuc)
                    }}
                    className="rounded bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20"
                  >
                    Bỏ
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Cài đặt</h2>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2 text-white/60">
            Số phim tải cùng lúc
            <select
              value={soViecTai}
              onChange={async (e) => {
                datSoViecTai(e.target.value)
                await goi({ viec: 'cai-dat', soViecTai: e.target.value })
              }}
              className="rounded border border-[var(--color-vien)] bg-[var(--color-nen-2)] px-2 py-1.5 text-white"
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </select>
          </label>
          <span className={coFfmpeg ? 'text-emerald-400' : 'text-amber-400'}>
            {coFfmpeg ? 'ffmpeg sẵn sàng' : 'Chưa thấy ffmpeg — không tải về và không phát được .mkv lạ codec'}
          </span>
        </div>
      </section>

      <KhoiNguon bao={bao} />

      <KhoiPhuDe bao={bao} />

      <KhoiLan lan={lan} bao={bao} nap={nap} />
    </div>
  )
}

/* ------------------------------------------------------------------ */

type MucTai = { ten: string; phanTram: number; xong: boolean; loi?: string }

function TabTaiLen({ thuMuc, bao }: { thuMuc: ThuMuc[]; bao: (t: string) => void }) {
  const [dich, datDich] = useState<number | null>(null)
  const [ds, datDs] = useState<MucTai[]>([])
  const [keo, datKeo] = useState(false)
  const oRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (dich === null && thuMuc.length) datDich(thuMuc[0].id)
  }, [thuMuc, dich])

  function guiMot(f: File, chiSo: number) {
    return new Promise<void>((xong) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `/api/tai-len?thuMuc=${dich}&ten=${encodeURIComponent(f.name)}`)
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return
        const pt = (e.loaded / e.total) * 100
        datDs((d) => d.map((m, i) => (i === chiSo ? { ...m, phanTram: pt } : m)))
      }
      xhr.onload = () => {
        let loi: string | undefined
        if (xhr.status >= 400) {
          try {
            loi = JSON.parse(xhr.responseText).loi
          } catch {
            loi = 'Lỗi ' + xhr.status
          }
        }
        datDs((d) => d.map((m, i) => (i === chiSo ? { ...m, phanTram: 100, xong: !loi, loi } : m)))
        xong()
      }
      xhr.onerror = () => {
        datDs((d) => d.map((m, i) => (i === chiSo ? { ...m, loi: 'Đứt kết nối' } : m)))
        xong()
      }
      xhr.send(f)
    })
  }

  async function nhan(files: FileList | null) {
    if (!files?.length || dich === null) return
    const moi = [...files].map((f) => ({ ten: f.name, phanTram: 0, xong: false }))
    const batDau = ds.length
    datDs((d) => [...d, ...moi])
    for (const [i, f] of [...files].entries()) await guiMot(f, batDau + i)
    bao('Tải lên xong. Bấm "Quét lại" ở tab Thư mục nguồn để nạp vào thư viện.')
  }

  if (!thuMuc.length) {
    return (
      <p className="rounded border border-dashed border-[var(--color-vien)] px-4 py-10 text-center text-sm text-white/40">
        Cần có ít nhất một thư mục nguồn trước đã. Sang tab Thư mục nguồn để thêm.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <label className="flex flex-wrap items-center gap-2 text-sm text-white/60">
        Chép vào thư mục
        <select
          value={dich ?? ''}
          onChange={(e) => datDich(Number(e.target.value))}
          className="rounded border border-[var(--color-vien)] bg-[var(--color-nen-2)] px-2 py-1.5 text-white"
        >
          {thuMuc.map((t) => (
            <option key={t.id} value={t.id}>
              {t.duong_dan}
            </option>
          ))}
        </select>
      </label>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          datKeo(true)
        }}
        onDragLeave={() => datKeo(false)}
        onDrop={(e) => {
          e.preventDefault()
          datKeo(false)
          nhan(e.dataTransfer.files)
        }}
        onClick={() => oRef.current?.click()}
        className={`cursor-pointer rounded-lg border-2 border-dashed px-4 py-12 text-center transition ${
          keo ? 'border-white/60 bg-white/5' : 'border-[var(--color-vien)] hover:border-white/30'
        }`}
      >
        <p className="text-sm">Kéo thả file phim và phụ đề vào đây, hoặc bấm để chọn</p>
        <p className="mt-1 text-xs text-white/40">Nhận .mp4 .mkv .webm .m4v .avi .mov .ts .srt .vtt</p>
        <input
          ref={oRef}
          type="file"
          multiple
          accept=".mp4,.mkv,.webm,.m4v,.avi,.mov,.ts,.srt,.vtt"
          className="hidden"
          onChange={(e) => nhan(e.target.files)}
        />
      </div>

      <p className="text-xs text-white/40">
        File vài GB đi qua trình duyệt chậm hơn hẳn so với chép tay vào thư mục nguồn rồi bấm Quét lại. Cách này tiện
        khi phim đang nằm ở USB hoặc máy khác.
      </p>

      {ds.length > 0 && (
        <ul className="space-y-2">
          {ds.map((m, i) => (
            <li key={i} className="rounded border border-[var(--color-vien)] bg-[var(--color-nen-2)] px-3 py-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{m.ten}</span>
                <span className={m.loi ? 'text-red-400' : m.xong ? 'text-emerald-400' : 'text-white/50'}>
                  {m.loi || (m.xong ? 'Xong' : m.phanTram.toFixed(0) + '%')}
                </span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded bg-white/10">
                <div
                  className={`h-full ${m.loi ? 'bg-red-500' : m.xong ? 'bg-emerald-500' : 'bg-sky-500'}`}
                  style={{ width: m.phanTram + '%' }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function TabThuVien({ bao, nap }: { bao: (t: string) => void; nap: () => void }) {
  const [ds, datDs] = useState<PhimHang[]>([])
  const [tim, datTim] = useState('')
  const [sua, datSua] = useState<PhimHang | null>(null)

  const napDs = useCallback(async (k: string) => {
    const r = await fetch('/api/thu-vien?phim=1&tim=' + encodeURIComponent(k))
    const j = await r.json()
    datDs(j.items || [])
  }, [])

  useEffect(() => {
    napDs(tim)
  }, [tim, napDs])

  return (
    <div>
      <input
        value={tim}
        onChange={(e) => datTim(e.target.value)}
        placeholder="Lọc theo tên (gõ không dấu cũng được)"
        className="mb-4 w-full rounded border border-[var(--color-vien)] bg-[var(--color-nen-2)] px-3 py-2 text-sm outline-none focus:border-white/40"
      />

      {ds.length === 0 ? (
        <p className="rounded border border-dashed border-[var(--color-vien)] px-4 py-10 text-center text-sm text-white/40">
          Kho local chưa có phim nào. Thêm thư mục rồi bấm Quét lại.
        </p>
      ) : (
        <ul className="space-y-2">
          {ds.map((p) => (
            <li
              key={p.slug}
              className="flex items-center gap-3 rounded border border-[var(--color-vien)] bg-[var(--color-nen-2)] p-2"
            >
              {p.poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.poster} alt="" className="h-16 w-11 shrink-0 rounded object-cover" />
              ) : (
                <div className="grid h-16 w-11 shrink-0 place-items-center rounded bg-black/40 text-white/25">?</div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.ten}</p>
                <p className="truncate text-xs text-white/45">
                  {[p.tenGoc, p.nam, p.loai === 'bo' ? 'Phim bộ' : 'Phim lẻ', p.tapHienTai].filter(Boolean).join(' · ')}
                </p>
              </div>
              <Link href={`/phim/${p.slug}`} className="rounded bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20">
                Mở
              </Link>
              <button
                onClick={() => datSua(p)}
                className="rounded bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20"
              >
                Sửa
              </button>
            </li>
          ))}
        </ul>
      )}

      {sua && (
        <HopSua
          phim={sua}
          dong={() => datSua(null)}
          xong={() => {
            datSua(null)
            napDs(tim)
            nap()
            bao('Đã lưu')
          }}
        />
      )}
    </div>
  )
}

function HopSua({ phim, dong, xong }: { phim: PhimHang; dong: () => void; xong: () => void }) {
  const [ten, datTen] = useState(phim.ten)
  const [tenGoc, datTenGoc] = useState(phim.tenGoc || '')
  const [nam, datNam] = useState(String(phim.nam || ''))
  const [loai, datLoai] = useState(phim.loai === 'bo' ? 'bo' : 'le')
  const [moTa, datMoTa] = useState('')
  const [poster, datPoster] = useState(phim.poster || '')
  const [ungVien, datUngVien] = useState<PhimHang[]>([])
  const [dangTim, datDangTim] = useState(false)
  const [id, datId] = useState<number | null>(null)

  // Cần id thật để gọi API sửa; slug là thứ hiển thị ra ngoài.
  useEffect(() => {
    fetch('/api/thu-vien?tap=' + encodeURIComponent(phim.slug))
      .then((r) => r.json())
      .then((j) => {
        const t = (j.tap || [])[0]
        if (t) datId(t.phim_id ?? null)
      })
      .catch(() => {})
  }, [phim.slug])

  async function timNguon() {
    datDangTim(true)
    const j = await goi({ viec: 'tra-metadata', tuKhoa: ten })
    datUngVien(j.items || [])
    datDangTim(false)
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={dong}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-[var(--color-vien)] bg-[var(--color-nen)] p-5"
      >
        <h3 className="text-lg font-semibold">Sửa thông tin phim</h3>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <O nhan="Tên phim" giaTri={ten} datGiaTri={datTen} />
          <O nhan="Tên gốc" giaTri={tenGoc} datGiaTri={datTenGoc} />
          <O nhan="Năm" giaTri={nam} datGiaTri={datNam} />
          <label className="text-sm">
            <span className="mb-1 block text-white/50">Loại</span>
            <select
              value={loai}
              onChange={(e) => datLoai(e.target.value)}
              className="w-full rounded border border-[var(--color-vien)] bg-[var(--color-nen-2)] px-3 py-2 text-white"
            >
              <option value="le">Phim lẻ</option>
              <option value="bo">Phim bộ</option>
            </select>
          </label>
          <div className="sm:col-span-2">
            <O nhan="Ảnh poster (URL hoặc /poster/...)" giaTri={poster} datGiaTri={datPoster} />
          </div>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-white/50">Mô tả</span>
            <textarea
              value={moTa}
              onChange={(e) => datMoTa(e.target.value)}
              rows={3}
              className="w-full rounded border border-[var(--color-vien)] bg-[var(--color-nen-2)] px-3 py-2 text-sm outline-none focus:border-white/40"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={timNguon} className="rounded bg-white/10 px-4 py-2 text-sm hover:bg-white/20">
            {dangTim ? 'Đang tìm...' : 'Tìm trên vsmov'}
          </button>
          <button
            onClick={async () => {
              if (!id) return
              const j = await goi({ viec: 'trich-poster', id })
              if (j.poster) datPoster(j.poster)
            }}
            disabled={!id}
            className="rounded bg-white/10 px-4 py-2 text-sm hover:bg-white/20 disabled:opacity-40"
          >
            Trích poster từ video
          </button>
        </div>

        {ungVien.length > 0 && (
          <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto rounded border border-[var(--color-vien)] p-2">
            {ungVien.map((u) => (
              <li key={u.slug}>
                <button
                  onClick={async () => {
                    if (!id) return
                    const j = await goi({ viec: 'ap-metadata', id, slugNguon: u.slug })
                    if (j.ok) xong()
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-white/10"
                >
                  {u.poster && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.poster} alt="" className="h-12 w-8 rounded object-cover" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate">{u.ten}</span>
                    <span className="block truncate text-xs text-white/40">
                      {[u.tenGoc, u.nam].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex flex-wrap justify-between gap-2">
          <button
            onClick={async () => {
              if (!id) return
              if (!confirm('Xoá phim này khỏi thư viện? (File trên ổ đĩa GIỮ NGUYÊN)')) return
              await goi({ viec: 'xoa-phim', id, xoaCaFile: false })
              xong()
            }}
            disabled={!id}
            className="rounded bg-red-500/15 px-4 py-2 text-sm text-red-300 hover:bg-red-500/25 disabled:opacity-40"
          >
            Xoá khỏi thư viện
          </button>
          <div className="flex gap-2">
            <button onClick={dong} className="rounded bg-white/10 px-4 py-2 text-sm hover:bg-white/20">
              Đóng
            </button>
            <button
              onClick={async () => {
                if (!id) return
                await goi({
                  viec: 'sua-phim',
                  id,
                  ten,
                  tenGoc,
                  nam: Number(nam) || null,
                  loai,
                  moTa,
                  poster,
                })
                xong()
              }}
              disabled={!id}
              className="rounded bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
            >
              Lưu
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function O({
  nhan,
  giaTri,
  datGiaTri,
}: {
  nhan: string
  giaTri: string
  datGiaTri: (s: string) => void
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-white/50">{nhan}</span>
      <input
        value={giaTri}
        onChange={(e) => datGiaTri(e.target.value)}
        className="w-full rounded border border-[var(--color-vien)] bg-[var(--color-nen-2)] px-3 py-2 outline-none focus:border-white/40"
      />
    </label>
  )
}

/* ------------------------------------------------------------------ */

function TabGomTap({ bao, nap }: { bao: (t: string) => void; nap: () => void }) {
  const [ds, datDs] = useState<(PhimHang & { id?: number })[]>([])
  const [chon, datChon] = useState<string[]>([])
  const [ten, datTen] = useState('')
  const [tim, datTim] = useState('')
  const [tapCua, datTapCua] = useState<{ slug: string; tap: TapHang[] } | null>(null)

  const napDs = useCallback(async (k: string) => {
    const r = await fetch('/api/thu-vien?phim=1&tim=' + encodeURIComponent(k))
    const j = await r.json()
    datDs(j.items || [])
  }, [])

  useEffect(() => {
    napDs(tim)
  }, [tim, napDs])

  async function gom() {
    const ids: number[] = []
    for (const slug of chon) {
      const r = await fetch('/api/thu-vien?tap=' + encodeURIComponent(slug))
      const j = await r.json()
      const t = (j.tap || [])[0]
      if (t?.phim_id) ids.push(t.phim_id)
    }
    if (ids.length < 2) return bao('Cần chọn ít nhất 2 phim')
    const j = await goi({ viec: 'gom-tap', ids, ten: ten || undefined })
    if (j.ok) {
      datChon([])
      datTen('')
      napDs(tim)
      nap()
      bao(`Đã gom thành phim bộ ${j.soTap} tập`)
    } else bao(j.loi || 'Không gom được')
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/50">
        Dùng khi tên file lộn xộn khiến máy tách nhầm thành nhiều phim lẻ. Chọn các mục thuộc cùng một bộ, đặt tên rồi
        gom lại. Thứ tự tập đánh theo thứ tự chọn.
      </p>

      <input
        value={tim}
        onChange={(e) => datTim(e.target.value)}
        placeholder="Lọc theo tên"
        className="w-full rounded border border-[var(--color-vien)] bg-[var(--color-nen-2)] px-3 py-2 text-sm outline-none focus:border-white/40"
      />

      <ul className="max-h-96 space-y-1 overflow-y-auto rounded border border-[var(--color-vien)] p-2">
        {ds.map((p) => {
          const i = chon.indexOf(p.slug)
          return (
            <li key={p.slug} className="flex items-center gap-2">
              <button
                onClick={() => datChon((c) => (i >= 0 ? c.filter((x) => x !== p.slug) : [...c, p.slug]))}
                className={`flex flex-1 items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${
                  i >= 0 ? 'bg-white/15' : 'hover:bg-white/10'
                }`}
              >
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded text-[11px] ${
                    i >= 0 ? 'bg-[var(--color-nhan)]' : 'bg-white/10'
                  }`}
                >
                  {i >= 0 ? i + 1 : ''}
                </span>
                <span className="truncate">{p.ten}</span>
                <span className="ml-auto shrink-0 text-xs text-white/35">{p.tapHienTai || 'Phim lẻ'}</span>
              </button>
              <button
                onClick={async () => {
                  const r = await fetch('/api/thu-vien?tap=' + encodeURIComponent(p.slug))
                  const j = await r.json()
                  datTapCua({ slug: p.slug, tap: j.tap || [] })
                }}
                className="rounded bg-white/10 px-2 py-1.5 text-xs hover:bg-white/20"
              >
                Xem tập
              </button>
            </li>
          )
        })}
      </ul>

      {tapCua && (
        <div className="rounded border border-[var(--color-vien)] bg-[var(--color-nen-2)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Tập của {tapCua.slug}</h3>
            <button onClick={() => datTapCua(null)} className="text-xs text-white/50 hover:text-white">
              Đóng
            </button>
          </div>
          <ul className="space-y-1 text-xs text-white/60">
            {tapCua.tap.map((t) => (
              <li key={t.id} className="flex items-center gap-2">
                <span className="w-10 shrink-0 tabular-nums">Tập {t.so_tap}</span>
                <span className="truncate">{t.duong_dan_file}</span>
                {!!t.can_chuyen_ma && (
                  <span className="ml-auto shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-300">
                    cần chuyển mã
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          value={ten}
          onChange={(e) => datTen(e.target.value)}
          placeholder="Tên phim bộ sau khi gom"
          className="min-w-56 flex-1 rounded border border-[var(--color-vien)] bg-[var(--color-nen-2)] px-3 py-2 text-sm outline-none focus:border-white/40"
        />
        <button
          onClick={gom}
          disabled={chon.length < 2}
          className="rounded bg-white px-5 py-2 text-sm font-medium text-black disabled:opacity-40"
        >
          Gom {chon.length > 0 ? chon.length + ' mục' : ''}
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

type TienDoKho = {
  dangChay: boolean
  theLoaiXong: string[]
  theLoaiHienTai: string | null
  trangHienTai: number
  tongTrangTheLoai: number
  soPhim: number
  loi: string | null
}

function TabKho({ bao }: { bao: (t: string) => void }) {
  const [kho, datKho] = useState<TienDoKho | null>(null)

  const nap = useCallback(async () => {
    try {
      const r = await fetch('/api/thu-vien')
      const j = await r.json()
      datKho(j.kho ?? null)
    } catch {
      // dev server dang bien dich lai thi bo qua mot nhip
    }
  }, [])

  useEffect(() => {
    nap()
    const t = setInterval(nap, 1500)
    return () => clearInterval(t)
  }, [nap])

  async function lam(viec: string, them: Record<string, unknown> = {}) {
    const j = await goi({ viec, ...them })
    if (j.kho) datKho(j.kho)
    nap()
    return j
  }

  const dang = kho?.dangChay
  const phanTram =
    kho && kho.tongTrangTheLoai > 0 ? Math.round((kho.trangHienTai / kho.tongTrangTheLoai) * 100) : 0

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold">Kho đệm metadata</h2>
        <p className="mt-1 text-sm leading-relaxed text-white/50">
          Quét sẵn danh mục phim từ nguồn vào máy. Có kho này thì làm được những thứ nguồn{' '}
          <strong className="font-semibold text-white/70">không hỗ trợ</strong>: sắp xếp theo điểm hoặc năm, lọc nhiều
          thể loại cùng lúc, và gom phần triệt để trên toàn bộ danh mục (không còn giới hạn &ldquo;chỉ gom trong một
          trang&rdquo;).
        </p>
        <p className="mt-2 text-xs text-white/35">
          Quét theo từng thể loại vì endpoint danh sách của nguồn không trả thể loại. Chạy nền, tạm dừng và chạy tiếp
          được, mất khoảng 20–30 phút cho toàn bộ danh mục.
        </p>
      </div>

      <div className="rounded-lg border border-[var(--color-vien)] bg-[var(--color-nen-2)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-2xl font-bold tabular-nums">{(kho?.soPhim ?? 0).toLocaleString('vi-VN')}</p>
            <p className="text-xs text-white/45">phim trong kho đệm</p>
          </div>
          <div className="text-right text-xs text-white/50">
            <p>{kho?.theLoaiXong.length ?? 0} thể loại đã xong</p>
            {dang && kho?.theLoaiHienTai && (
              <p className="mt-0.5">
                đang quét <span className="text-white/80">{kho.theLoaiHienTai}</span> — trang {kho.trangHienTai}/
                {kho.tongTrangTheLoai}
              </p>
            )}
          </div>
        </div>

        {dang && (
          <div className="mt-3 h-1.5 overflow-hidden rounded bg-white/10">
            <div className="h-full bg-sky-500 transition-all" style={{ width: phanTram + '%' }} />
          </div>
        )}

        {kho?.loi && <p className="mt-3 text-xs text-red-400">Lỗi: {kho.loi}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          {dang ? (
            <button
              onClick={async () => {
                await lam('dung-quet-kho')
                bao('Đã dừng. Bấm Quét tiếp để chạy lại từ chỗ đang dở.')
              }}
              className="rounded bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
            >
              Tạm dừng
            </button>
          ) : (
            <button
              onClick={async () => {
                await lam('quet-kho')
                bao('Đang quét nền. Cứ dùng app bình thường, tiến độ cập nhật ở đây.')
              }}
              className="rounded bg-white px-4 py-2 text-sm font-medium text-black"
            >
              {(kho?.theLoaiXong.length ?? 0) > 0 ? 'Quét tiếp' : 'Bắt đầu quét'}
            </button>
          )}
          <button
            onClick={async () => {
              if (!confirm('Quét lại từ đầu? Dữ liệu cũ vẫn giữ, chỉ chạy lại toàn bộ thể loại.')) return
              await lam('quet-kho', { lamLai: true })
              bao('Đang quét lại từ thể loại đầu tiên.')
            }}
            disabled={dang}
            className="rounded bg-white/10 px-4 py-2 text-sm hover:bg-white/20 disabled:opacity-40"
          >
            Quét lại từ đầu
          </button>
          <button
            onClick={async () => {
              if (!confirm('Xoá sạch kho đệm? Sắp xếp và lọc nâng cao sẽ tắt cho tới khi quét lại.')) return
              await lam('xoa-kho')
              bao('Đã xoá kho đệm.')
            }}
            className="rounded bg-red-500/15 px-4 py-2 text-sm text-red-300 hover:bg-red-500/25"
          >
            Xoá kho
          </button>
        </div>
      </div>

      {(kho?.soPhim ?? 0) > 0 && (
        <p className="text-xs text-white/40">
          Kho đã có dữ liệu — trang Duyệt hiện thêm ô <strong className="text-white/70">Sắp xếp</strong> và cho chọn
          nhiều thể loại.
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

/** Mở app ra mạng nội bộ để xem trên TV Box / điện thoại. */
function KhoiLan({
  lan,
  bao,
  nap,
}: {
  lan: { bat: boolean; coMatKhau: boolean; diaChi: string[] } | null
  bao: (t: string) => void
  nap: () => void
}) {
  const [matKhau, datMatKhau] = useState('')

  if (!lan) return null

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold">Xem trên TV Box / điện thoại (chế độ LAN)</h2>

      <div className="rounded-lg border border-[var(--color-vien)] bg-[var(--color-nen-2)] p-4">
        <p className="text-sm leading-relaxed text-white/55">
          Mặc định app chỉ nghe <code className="rounded bg-white/10 px-1">127.0.0.1</code> — máy khác không vào được.
          Bật chế độ này thì thiết bị trong nhà mở trình duyệt vào địa chỉ bên dưới là xem được, không cần cài gì.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-amber-300/80">
          Laptop PHẢI đang bật và đang chạy app thì link mới sống — TV Box chỉ là màn hình, mọi thứ nặng (phục vụ
          trang, proxy, đọc ổ cứng, chuyển mã) đều chạy trên laptop.
        </p>

        <div className="mt-3 flex items-center gap-2 text-sm">
          <span className={lan.bat ? 'text-emerald-400' : 'text-white/45'}>
            {lan.bat ? 'Đang BẬT' : 'Đang tắt'}
          </span>
          {lan.coMatKhau && <span className="text-xs text-white/35">· đã đặt mật khẩu</span>}
        </div>

        {lan.bat && lan.diaChi.length > 0 && (
          <div className="mt-3 rounded bg-black/40 p-3">
            <p className="text-xs text-white/45">Mở trên TV Box:</p>
            {lan.diaChi.map((d) => (
              <p key={d} className="mt-1 font-mono text-sm text-emerald-300">
                {d}
              </p>
            ))}
            <p className="mt-2 text-xs text-white/35">
              Chạy app bằng <code className="rounded bg-white/10 px-1">npm run tv</code> để nó nghe cả mạng nội bộ.
            </p>
          </div>
        )}

        {!lan.bat ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              type="password"
              value={matKhau}
              onChange={(e) => datMatKhau(e.target.value)}
              placeholder={lan.coMatKhau ? 'Mật khẩu mới (để trống = giữ nguyên)' : 'Đặt mật khẩu'}
              className="min-w-56 flex-1 rounded border border-[var(--color-vien)] bg-[var(--color-nen)] px-3 py-2 text-sm outline-none focus:border-white/40"
            />
            <button
              onClick={async () => {
                const j = await goi({ viec: 'che-do-lan', bat: true, matKhau })
                datMatKhau('')
                nap()
                bao(j.loi || 'Đã bật chế độ LAN. Khởi động lại bằng npm run tv để nghe cả mạng nội bộ.')
              }}
              disabled={!matKhau && !lan.coMatKhau}
              className="rounded bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
            >
              Bật chế độ LAN
            </button>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={async () => {
                await goi({ viec: 'che-do-lan', bat: false })
                nap()
                bao('Đã tắt. Khởi động lại bằng npm start để app chỉ nghe 127.0.0.1.')
              }}
              className="rounded bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
            >
              Tắt chế độ LAN
            </button>
            <button
              onClick={async () => {
                if (!confirm('Xoá mật khẩu và tắt chế độ LAN?')) return
                await goi({ viec: 'che-do-lan', bat: false, xoaMatKhau: true })
                nap()
                bao('Đã xoá mật khẩu và tắt chế độ LAN.')
              }}
              className="rounded bg-red-500/15 px-4 py-2 text-sm text-red-300 hover:bg-red-500/25"
            >
              Xoá mật khẩu
            </button>
          </div>
        )}

        <p className="mt-3 text-xs text-white/35">
          Quên mật khẩu thì trên chính máy này chạy <code className="rounded bg-white/10 px-1">npm run mat-khau</code>.
        </p>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */

/** API key OpenSubtitles để tự tìm phụ đề cho phim trong máy. */
function KhoiPhuDe({ bao }: { bao: (t: string) => void }) {
  const [khoa, datKhoa] = useState('')
  const [coKhoa, datCoKhoa] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/phu-de-ngoai')
      .then((r) => r.json())
      .then((j) => datCoKhoa(!!j.coKhoa))
      .catch(() => datCoKhoa(false))
  }, [])

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold">Tự tìm phụ đề (OpenSubtitles)</h2>
      <div className="rounded-lg border border-[var(--color-vien)] bg-[var(--color-nen-2)] p-4">
        <p className="text-sm leading-relaxed text-white/55">
          Phim trong máy không có phụ đề thì ở trang xem sẽ có nút{' '}
          <strong className="font-semibold text-white/75">Tìm phụ đề trên mạng</strong>. Cần API key miễn phí — đăng ký
          ở{' '}
          <a
            href="https://www.opensubtitles.com/consumers"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-white"
          >
            opensubtitles.com
          </a>{' '}
          rồi dán vào đây.
        </p>
        <p className="mt-2 text-xs text-white/35">
          Tài khoản miễn phí có hạn mức tải mỗi ngày, nên app chỉ tải khi bạn bấm chứ không tự quét cả thư viện.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="password"
            value={khoa}
            onChange={(e) => datKhoa(e.target.value)}
            placeholder={coKhoa ? 'Đã có key — dán key mới để thay' : 'Dán API key'}
            className="min-w-56 flex-1 rounded border border-[var(--color-vien)] bg-[var(--color-nen)] px-3 py-2 text-sm outline-none focus:border-white/40"
          />
          <button
            onClick={async () => {
              const r = await fetch('/api/phu-de-ngoai', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ viec: 'dat-khoa', khoa }),
              })
              const j = await r.json()
              datCoKhoa(!!j.coKhoa)
              datKhoa('')
              bao(j.coKhoa ? 'Đã lưu API key.' : 'Đã xoá API key.')
            }}
            className="rounded bg-white px-4 py-2 text-sm font-medium text-black"
          >
            Lưu
          </button>
          {coKhoa !== null && (
            <span className={coKhoa ? 'text-xs text-emerald-400' : 'text-xs text-white/40'}>
              {coKhoa ? 'đã có key' : 'chưa có key'}
            </span>
          )}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */

type TrangThaiNguon = {
  danhSach: { ma: string; ten: string }[]
  dangBat: string[]
  soChan18: number
}

/** Bật/tắt nguồn phim và quản lý sổ đen 18+. */
function KhoiNguon({ bao }: { bao: (t: string) => void }) {
  const [n, datN] = useState<TrangThaiNguon | null>(null)
  const [dangQuet, datDangQuet] = useState(false)

  const nap = useCallback(async () => {
    const r = await fetch('/api/thu-vien')
    const j = await r.json()
    datN(j.nguon ?? null)
  }, [])

  useEffect(() => {
    nap()
  }, [nap])

  if (!n) return null

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold">Nguồn phim</h2>
      <div className="rounded-lg border border-[var(--color-vien)] bg-[var(--color-nen-2)] p-4">
        <p className="text-sm leading-relaxed text-white/55">
          Bật nhiều nguồn thì kho phim rộng hơn. Phim trùng nhau bị{' '}
          <strong className="font-semibold text-white/75">gộp làm một</strong> theo slug — không hiện hai lần, và ở
          trang chi tiết thành nhiều server để đổi qua lại khi một bên chết.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {n.danhSach.map((x) => {
            const bat = n.dangBat.includes(x.ma)
            return (
              <button
                key={x.ma}
                onClick={async () => {
                  const moi = bat ? n.dangBat.filter((m) => m !== x.ma) : [...n.dangBat, x.ma]
                  await goi({ viec: 'nguon-bat', ds: moi })
                  nap()
                }}
                className={`rounded px-4 py-2 text-sm transition ${
                  bat ? 'bg-white font-medium text-black' : 'bg-white/10 text-white/60 hover:bg-white/20'
                }`}
              >
                {x.ten} {bat ? '· bật' : '· tắt'}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-white/35">Tắt hết thì app tự giữ lại vsmov — không thể tắt sạch mọi nguồn.</p>

        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="text-sm font-medium">Chặn nội dung 18+</p>
          <p className="mt-1 text-sm leading-relaxed text-white/55">
            Đang chặn <strong className="text-white/80">{n.soChan18}</strong> phim. Hai lớp: sổ đen theo slug (quét từ
            thể loại người lớn của nguồn) và lưới lọc theo tên. vsmov không có thể loại 18+ nào; KKPhim có.
          </p>
          <button
            onClick={async () => {
              datDangQuet(true)
              const j = await goi({ viec: 'quet-18' })
              datDangQuet(false)
              nap()
              bao(j.loi || `Đã cập nhật sổ đen: ${j.tong} phim bị chặn.`)
            }}
            disabled={dangQuet}
            className="mt-3 rounded bg-white/10 px-4 py-2 text-sm hover:bg-white/20 disabled:opacity-40"
          >
            {dangQuet ? 'Đang quét...' : 'Quét lại sổ đen 18+'}
          </button>
        </div>
      </div>
    </section>
  )
}
