import Link from 'next/link'
import { existsSync } from 'node:fs'
import { notFound } from 'next/navigation'
import { type Tap } from '@/lib/vsmov'
import { layChiTiet, kieuNguonPhat } from '@/lib/nguon'
import { layHangPhim, tapCuaPhim, phuDeCuaTap } from '@/lib/thu-vien'
import { db } from '@/lib/db'
import { layMocIntro } from '@/lib/theo-doi'
import { nhanNgonNgu } from '@/lib/phu-de'
import Player, { type NguonPhat, type PhuDeMuc, type TrackAm } from '@/components/Player'
import DanhSachTap from '@/components/DanhSachTap'
import TimPhuDe from '@/components/TimPhuDe'

function tepUrl(d: string, chuyenMa = false) {
  return '/api/tep?' + (chuyenMa ? 'ma=' : 'f=') + encodeURIComponent(d)
}

/** Tập này đã tải về máy chưa? Có thì phát từ ổ đĩa, khỏi đụng mạng. */
function fileDaTai(slug: string, tapSlug: string): string | null {
  const h = db
    .prepare("select duong_dan_ra from tai_ve where phim_slug = ? and tap_slug = ? and trang_thai = 'xong'")
    .get(slug, tapSlug) as { duong_dan_ra: string | null } | undefined
  return h?.duong_dan_ra && existsSync(h.duong_dan_ra) ? h.duong_dan_ra : null
}

