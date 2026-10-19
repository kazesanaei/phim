'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Anh from '@/components/Anh'
import Link from 'next/link'
import {
  CO_PHO_BIEN,
  MAC_DINH_MAN_HINH,
  docCaiDatManHinh,
  luuManHinh,
  tinhThuManHinh,
  type CaiDatManHinh,
  type KetQuaManHinh,
} from '@/lib/man-hinh'

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
  { ma: 'nguoi', ten: 'Diễn viên' },
  { ma: 'loc-18', ten: 'Duyệt 18+' },
  { ma: 'man-hinh', ten: 'Màn hình' },
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
  const [choDuyet18, datChoDuyet18] = useState(0)

  const nap = useCallback(async () => {
    const r = await fetch('/api/thu-vien')
    const j = await r.json()
    datThuMuc(j.thuMuc || [])
    datSoPhim(j.soPhim || 0)
    datSoTap(j.soTap || 0)
    datCoFfmpeg(j.coFfmpeg !== false)
    datSoViecTai(String(j.soViecTai || '1'))
    datLan(j.lan ?? null)
    datChoDuyet18(Number(j.choDuyet18) || 0)
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
            {t.ma === 'loc-18' && choDuyet18 > 0 && (
              <span
                title={`${choDuyet18} phim chờ duyệt`}
                className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-px text-[11px] font-bold text-black"
              >
                {choDuyet18}
              </span>
            )}
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
        {tab === 'nguoi' && <TabNguoi bao={bao} />}
        {tab === 'loc-18' && <TabLoc18 bao={bao} datChoDuyet={datChoDuyet18} />}
        {tab === 'man-hinh' && <TabManHinh />}
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
                <Anh src={p.poster} rong={200} anAnToan className="h-16 w-11 shrink-0 rounded object-cover" />
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
                    <Anh src={u.poster} rong={200} anAnToan className="h-12 w-8 rounded object-cover" />
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

type CapNhatMoi = {
  bat: boolean
  dangChay: boolean
  xongLuc: string | null
  soMoi: number
  soLenTap: number
  loi: string | null
}

function TabKho({ bao }: { bao: (t: string) => void }) {
  const [kho, datKho] = useState<TienDoKho | null>(null)
  const [moi, datMoi] = useState<CapNhatMoi | null>(null)

  const nap = useCallback(async () => {
    try {
      const r = await fetch('/api/thu-vien')
      const j = await r.json()
      datKho(j.kho ?? null)
      datMoi(j.capNhatMoi ?? null)
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
    if (j.capNhatMoi) datMoi(j.capNhatMoi)
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

      <div className="rounded-lg border border-[var(--color-vien)] bg-[var(--color-nen-2)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold">Tự cập nhật phim mới</h3>
            <p className="mt-1 text-xs leading-relaxed text-white/45">
              Khi app đang chạy, cứ 30 phút một lần (kể cả khi không ai mở trang), app đọc danh sách phim mới cập nhật
              của các nguồn đang bật và bổ sung vào kho. Nhờ vậy phim vừa ra cũng hiện trong ô gợi ý và kết quả tìm
              kiếm, khỏi phải quét lại cả danh mục.
            </p>
            <p className="mt-2 text-xs text-white/55">
              {moi?.dangChay
                ? 'Đang cập nhật...'
                : moi?.xongLuc
                  ? `Lần gần nhất: ${new Date(moi.xongLuc).toLocaleString('vi-VN')} — thêm ${moi.soMoi} phim mới, ${moi.soLenTap} phim lên tập`
                  : 'Chưa cập nhật lần nào.'}
            </p>
            {moi?.loi && <p className="mt-1 text-xs text-red-400">Lỗi: {moi.loi}</p>}
          </div>
          <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={moi?.bat ?? true}
              onChange={async (e) => {
                await lam('tu-cap-nhat', { bat: e.target.checked })
                bao(e.target.checked ? 'Đã bật tự cập nhật phim mới.' : 'Đã tắt tự cập nhật phim mới.')
              }}
            />
            Tự động
          </label>
        </div>
        <button
          onClick={async () => {
            await lam('cap-nhat-moi')
            bao('Đang cập nhật phim mới ở chế độ nền.')
          }}
          disabled={moi?.dangChay}
          className="mt-3 rounded bg-white/10 px-4 py-2 text-sm hover:bg-white/20 disabled:opacity-40"
        >
          {moi?.dangChay ? 'Đang cập nhật...' : 'Cập nhật ngay'}
        </button>
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
          <p className="text-sm font-medium">Lọc nội dung 18+</p>
          <p className="mt-1 text-sm leading-relaxed text-white/55">
            Đang ẩn <strong className="text-white/80">{n.soChan18}</strong> phim. Hai lớp: danh sách quét từ thể loại
            18+ của nguồn (tự quét mỗi ngày) và lưới lọc theo tên. vsmov không có thể loại 18+ nào; KKPhim có. Duyệt
            phim nào được hiện, phim nào ẩn ở tab <strong className="text-white/80">Duyệt 18+</strong>.
          </p>
          <button
            onClick={async () => {
              datDangQuet(true)
              const j = await goi({ viec: 'quet-18' })
              datDangQuet(false)
              bao(
                j.loi ||
                  (j.batDau
                    ? 'Đã bắt đầu quét danh sách 18+ (chạy nền vài phút). Xem tiến độ và duyệt ở tab Duyệt 18+.'
                    : 'Đang có một lượt quét chạy rồi. Xem tiến độ ở tab Duyệt 18+.'),
              )
            }}
            disabled={dangQuet}
            className="mt-3 rounded bg-white/10 px-4 py-2 text-sm hover:bg-white/20 disabled:opacity-40"
          >
            Quét danh sách 18+
          </button>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */

type TienDoNguoi = {
  dangChay: boolean
  daQuet: number
  tongPhim: number
  soNguoi: number
  soTen: number
  loi: string | null
}

/**
 * Quét chỉ mục diễn viên.
 *
 * Vì sao phải quét thay vì hỏi nguồn: nguồn KHÔNG có endpoint tìm theo người
 * (đã thử `/dien-vien/<slug>` → 404 và `?actor=` → 422; `?keyword=` chỉ khớp
 * tên phim). Tên người chỉ nằm ở trang chi tiết từng phim.
 */
function TabNguoi({ bao }: { bao: (t: string) => void }) {
  const [ng, datNg] = useState<TienDoNguoi | null>(null)

  const nap = useCallback(async () => {
    try {
      const r = await fetch('/api/thu-vien')
      const j = await r.json()
      datNg(j.nguoi ?? null)
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
    if (j.nguoi) datNg(j.nguoi as TienDoNguoi)
    nap()
    return j
  }

  const dang = ng?.dangChay
  const tong = ng?.tongPhim ?? 0
  const xong = ng?.daQuet ?? 0
  const phanTram = tong > 0 ? Math.min(100, Math.round((xong / tong) * 100)) : 0
  // Tốc độ đo thật khi chạy cả kho — xem chú thích TOC_DO_DO_DUOC ở lib/quet-nguoi.ts.
  const phutConLai = Math.max(0, Math.round((tong - xong) / 2.4 / 60))

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold">Chỉ mục diễn viên</h2>
        <p className="mt-1 text-sm leading-relaxed text-white/50">
          Quét tên diễn viên và đạo diễn của từng phim vào máy, để ô tìm kiếm tra được{' '}
          <strong className="font-semibold text-white/70">theo tên người</strong> chứ không chỉ theo tên phim.
        </p>
        <p className="mt-2 text-xs text-white/35">
          Bắt buộc phải tự quét: nguồn không có chỗ nào tìm theo diễn viên — gõ &ldquo;Tom Cruise&rdquo; vào nguồn chỉ
          ra phim nào có chuỗi đó trong <em>tên phim</em>. Tên người chỉ nằm ở trang chi tiết từng phim, nên phải đi
          một lượt qua cả kho. Chạy nền, tạm dừng và chạy tiếp được, mất khoảng <strong className="text-white/70">2 giờ</strong> cho
          toàn bộ kho. Phim điểm cao quét trước, nên dừng giữa chừng thì phần đã có vẫn là phần hay tra nhất.
        </p>
      </div>

      {tong === 0 && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          Kho đệm đang trống. Sang thẻ <strong>Kho đệm</strong> quét danh mục phim trước đã — chỉ mục diễn viên đi theo
          danh sách phim trong kho.
        </p>
      )}

      <div className="rounded-lg border border-[var(--color-vien)] bg-[var(--color-nen-2)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-2xl font-bold tabular-nums">{(ng?.soTen ?? 0).toLocaleString('vi-VN')}</p>
            <p className="text-xs text-white/45">
              tên người · {(ng?.soNguoi ?? 0).toLocaleString('vi-VN')} lượt tham gia
            </p>
          </div>
          <div className="text-right text-xs text-white/50">
            <p>
              <span className="tabular-nums text-white/80">{xong.toLocaleString('vi-VN')}</span> /{' '}
              {tong.toLocaleString('vi-VN')} phim đã quét
            </p>
            {dang && <p className="mt-0.5">còn khoảng {phutConLai} phút</p>}
          </div>
        </div>

        {(dang || xong > 0) && (
          <div className="mt-3 h-1.5 overflow-hidden rounded bg-white/10">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: phanTram + '%' }} />
          </div>
        )}

        {ng?.loi && <p className="mt-3 text-xs text-red-400">Lỗi: {ng.loi}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          {dang ? (
            <button
              onClick={async () => {
                await lam('dung-quet-nguoi')
                bao('Đã dừng. Bấm Quét tiếp để chạy lại từ chỗ đang dở.')
              }}
              className="rounded bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
            >
              Tạm dừng
            </button>
          ) : (
            <button
              onClick={async () => {
                await lam('quet-nguoi')
                bao('Đang quét nền. Cứ dùng app bình thường, tiến độ cập nhật ở đây.')
              }}
              disabled={tong === 0}
              className="rounded bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
            >
              {xong > 0 ? 'Quét tiếp' : 'Bắt đầu quét'}
            </button>
          )}
          <button
            onClick={async () => {
              if (!confirm('Quét lại toàn bộ? Tên đã có vẫn giữ, chỉ đi lại một lượt qua tất cả phim.')) return
              await lam('quet-nguoi', { lamLai: true })
              bao('Đang quét lại từ đầu.')
            }}
            disabled={dang || tong === 0}
            className="rounded bg-white/10 px-4 py-2 text-sm hover:bg-white/20 disabled:opacity-40"
          >
            Quét lại từ đầu
          </button>
          <button
            onClick={async () => {
              if (!confirm('Xoá sạch chỉ mục diễn viên? Tìm theo tên người sẽ tắt cho tới khi quét lại.')) return
              await lam('xoa-chi-muc-nguoi')
              bao('Đã xoá chỉ mục diễn viên.')
            }}
            className="rounded bg-red-500/15 px-4 py-2 text-sm text-red-300 hover:bg-red-500/25"
          >
            Xoá chỉ mục
          </button>
        </div>
      </div>

      {(ng?.soTen ?? 0) > 0 && (
        <p className="text-xs text-white/40">
          Đã tra được theo tên người — gõ tên diễn viên vào ô tìm ở đầu trang, gợi ý hiện ngay dưới ô.
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

type Muc18 = 'chan' | 'canh-bao' | 'cho-phep'
type Dong18 = {
  slug: string
  ten: string | null
  ten_goc: string | null
  ly_do: string | null
  the_loai: string | null
  muc_tu_dong: Muc18
  muc_tay: Muc18 | null
  muc: Muc18
  anh: string | null
  nam: number | null
  quoc_gia: string | null
  tao_luc: string
}
type TienDo18 = {
  dangChay: boolean
  giaiDoan: 'danh-sach' | 'phan-loai' | 'don-kho' | null
  daXet: number
  canXet: number
  toanBo: boolean
  tuDong: boolean
  batDauLuc: string | null
  xongLuc: string | null
  ketQua: { them: number; moi: number; chan: number; ganMac: number; khongXet: number; don: number } | null
  loi: string | null
}
type Loc18 = 'cho-duyet' | Muc18 | 'tat-ca'
type HanhDong18 = Muc18 | 'de-xuat' | 'cho-duyet'

/** Gọi theo việc chủ máy cần làm: duyệt HIỆN hay ẨN, thay cho tên kỹ thuật "chặn / cảnh báo". */
const NHAN_MUC: Record<Muc18, string> = { chan: 'Ẩn', 'canh-bao': 'Hiện kèm mác 18+', 'cho-phep': 'Hiện bình thường' }
const NUT_MUC: Record<Muc18, string> = { chan: 'Ẩn', 'canh-bao': 'Hiện + mác 18+', 'cho-phep': 'Hiện, bỏ mác' }
const MAU_MUC: Record<Muc18, string> = {
  chan: 'bg-red-600/20 text-red-300',
  'canh-bao': 'bg-amber-500/20 text-amber-300',
  'cho-phep': 'bg-emerald-500/15 text-emerald-300',
}
/** Số dòng vẽ mỗi lần — danh sách có thể lên cả nghìn phim, vẽ hết một lúc thì trang ì. */
const MOI_LAN_HIEN = 60

const laChoDuyet = (d: Dong18) => d.muc_tay === null && d.muc_tu_dong !== 'cho-phep'

/** Lý do lưu trong DB → câu đọc được. Dòng cũ chỉ ghi 'the-loai' / 'ten'. */
function lyDoDoc(d: Dong18): string {
  if (d.ly_do === 'the-loai') return 'Thể loại 18+ của nguồn (chưa phân loại, bấm Quét ngay)'
  if (d.ly_do === 'ten') return 'Lưới lọc theo tên (bản cũ)'
  return d.ly_do || ''
}

function gio(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : ''
}

function dongTienDo(q: TienDo18): string {
  if (q.giaiDoan === 'danh-sach') return `Đang lấy danh sách thể loại 18+ của nguồn: trang ${q.daXet}/${q.canXet || '?'}`
  if (q.giaiDoan === 'phan-loai') return `Đang phân loại theo thể loại: ${q.daXet}/${q.canXet} phim`
  return 'Đang dọn kho đệm theo kết quả mới...'
}

/**
 * Duyệt phim 18+: chủ máy quyết phim nào được HIỆN, phim nào ẨN.
 *
 * Máy tự đề xuất (chỉ ẩn phim mà nội dung chính xoay quanh tình dục, phim khác
 * hiện kèm mác 18+ ở góc ảnh), nhưng đề xuất chỉ là đề xuất: phim mới gặp vào
 * hàng "Chờ duyệt", chủ máy đồng ý hoặc đổi. Quyết định đã duyệt luôn thắng và
 * không bị lần quét sau ghi đè.
 *
 * Ảnh phim đang bị ẩn được làm mờ, bấm vào mới xem rõ: màn này hay được mở
 * trên laptop ở chỗ đông người.
 */
function TabLoc18({ bao, datChoDuyet }: { bao: (t: string) => void; datChoDuyet: (n: number) => void }) {
  const [ds, datDs] = useState<Dong18[]>([])
  const [quet, datQuet] = useState<TienDo18 | null>(null)
  const [loc, datLoc] = useState<Loc18>('cho-duyet')
  const [tim, datTim] = useState('')
  const [chon, datChon] = useState<Set<string>>(new Set())
  const [moAnh, datMoAnh] = useState<Set<string>>(new Set())
  const [soHien, datSoHien] = useState(MOI_LAN_HIEN)
  const [slugMoi, datSlugMoi] = useState('')
  const [dangGui, datDangGui] = useState(false)

  const nhan = useCallback(
    (j: { ds?: Dong18[]; quet?: TienDo18; choDuyet?: number }) => {
      if (j.ds) datDs(j.ds)
      if (j.quet) datQuet(j.quet)
      if (typeof j.choDuyet === 'number') datChoDuyet(j.choDuyet)
    },
    [datChoDuyet],
  )

  const nap = useCallback(async () => {
    try {
      nhan(await (await fetch('/api/thu-vien?loc18=1')).json())
    } catch {
      // dev server đang biên dịch lại thì bỏ qua một nhịp
    }
  }, [nhan])

  useEffect(() => {
    nap()
  }, [nap])

  // Đang quét thì hỏi tiến độ mỗi 2 giây; quét xong thì nạp lại cả danh sách
  useEffect(() => {
    if (!quet?.dangChay) return
    const h = setInterval(async () => {
      try {
        const j = await (await fetch('/api/thu-vien?loc18=1&chiTienDo=1')).json()
        nhan(j)
        const q = j.quet as TienDo18 | undefined
        if (q && !q.dangChay) {
          nap()
          if (q.loi) bao('Quét 18+ không xong: ' + q.loi)
          else if (q.ketQua) bao(`Quét xong: ${q.ketQua.them} phim, ${q.ketQua.moi} phim mới chờ duyệt.`)
        }
      } catch {
        // bỏ qua một nhịp
      }
    }, 2000)
    return () => clearInterval(h)
  }, [quet?.dangChay, nap, nhan, bao])

  // Đổi bộ lọc thì bỏ chọn và vẽ lại từ đầu, tránh lỡ tay duyệt phim không còn thấy
  function doiLoc(m: Loc18) {
    datLoc(m)
    datChon(new Set())
    datSoHien(MOI_LAN_HIEN)
  }

  async function duyet(slugs: string[], hanhDong: HanhDong18) {
    if (!slugs.length) return
    datDangGui(true)
    try {
      const j = await goi({ viec: 'duyet-18', slugs, hanhDong })
      if (j.loi) return bao(j.loi)
      nhan(j)
      datChon((c) => {
        const m = new Set(c)
        for (const s of slugs) m.delete(s)
        return m
      })
      return j
    } finally {
      datDangGui(false)
    }
  }

  async function batQuet(toanBo: boolean) {
    const j = await goi({ viec: 'quet-18', toanBo })
    if (j.loi) return bao(j.loi)
    nhan(j)
    if (!j.batDau) bao('Đang có một lượt quét chạy rồi.')
  }

  const dem = { 'cho-duyet': 0, chan: 0, 'canh-bao': 0, 'cho-phep': 0, 'tat-ca': ds.length } as Record<Loc18, number>
  for (const d of ds) {
    dem[d.muc]++
    if (laChoDuyet(d)) dem['cho-duyet']++
  }

  const t = tim.trim().toLowerCase()
  const hien = ds.filter(
    (d) =>
      (loc === 'tat-ca' || (loc === 'cho-duyet' ? laChoDuyet(d) : d.muc === loc)) &&
      (!t || [d.ten, d.ten_goc, d.slug].some((x) => (x || '').toLowerCase().includes(t))),
  )
  const daChonHet = hien.length > 0 && hien.every((d) => chon.has(d.slug))
  const dsChon = [...chon]

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold">Duyệt phim 18+</h2>
        <p className="mt-1 text-sm leading-relaxed text-white/50">
          <strong className="font-semibold text-white/70">Ẩn</strong>: phim mà nội dung chính xoay quanh tình dục,
          không hiện ở đâu và không mở được. <strong className="font-semibold text-white/70">Hiện kèm mác 18+</strong>:
          phim có cảnh nóng, kinh dị, bạo lực, vẫn xem được, có mác 18+ đỏ ở góc ảnh và hỏi lại trước khi phát. Máy tự
          đề xuất theo thể loại và tên phim; phim mới gặp nằm ở mục{' '}
          <strong className="font-semibold text-white/70">Chờ duyệt</strong> để bạn chốt.
        </p>
      </div>

      {/* Quét danh sách */}
      <div className="rounded-lg border border-[var(--color-vien)] bg-[var(--color-nen-2)] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-auto text-sm font-medium">Quét danh sách 18+ từ nguồn</p>
          {quet?.dangChay ? (
            <button
              onClick={async () => nhan(await goi({ viec: 'dung-quet-18' }))}
              className="rounded bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"
            >
              Dừng
            </button>
          ) : (
            <>
              <button
                onClick={() => batQuet(false)}
                title="Lấy phim mới trong thể loại 18+ của nguồn, chỉ phân loại phim chưa xét"
                className="rounded bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-white/85"
              >
                Quét ngay
              </button>
              <button
                onClick={() => batQuet(true)}
                title="Phân loại lại mọi phim theo luật hiện tại. Phim bạn đã duyệt giữ nguyên quyết định."
                className="rounded bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"
              >
                Quét lại toàn bộ
              </button>
            </>
          )}
          <label className="flex cursor-pointer items-center gap-2 pl-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={quet?.tuDong ?? true}
              onChange={async (e) => nhan(await goi({ viec: 'tu-quet-18', bat: e.target.checked }))}
              className="accent-[var(--color-nhan)]"
            />
            Tự quét mỗi ngày
          </label>
        </div>

        {quet?.dangChay ? (
          <div className="mt-3">
            <p className="text-xs text-white/60">{dongTienDo(quet)}</p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-[var(--color-nhan)] transition-all"
                style={{ width: `${quet.canXet ? Math.round((quet.daXet / quet.canXet) * 100) : 5}%` }}
              />
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs leading-relaxed text-white/45">
            {quet?.loi ? (
              <span className="text-red-300">
                Lần quét {gio(quet.batDauLuc)} không xong: {quet.loi}
                {quet.tuDong && '. Máy sẽ tự thử lại sau 3 giờ.'}
              </span>
            ) : quet?.ketQua ? (
              <>
                Lần quét gần nhất {gio(quet.xongLuc)}: {quet.ketQua.them} phim trong thể loại 18+ của nguồn,{' '}
                <strong className="text-white/70">{quet.ketQua.moi} phim mới</strong>; phân loại {quet.ketQua.chan}{' '}
                ẩn, {quet.ketQua.ganMac} hiện kèm mác
                {quet.ketQua.khongXet ? `, ${quet.ketQua.khongXet} chưa lấy được thông tin` : ''}
                {quet.ketQua.don ? `; rút ${quet.ketQua.don} phim bị ẩn khỏi kho đệm` : ''}.
              </>
            ) : (
              'Chưa quét lần nào trên máy này. Bấm Quét ngay (cần mạng, mất vài phút).'
            )}
          </p>
        )}
      </div>

      {/* Bộ lọc */}
      <div className="flex flex-wrap items-center gap-2">
        {(['cho-duyet', 'chan', 'canh-bao', 'cho-phep', 'tat-ca'] as const).map((m) => (
          <button
            key={m}
            onClick={() => doiLoc(m)}
            className={`rounded-full px-3 py-1 text-sm transition ${
              loc === m ? 'bg-white font-medium text-black' : 'bg-white/10 text-white/60 hover:bg-white/20'
            }`}
          >
            {m === 'tat-ca' ? 'Tất cả' : m === 'cho-duyet' ? 'Chờ duyệt' : NHAN_MUC[m]} ({dem[m]})
          </button>
        ))}
        <input
          value={tim}
          onChange={(e) => {
            datTim(e.target.value)
            datChon(new Set())
            datSoHien(MOI_LAN_HIEN)
          }}
          placeholder="Tìm theo tên hoặc slug"
          aria-label="Tìm trong danh sách 18+"
          className="ml-auto w-56 rounded border border-[var(--color-vien)] bg-[var(--color-nen-2)] px-3 py-1.5 text-sm outline-none focus:border-white/40"
        />
      </div>

      {/* Duyệt hàng loạt */}
      {hien.length > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-vien)] bg-[var(--color-nen)]/95 px-4 py-2.5 backdrop-blur">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={daChonHet}
              onChange={() => datChon(daChonHet ? new Set() : new Set(hien.map((d) => d.slug)))}
              className="accent-[var(--color-nhan)]"
            />
            {chon.size ? `Đã chọn ${chon.size} phim` : `Chọn cả ${hien.length} phim đang lọc`}
          </label>
          {chon.size > 0 && (
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <button
                disabled={dangGui}
                onClick={async () => {
                  const j = await duyet(dsChon, 'de-xuat')
                  if (j) bao(`Đã duyệt ${j.doi} phim theo đề xuất.`)
                }}
                className="rounded bg-white px-3 py-1 text-xs font-medium text-black hover:bg-white/85 disabled:opacity-40"
              >
                Đồng ý đề xuất
              </button>
              {(['chan', 'canh-bao', 'cho-phep'] as const).map((m) => (
                <button
                  key={m}
                  disabled={dangGui}
                  onClick={async () => {
                    const j = await duyet(dsChon, m)
                    if (j) bao(`${j.doi} phim: ${NHAN_MUC[m].toLowerCase()}.`)
                  }}
                  className="rounded bg-white/10 px-3 py-1 text-xs hover:bg-white/20 disabled:opacity-40"
                >
                  {NUT_MUC[m]}
                </button>
              ))}
              <button
                onClick={() => datChon(new Set())}
                className="rounded px-2 py-1 text-xs text-white/50 hover:bg-white/10 hover:text-white"
              >
                Bỏ chọn
              </button>
            </div>
          )}
        </div>
      )}

      {/* Danh sách */}
      <div className="overflow-hidden rounded-lg border border-[var(--color-vien)]">
        {hien.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-white/40">
            {loc === 'cho-duyet' ? 'Không còn phim nào chờ duyệt.' : 'Không có phim nào ở mục này.'}
          </p>
        ) : (
          <ul className="divide-y divide-white/5">
            {hien.slice(0, soHien).map((d) => {
              const cho = laChoDuyet(d)
              const mo = d.muc !== 'chan' || moAnh.has(d.slug)
              return (
                <li key={d.slug} className={`flex gap-3 px-4 py-3 ${chon.has(d.slug) ? 'bg-white/[.04]' : ''}`}>
                  <input
                    type="checkbox"
                    checked={chon.has(d.slug)}
                    onChange={() =>
                      datChon((c) => {
                        const m = new Set(c)
                        if (m.has(d.slug)) m.delete(d.slug)
                        else m.add(d.slug)
                        return m
                      })
                    }
                    aria-label={`Chọn ${d.ten || d.slug}`}
                    className="mt-1 shrink-0 accent-[var(--color-nhan)]"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      datMoAnh((c) => {
                        const m = new Set(c)
                        if (m.has(d.slug)) m.delete(d.slug)
                        else m.add(d.slug)
                        return m
                      })
                    }
                    title={d.muc === 'chan' ? (mo ? 'Bấm để làm mờ lại' : 'Bấm để xem rõ ảnh') : undefined}
                    disabled={d.muc !== 'chan'}
                    className="relative h-[72px] w-12 shrink-0 overflow-hidden rounded bg-white/5"
                  >
                    {d.anh ? (
                      <Anh
                        src={d.anh}
                        alt=""
                        rong={200}
                        duPhong={d.ten || d.slug}
                        className={`h-full w-full object-cover transition ${mo ? '' : 'scale-110 blur-md'}`}
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-[10px] text-white/30">
                        không ảnh
                      </span>
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium text-white/90">{d.ten || d.slug}</span>
                      {cho ? (
                        <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[11px] font-semibold text-sky-300">
                          Chờ duyệt · đề xuất: {NHAN_MUC[d.muc_tu_dong].toLowerCase()}
                        </span>
                      ) : (
                        <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${MAU_MUC[d.muc]}`}>
                          {NHAN_MUC[d.muc]}
                          {d.muc_tay ? ' · đã duyệt' : ''}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-white/40">
                      {[d.ten_goc !== d.ten ? d.ten_goc : null, d.nam, d.quoc_gia].filter(Boolean).join(' · ')}
                    </p>
                    <p className="mt-1 text-xs text-white/50">
                      {lyDoDoc(d)}
                      {d.the_loai && <span className="text-white/35"> · Thể loại: {d.the_loai}</span>}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {cho && (
                        <button
                          disabled={dangGui}
                          onClick={async () => {
                            const j = await duyet([d.slug], 'de-xuat')
                            if (j) bao(`${d.ten || d.slug}: ${NHAN_MUC[d.muc_tu_dong].toLowerCase()} (đã duyệt).`)
                          }}
                          className="rounded bg-white px-2.5 py-1 text-xs font-medium text-black hover:bg-white/85 disabled:opacity-40"
                        >
                          Đồng ý: {NUT_MUC[d.muc_tu_dong]}
                        </button>
                      )}
                      {(['chan', 'canh-bao', 'cho-phep'] as const)
                        .filter((m) => (cho ? m !== d.muc_tu_dong : m !== d.muc))
                        .map((m) => (
                          <button
                            key={m}
                            disabled={dangGui}
                            onClick={async () => {
                              const j = await duyet([d.slug], m)
                              if (j) bao(`${d.ten || d.slug}: ${NHAN_MUC[m].toLowerCase()}.`)
                            }}
                            className="rounded bg-white/10 px-2.5 py-1 text-xs hover:bg-white/20 disabled:opacity-40"
                          >
                            {NUT_MUC[m]}
                          </button>
                        ))}
                      {d.muc !== 'chan' && (
                        <Link
                          href={'/phim/' + d.slug}
                          className="rounded px-2.5 py-1 text-xs text-white/50 hover:bg-white/10 hover:text-white"
                          target="_blank"
                        >
                          Xem trang phim
                        </Link>
                      )}
                      {d.muc_tay && (
                        <button
                          disabled={dangGui}
                          onClick={async () => {
                            const j = await duyet([d.slug], 'cho-duyet')
                            if (j) bao(`${d.ten || d.slug}: đưa về chờ duyệt.`)
                          }}
                          className="rounded px-2.5 py-1 text-xs text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-40"
                        >
                          Đưa về chờ duyệt
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {hien.length > soHien && (
          <button
            onClick={() => datSoHien((n) => n + MOI_LAN_HIEN * 2)}
            className="w-full border-t border-white/5 py-2.5 text-sm text-white/60 hover:bg-white/5 hover:text-white"
          >
            Xem thêm ({hien.length - soHien} phim nữa)
          </button>
        )}
      </div>

      {/* Thêm tay */}
      <div className="rounded-lg border border-[var(--color-vien)] bg-[var(--color-nen-2)] p-4">
        <p className="text-sm font-medium">Tự ẩn hoặc gắn mác một phim</p>
        <p className="mt-1 text-xs text-white/45">
          Dán slug của phim, là phần cuối địa chỉ trang phim, ví dụ <code>/phim/ten-phim</code> thì slug là{' '}
          <code>ten-phim</code>.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={slugMoi}
            onChange={(e) => datSlugMoi(e.target.value.trim().toLowerCase())}
            placeholder="ten-phim"
            aria-label="Slug phim"
            className="w-64 rounded border border-[var(--color-vien)] bg-black/30 px-3 py-1.5 text-sm outline-none focus:border-white/40"
          />
          {(['chan', 'canh-bao'] as const).map((m) => (
            <button
              key={m}
              disabled={!/^[a-z0-9-]+$/.test(slugMoi)}
              onClick={async () => {
                const j = await goi({ viec: 'dat-muc-18', slug: slugMoi, muc: m, layTen: true })
                if (j.loi) return bao(j.loi)
                nhan(j)
                bao(`Đã ${m === 'chan' ? 'ẩn' : 'gắn mác 18+ cho'} ${slugMoi}.`)
                datSlugMoi('')
              }}
              className="rounded bg-white/10 px-4 py-1.5 text-sm hover:bg-white/20 disabled:opacity-40"
            >
              {NUT_MUC[m]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

/**
 * Cỡ giao diện theo inch màn hình laptop. Áp dụng ngay khi chọn để thấy luôn,
 * và chỉ cho TRÌNH DUYỆT ĐANG MỞ — xem chú thích đầu lib/man-hinh.ts.
 */
function TabManHinh() {
  const [c, datC] = useState<CaiDatManHinh>(MAC_DINH_MAN_HINH)
  const [kq, datKq] = useState<KetQuaManHinh | null>(null)
  const [laTv, datLaTv] = useState(false)
  const [man, datMan] = useState<{ w: number; h: number; dpr: number } | null>(null)
  const [tuNhap, datTuNhap] = useState('')

  useEffect(() => {
    const dau = docCaiDatManHinh()
    datC(dau)
    datKq(tinhThuManHinh(dau))
    datLaTv(document.documentElement.dataset.cheDo === 'tv')
    datMan({ w: screen.width, h: screen.height, dpr: window.devicePixelRatio || 1 })
  }, [])

  function doi(moi: CaiDatManHinh) {
    datC(moi)
    datKq(luuManHinh(moi))
  }

  // Cỡ chữ thân bài ước tính ngoài đời thật: 16px × hệ số, quy ra mm theo mật độ
  const mm = (px: number) => (kq ? ((px * kq.heSo) / kq.matDo) * 25.4 : null)
  const mmGoc = man && c.inch ? (16 / (Math.sqrt(man.w ** 2 + man.h ** 2) / c.inch)) * 25.4 : null

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold">Cỡ giao diện theo màn hình laptop</h2>
        <p className="mt-1 text-sm leading-relaxed text-white/50">
          Trình duyệt không biết màn hình của bạn bao nhiêu inch. Chọn đúng cỡ máy thì app tự phóng chữ, nút và khoảng
          cách để vừa mắt ở khoảng cách ngồi laptop, bố cục giữ nguyên. Chỉ áp dụng cho{' '}
          <strong className="font-semibold text-white/70">trình duyệt đang mở trang này</strong>: TV Box hay máy khác
          giữ cỡ riêng của nó.
        </p>
        {laTv && (
          <p className="mt-2 rounded bg-amber-500/15 px-3 py-2 text-xs text-amber-200">
            Đang ở chế độ TV: cỡ chữ TV tự tính theo bề rộng khung, cài đặt này chỉ có tác dụng khi về chế độ PC.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-[var(--color-vien)] bg-[var(--color-nen-2)] p-4">
        <p className="text-sm font-medium">Màn hình máy này bao nhiêu inch?</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => doi({ ...c, inch: 0 })}
            className={`rounded-full px-3 py-1.5 text-sm transition ${
              c.inch === 0 ? 'bg-white font-medium text-black' : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            Tắt (mặc định)
          </button>
          {CO_PHO_BIEN.map((inch) => (
            <button
              key={inch}
              onClick={() => doi({ ...c, inch })}
              className={`rounded-full px-3 py-1.5 text-sm tabular-nums transition ${
                c.inch === inch ? 'bg-white font-medium text-black' : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              {String(inch).replace('.', ',')}&quot;
            </button>
          ))}
          <form
            className="flex items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              const so = Number(tuNhap.replace(',', '.'))
              if (so >= 10 && so <= 40) doi({ ...c, inch: Math.round(so * 10) / 10 })
            }}
          >
            <input
              value={tuNhap}
              onChange={(e) => datTuNhap(e.target.value)}
              inputMode="decimal"
              placeholder="Cỡ khác"
              aria-label="Nhập cỡ màn hình khác, đơn vị inch"
              className="w-24 rounded border border-[var(--color-vien)] bg-black/30 px-2.5 py-1.5 text-sm outline-none focus:border-white/40"
            />
            <button className="rounded bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20">Đặt</button>
          </form>
        </div>

        <div className="mt-5">
          <label htmlFor="tinh-chinh" className="flex items-baseline justify-between text-sm">
            <span className="font-medium">Tinh chỉnh theo ý thích</span>
            <span className="tabular-nums text-white/60">{c.tinhChinh}%</span>
          </label>
          <input
            id="tinh-chinh"
            type="range"
            min={80}
            max={130}
            step={5}
            value={c.tinhChinh}
            disabled={c.inch === 0}
            onChange={(e) => doi({ ...c, tinhChinh: Number(e.target.value) })}
            className="mt-2 w-full accent-[var(--color-nhan)] disabled:opacity-40"
          />
          <p className="mt-1 text-xs text-white/40">Kéo trái cho nhỏ hơn (nhiều phim mỗi hàng), kéo phải cho to hơn.</p>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--color-vien)] bg-[var(--color-nen-2)] p-4 text-sm">
        <p className="font-medium">Kết quả</p>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-white/65">
          <dt className="text-white/40">Màn hình trình duyệt báo</dt>
          <dd className="tabular-nums">
            {man ? `${man.w} × ${man.h} px, Windows phóng ${Math.round(man.dpr * 100)}%` : '...'}
          </dd>
          <dt className="text-white/40">Cỡ giao diện</dt>
          <dd className="tabular-nums">
            {kq ? <strong className="text-white">{Math.round(kq.heSo * 100)}%</strong> : 'Mặc định (100%)'}
          </dd>
          {kq && (
            <>
              <dt className="text-white/40">Chữ thân bài ngoài đời</dt>
              <dd className="tabular-nums">
                cao khoảng {mm(16)!.toFixed(1).replace('.', ',')} mm
                {mmGoc && Math.abs(mmGoc - mm(16)!) > 0.05 && (
                  <span className="text-white/40"> (chưa chỉnh: {mmGoc.toFixed(1).replace('.', ',')} mm)</span>
                )}
              </dd>
            </>
          )}
        </dl>
        <p className="mt-3 text-xs text-white/40">
          Mốc vừa mắt khi ngồi laptop là chữ cao khoảng 3,5–4 mm. Đổi độ phân giải hay mức phóng của Windows thì mở lại
          trang là app tự tính lại.
        </p>
      </div>
    </div>
  )
}