export default async function TrangXem({ params, searchParams }: PageProps<'/xem/[slug]'>) {
  const { slug } = await params
  const sp = await searchParams
  const laLocal = slug.startsWith('local-')
  const tapMongMuon = typeof sp.tap === 'string' ? sp.tap : ''

  let tieuDe: string
  let tenPhim: string
  let nguon: NguonPhat
  let phuDeThem: PhuDeMuc[] = []
  let dsTap: Tap[]
  let viTri: number
  let khoaTap: string
  /** Poster DỌC — ghi vào lịch sử xem cho thẻ 2:3. */
  let poster: string | undefined
  /** Ảnh NGANG — khung chờ của video (16:9) và thẻ TV. */
  let anhNen: string | undefined
  let soMayChu = 0
  let tenMayChu: { ten: string }[] = []
  let ghiChu: string | null = null
  let trackAm: TrackAm[] = []
  let tepLocal: string | undefined
  let tapId: number | undefined

  if (laLocal) {
    const h = layHangPhim(slug)
    if (!h) notFound()
    const tap = tapCuaPhim(h.id)
    if (!tap.length) notFound()

    dsTap = tap.map((t) => ({ ten: t.ten || String(t.so_tap), slug: 'tap-' + t.so_tap, embed: '' }))
    viTri = Math.max(0, dsTap.findIndex((t) => t.slug === tapMongMuon))
    const t = tap[viTri]
    if (!t.duong_dan_file) notFound()

    tenPhim = h.ten
    tieuDe = tap.length > 1 ? `${h.ten} - Tập ${t.ten || t.so_tap}` : h.ten
    poster = h.poster || undefined
    anhNen = h.backdrop || h.poster || undefined
    khoaTap = dsTap[viTri].slug
    nguon = { kieu: 'tep', duongDan: t.duong_dan_file, chuyenMa: !!t.can_chuyen_ma }
    tepLocal = t.duong_dan_file
    tapId = t.id
    // Danh sách luồng tiếng đọc lúc quét — .mkv thường có 2-3 thứ tiếng
    try {
      const ds = JSON.parse(t.luong || '[]') as { chiSo: number; loai: string; ngonNgu?: string; nhan?: string }[]
      trackAm = ds
        .filter((l) => l.loai === 'audio')
        .map((l) => ({
          chiSo: l.chiSo,
          nhan: l.nhan || nhanNgonNgu(l.ngonNgu, 'Tiếng ' + (l.chiSo + 1)),
        }))
    } catch {
      trackAm = []
    }
    if (t.can_chuyen_ma) {
      ghiChu = 'File này dùng codec trình duyệt không phát thẳng được nên đang chuyển mã bằng ffmpeg. Tua sẽ hơi chậm.'
    }
    phuDeThem = phuDeCuaTap(t.id).map((p) => ({
      ma: p.ngon_ngu || 'und',
      nhan: p.nhan || 'Phụ đề',
      url: tepUrl(p.duong_dan),
    }))
  } else {
    const ct = await layChiTiet(slug)
    if (!ct || !ct.mayChu.length) notFound()

    soMayChu = Math.min(Math.max(0, Number(sp.server ?? 0) || 0), ct.mayChu.length - 1)
    const mayChu = ct.mayChu[soMayChu]
    dsTap = mayChu.tap
    viTri = Math.max(0, dsTap.findIndex((t) => t.slug === tapMongMuon))
    const t = dsTap[viTri]

    tenPhim = ct.ten
    tieuDe = dsTap.length > 1 ? `${ct.ten} - Tập ${t.ten}` : ct.ten
    poster = ct.poster || ct.anhNgang
    anhNen = ct.anhNgang || ct.poster
    khoaTap = t.slug
    tenMayChu = ct.mayChu.map((m) => ({ ten: m.ten }))

    const daTai = fileDaTai(slug, t.slug)
    if (daTai) {
      nguon = { kieu: 'tep', duongDan: daTai }
      ghiChu = 'Đang phát bản đã tải về trong máy, phụ đề nằm sẵn trong file.'
    } else {
      // KKPhim cho m3u8 thẳng, vsmov chỉ có embed — tự nhận dạng
      nguon = kieuNguonPhat(t.embed)
    }
  }

  // dsTap đã được sắp theo số tập ở lib/nguon.ts, nên "tập sau" là tập kế thật
  // chứ không phải phần tử kế trong thứ tự lộn xộn của nguồn.
  const ke = dsTap[viTri + 1]
  const duong = (t: string) => `/xem/${slug}?tap=${t}${laLocal ? '' : `&server=${soMayChu}`}`
  const nhieuTap = dsTap.length > 1
  const tenMayChuDang = tenMayChu[soMayChu]?.ten

  return (
    /* trang-xem: ở chế độ TV, globals.css cho trình phát phủ kín màn và giấu
       đầu trang — xem phim trên TV thì từng dòng của màn 540px đều quý. */
    <div className="trang-xem mx-auto max-w-[1400px] px-4 py-5">
      <Player
        key={slug + ':' + khoaTap}
        nguon={nguon}
        khoa={`${slug}:${khoaTap}`}
        slug={slug}
        tap={khoaTap}
        tieuDe={tieuDe}
        tenPhim={tenPhim}
        nhanTap={
          [nhieuTap ? `Tập ${dsTap[viTri].ten}` : null, tenMayChu.length > 1 ? tenMayChuDang : null]
            .filter(Boolean)
            .join(' · ') || undefined
        }
        poster={poster}
        anhNen={anhNen}
        veTrang={`/phim/${slug}`}
        dsTap={nhieuTap ? dsTap.map((t) => ({ nhan: t.ten, href: duong(t.slug), dang: t.slug === khoaTap })) : []}
        mayChu={tenMayChu.map((m, i) => ({
          nhan: m.ten,
          href: `/xem/${slug}?tap=${khoaTap}&server=${i}`,
          dang: i === soMayChu,
        }))}
        phuDeThem={phuDeThem}
        nguonTen={laLocal ? 'local' : 'vsmov'}
        tapSau={ke ? { nhan: `Tập ${ke.ten}`, href: duong(ke.slug) } : null}
        mocIntro={layMocIntro(slug)}
        trackAm={trackAm}
        tepLocal={tepLocal}
        tapId={tapId}
      />

      {ghiChu && <p className="mt-3 rounded bg-white/5 px-3 py-2 text-xs text-white/50">{ghiChu}</p>}

      {/* Phim trong máy thiếu phụ đề thì tìm trên OpenSubtitles */}
      {laLocal && tapId && phuDeThem.length === 0 && (
        <div className="mt-3">
          <TimPhuDe tapId={tapId} tuKhoa={tenPhim} />
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-start gap-x-6 gap-y-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold">
            <Link href={`/phim/${slug}`} className="hover:underline">
              {tenPhim}
            </Link>
          </h1>
          {nhieuTap && <p className="mt-0.5 text-sm text-white/50">Tập {dsTap[viTri].ten}</p>}
        </div>
        <Link
          href={`/phim/${slug}`}
          className="rounded border border-[var(--color-vien)] px-3 py-1.5 text-sm text-white/70 hover:text-white"
        >
          Xem thông tin phim
        </Link>
      </div>

      {tenMayChu.length > 1 && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="text-sm text-white/50">Máy chủ:</span>
          {tenMayChu.map((m, i) => (
            <Link
              key={i}
              href={`/xem/${slug}?tap=${khoaTap}&server=${i}`}
              className={`rounded px-3 py-1.5 text-sm ${
                i === soMayChu ? 'bg-white text-black' : 'bg-[var(--color-nen-2)] text-white/70 hover:text-white'
              }`}
            >
              {m.ten}
            </Link>
          ))}
        </div>
      )}

      {nhieuTap && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-white/70">Danh sách tập ({dsTap.length})</h2>
          <DanhSachTap slug={slug} tap={dsTap} dangXem={khoaTap} server={soMayChu} />
        </div>
      )}

      <p className="an-tren-tv mt-8 text-xs leading-relaxed text-white/40">
        Bấm <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white/70">?</kbd> trong khung phim để xem
        phím tắt. Kéo thẳng tệp .srt vào khung hình để gắn phụ đề riêng. Loa nhỏ thì bật Cài đặt → Tăng âm lượng.
      </p>
    </div>
  )
}
