'use client'

/**
 * Player: thẻ <video> trần + hls.js + thanh điều khiển tự viết.
 *
 * Vì sao không nhúng iframe của nguồn: iframe cross-origin thì không đọc được
 * currentTime, không gắn được phụ đề rời, không bắt được phím tắt. Toàn bộ
 * tính năng bên dưới sẽ mất sạch.
 *
 * Phụ đề đi qua đường Blob: tải VTT về (qua proxy same-origin), dời thời gian
 * nếu cần, rồi tạo blob URL cho thẻ <track>. Trình duyệt lo phần dựng cue —
 * rẻ hơn nhiều so với tự phân tích VTT và bơm cue bằng tay.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type Hls from 'hls.js'
import { srtSangVtt, doiThoiGian } from '@/lib/phu-de'

export type PhuDeMuc = { ma: string; nhan: string; url?: string; noiDung?: string }

export type NguonPhat =
  | { kieu: 'embed'; embed: string }
  /** KKPhim cho thẳng m3u8, khỏi phải mò qua trang embed như vsmov. */
  | { kieu: 'm3u8'; url: string }
  | { kieu: 'tep'; duongDan: string; chuyenMa?: boolean }

export type TapKe = { nhan: string; href: string }

export type MocIntro = { bat_dau: number; ket_thuc: number }

/** Luồng tiếng trong file local (đọc bằng ffprobe lúc quét). */
export type TrackAm = { chiSo: number; nhan: string }

/** Ảnh lưới xem trước khi tua (chỉ có với file trong máy). */
export type AnhTua = { url: string; giay: number; cot: number; rongO: number; caoO: number; tong: number }

type Props = {
  nguon: NguonPhat
  khoa: string
  tieuDe: string
  phuDeThem?: PhuDeMuc[]
  poster?: string
  slug: string
  tap?: string
  nguonTen?: 'vsmov' | 'local'
  tapSau?: TapKe | null
  /** Mốc intro đã đánh dấu cho phim/phần này — dùng chung cho mọi tập. */
  mocIntro?: MocIntro | null
  /** Nhiều hơn 1 thì hiện menu chọn tiếng (chỉ file trong máy). */
  trackAm?: TrackAm[]
  /** Đường dẫn file local — cần để đổi tiếng (phải chuyển mã lại). */
  tepLocal?: string
  /** Id bản ghi tập trong máy — để xin ảnh xem trước khi tua. */
  tapId?: number
}

const TOC_DO = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
const KHOA_CAI_DAT = 'phim:cai-dat-player'
/**
 * Đếm ngược trước khi sang tập kế, tính bằng giây.
 *
 * Trước đây hết tập là nhảy thẳng — người xem không kịp biết chuyện gì vừa xảy
 * ra, và muốn dừng thì đã sang tập mới rồi. Vài giây đếm ngược kèm nút Huỷ là
 * cách mọi trang phim lớn giải quyết: ai muốn xem tiếp thì không phải làm gì,
 * ai muốn dừng vẫn kịp.
 */
const DEM_NGUOC_GIAY = 8

/**
 * Còn bấy nhiêu giây thì nạp trước trang tập kế.
 *
 * Đo trên máy này: trang /xem của một phim bộ từ nguồn mất 2,4 giây khi nguội,
 * 0,06 giây khi ấm. Nạp trước là bấm "Tập sau" xong đi luôn, thay vì ngồi nhìn
 * màn hình đen. Hai phút đủ rộng để tải xong, mà vẫn nằm trong khoảng người xem
 * gần như chắc chắn sẽ xem hết tập.
 *
 * Chỉ nạp trước TRANG, không nạp trước video: muốn đệm sẵn luồng HLS thì phải
 * dựng thêm một thẻ <video> và một bản hls.js thứ hai chạy song song — nặng cho
 * TV Box mà chỉ đổi lấy một hai giây.
 */
const TAI_TRUOC_GIAY = 120

/** Số lần tự sang tập liên tiếp mà không ai chạm vào thì hỏi "còn xem không". */
const NGUONG_HOI = 3
const KHOA_TU_SANG = 'phim:so-lan-tu-sang'

function mmss(giay: number): string {
  if (!Number.isFinite(giay) || giay < 0) return '0:00'
  const g = Math.floor(giay)
  const h = Math.floor(g / 3600)
  const p = Math.floor((g % 3600) / 60)
  const s = g % 60
  const hai = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${hai(p)}:${hai(s)}` : `${p}:${hai(s)}`
}

type CaiDat = { amLuong: number; tocDo: number; coChu: number; nenPhuDe: boolean }
const MAC_DINH: CaiDat = { amLuong: 1, tocDo: 1, coChu: 100, nenPhuDe: true }

function docCaiDat(): CaiDat {
  if (typeof window === 'undefined') return MAC_DINH
  try {
    const l = JSON.parse(localStorage.getItem(KHOA_CAI_DAT) || '{}')
    // Ép kiểu tường minh: coChu/nenPhuDe được nội suy vào <style> inline, không
    // để giá trị lạ trong localStorage lọt vào chuỗi CSS.
    return {
      amLuong: Math.min(1, Math.max(0, Number(l.amLuong) || MAC_DINH.amLuong)),
      tocDo: Number(l.tocDo) || MAC_DINH.tocDo,
      coChu: Math.min(300, Math.max(50, Number(l.coChu) || MAC_DINH.coChu)),
      nenPhuDe: typeof l.nenPhuDe === 'boolean' ? l.nenPhuDe : MAC_DINH.nenPhuDe,
    }
  } catch {
    return MAC_DINH
  }
}

export default function Player({
  nguon,
  khoa,
  tieuDe,
  phuDeThem = [],
  poster,
  slug,
  tap,
  nguonTen = 'vsmov',
  tapSau = null,
  mocIntro = null,
  trackAm = [],
  tepLocal,
  tapId,
}: Props) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const anRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const luuRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const thuLaiRef = useRef(0)
  // onTimeUpdate bắn ~4 lần/giây; không có chốt này là gọi prefetch hàng trăm lần.
  const daTaiTruocRef = useRef(false)

  const [dangTai, datDangTai] = useState(true)
  const [loi, datLoi] = useState<string | null>(null)
  const [dangPhat, datDangPhat] = useState(false)
  const [thoiGian, datThoiGian] = useState(0)
  const [thoiLuong, datThoiLuong] = useState(0)
  const [dem, datDem] = useState(0)
  const [amLuong, datAmLuong] = useState(MAC_DINH.amLuong)
  const [tat, datTat] = useState(false)
  const [tocDo, datTocDo] = useState(1)
  const [toanManHinh, datToanManHinh] = useState(false)
  const [hienDk, datHienDk] = useState(true)
  const [menu, datMenu] = useState<'' | 'tocdo' | 'phude' | 'hengio' | 'tieng'>('')
  const [dsPhuDe, datDsPhuDe] = useState<PhuDeMuc[]>([])
  const [chiSoPhuDe, datChiSoPhuDe] = useState(-1)
  const [buGiay, datBuGiay] = useState(0)
  const [blobPhuDe, datBlobPhuDe] = useState<string | null>(null)
  const [coChu, datCoChu] = useState(MAC_DINH.coChu)
  const [nenPhuDe, datNenPhuDe] = useState(MAC_DINH.nenPhuDe)
  const [tiepTuc, datTiepTuc] = useState<number | null>(null)
  const [keoVao, datKeoVao] = useState(false)
  const [hienTapSau, datHienTapSau] = useState(false)
  /** Số giây còn lại trước khi tự sang tập kế; null = không đếm. */
  const [demNguoc, datDemNguoc] = useState<number | null>(null)
  const [src, datSrc] = useState<string | null>(null)
  const [laHls, datLaHls] = useState(false)

  // Bỏ qua intro
  const [intro, datIntro] = useState<MocIntro | null>(mocIntro)
  const [dangDanhDau, datDangDanhDau] = useState<number | null>(null)
  const [nhac, datNhac] = useState<string | null>(null)

  // Hẹn giờ tắt: số phút, hoặc 'het-tap'
  const [henGio, datHenGio] = useState<number | 'het-tap' | null>(null)
  const [conLai, datConLai] = useState(0)
  const [hoiConXem, datHoiConXem] = useState(false)

  // Đổi tiếng: trình duyệt chỉ phát luồng mặc định, nên chọn luồng khác thì
  // BẮT BUỘC đi qua đường chuyển mã của ffmpeg.
  const [amDangChon, datAmDangChon] = useState(0)

  // Xem trước khi tua
  const [reMoc, datReMoc] = useState<{ giay: number; trai: number } | null>(null)
  const [anhTua, datAnhTua] = useState<AnhTua | null>(null)

  // ---- nạp cài đặt đã nhớ ------------------------------------------------
  useEffect(() => {
    const c = docCaiDat()
    datAmLuong(c.amLuong)
    datTocDo(c.tocDo)
    datCoChu(c.coChu)
    datNenPhuDe(c.nenPhuDe)
  }, [])

  const ghiCaiDat = useCallback((moi: Partial<CaiDat>) => {
    try {
      localStorage.setItem(KHOA_CAI_DAT, JSON.stringify({ ...docCaiDat(), ...moi }))
    } catch {
      // trình duyệt chặn localStorage thì thôi, không phải lỗi chặn đường
    }
  }, [])

  // ---- xác định nguồn phát ----------------------------------------------
  useEffect(() => {
    let huy = false
    datLoi(null)
    datDangTai(true)
    datSrc(null)

    async function xacDinh() {
      if (nguon.kieu === 'tep') {
        const tham = nguon.chuyenMa ? 'ma=' : 'f='
        if (huy) return
        datLaHls(false)
        datSrc('/api/tep?' + tham + encodeURIComponent(nguon.duongDan))
        datDsPhuDe(phuDeThem)
        datChiSoPhuDe(phuDeThem.length ? 0 : -1)
        return
      }
      if (nguon.kieu === 'm3u8') {
        if (huy) return
        datLaHls(true)
        datSrc('/api/tep?u=' + encodeURIComponent(nguon.url))
        datDsPhuDe(phuDeThem)
        datChiSoPhuDe(phuDeThem.length ? 0 : -1)
        return
      }
      try {
        const r = await fetch('/api/nguon?embed=' + encodeURIComponent(nguon.embed))
        const j = await r.json()
        if (huy) return
        if (!r.ok || !j.m3u8) throw new Error(j.loi || 'Không lấy được nguồn phát')
        const ds: PhuDeMuc[] = [
          ...(j.phuDe || []).map((p: PhuDeMuc) => ({
            ...p,
            url: '/api/tep?u=' + encodeURIComponent(p.url as string),
          })),
          ...phuDeThem,
        ]
        datDsPhuDe(ds)
        datChiSoPhuDe(ds.length ? 0 : -1)
        datLaHls(true)
        datSrc('/api/tep?u=' + encodeURIComponent(j.m3u8))
      } catch (e) {
        if (!huy) {
          datLoi(e instanceof Error ? e.message : 'Không lấy được nguồn phát')
          datDangTai(false)
        }
      }
    }
    xacDinh()
    return () => {
      huy = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nguon.kieu, (nguon as { embed?: string }).embed, (nguon as { url?: string }).url, (nguon as { duongDan?: string }).duongDan])

  // Sang tập khác mà Player không bị gỡ đi thì ref vẫn giữ giá trị cũ, nên
  // tập kế tiếp sẽ không bao giờ được nạp trước. Mở chốt lại mỗi lần đổi tập.
  useEffect(() => {
    daTaiTruocRef.current = false
  }, [tapSau?.href])

  // ---- gắn hls.js / src thẳng -------------------------------------------
  useEffect(() => {
    const v = videoRef.current
    if (!v || !src) return
    thuLaiRef.current = 0

    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    if (!laHls) {
      v.src = src
      return
    }

    let huy = false
    import('hls.js').then(({ default: HlsCtor }) => {
      if (huy || !videoRef.current) return
      // hls.js TRƯỚC, native HLS chỉ là đường lui cho Safari.
      // Chrome trả "maybe" cho canPlayType('application/vnd.apple.mpegurl')
      // nhưng thật ra không phát được — tin nó là video đứng im ở readyState 0.
      if (!HlsCtor.isSupported()) {
        if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) videoRef.current.src = src
        else datLoi('Trình duyệt không hỗ trợ HLS')
        return
      }
      const hls = new HlsCtor({ enableWorker: true, lowLatencyMode: false })
      hlsRef.current = hls
      hls.loadSource(src)
      hls.attachMedia(videoRef.current)
      hls.on(HlsCtor.Events.ERROR, (_e, d) => {
        if (!d.fatal) return
        if (thuLaiRef.current >= 3) {
          datLoi('Nguồn phát lỗi. Thử đổi server khác.')
          datDangTai(false)
          return
        }
        thuLaiRef.current += 1
        if (d.type === HlsCtor.ErrorTypes.NETWORK_ERROR) hls.startLoad()
        else if (d.type === HlsCtor.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError()
        else {
          datLoi('Nguồn phát lỗi. Thử đổi server khác.')
          datDangTai(false)
        }
      })
    })

    return () => {
      huy = true
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [src, laHls])

  // ---- phụ đề: dựng blob VTT --------------------------------------------
  useEffect(() => {
    let huy = false
    let tao: string | null = null

    async function nap() {
      if (chiSoPhuDe < 0 || !dsPhuDe[chiSoPhuDe]) {
        datBlobPhuDe(null)
        return
      }
      const m = dsPhuDe[chiSoPhuDe]
      try {
        let chu = m.noiDung
        if (!chu && m.url) chu = await (await fetch(m.url)).text()
        if (!chu || huy) return
        // LUÔN chuẩn hoá, đừng tin dòng đầu: nguồn vsmov gắn nhãn WEBVTT nhưng
        // mốc thời gian vẫn là dấu phẩy kiểu SRT, trình duyệt đọc ra 0 cue.
        chu = srtSangVtt(chu)
        const cuoi = buGiay ? doiThoiGian(chu, buGiay) : chu
        tao = URL.createObjectURL(new Blob([cuoi], { type: 'text/vtt' }))
        if (!huy) datBlobPhuDe(tao)
      } catch {
        if (!huy) datBlobPhuDe(null)
      }
    }
    nap()
    return () => {
      huy = true
      if (tao) URL.revokeObjectURL(tao)
    }
  }, [chiSoPhuDe, buGiay, dsPhuDe])

  // Track vừa gắn mặc định là 'disabled', phải bật tay.
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const t = setTimeout(() => {
      for (let i = 0; i < v.textTracks.length; i++) v.textTracks[i].mode = 'showing'
    }, 80)
    return () => clearTimeout(t)
  }, [blobPhuDe])

  // ---- đồng bộ âm lượng / tốc độ ----------------------------------------
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.volume = amLuong
    v.muted = tat
  }, [amLuong, tat])

  useEffect(() => {
    const v = videoRef.current
    if (v) v.playbackRate = tocDo
  }, [tocDo, src])

  // ---- ảnh xem trước khi tua ---------------------------------------------
  // Chỉ có với file trong máy: nguồn không cung cấp sprite, tự sinh bằng ffmpeg
  // tốn hàng chục giây nên chạy nền và hỏi lại vài nhịp.
  useEffect(() => {
    if (!tapId) return
    let huy = false
    let dem = 0

    async function hoi() {
      const r = await fetch('/api/anh-tua?tap=' + tapId)
      if (!r.ok) return
      const j = await r.json()
      if (huy) return
      if (j.anh) {
        datAnhTua(j.anh)
        return
      }
      if (!j.dangLam && dem === 0) {
        // Chưa có thì nhờ sinh, rồi hỏi lại
        await fetch('/api/anh-tua', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ tap: tapId }),
        })
      }
      if (++dem < 20 && !huy) setTimeout(hoi, 5000)
    }
    hoi().catch(() => {})
    return () => {
      huy = true
    }
  }, [tapId])

  // ---- lưu tiến độ -------------------------------------------------------
  const luuTienDo = useCallback(
    (dungBeacon = false) => {
      const v = videoRef.current
      if (!v || !v.duration || v.currentTime < 5) return
      const than = JSON.stringify({
        viec: 'tien-do',
        khoa,
        slug,
        tap: tap || null,
        ten: tieuDe,
        poster: poster || null,
        nguon: nguonTen,
        viTri: v.currentTime,
        thoiLuong: v.duration,
      })
      if (dungBeacon && navigator.sendBeacon) {
        navigator.sendBeacon('/api/xem', new Blob([than], { type: 'application/json' }))
      } else {
        fetch('/api/xem', { method: 'POST', headers: { 'content-type': 'application/json' }, body: than }).catch(
          () => {},
        )
      }
    },
    [khoa, slug, tap, tieuDe, poster, nguonTen],
  )

  useEffect(() => {
    luuRef.current = setInterval(() => {
      if (videoRef.current && !videoRef.current.paused) luuTienDo()
    }, 5000)
    return () => {
      if (luuRef.current) clearInterval(luuRef.current)
      luuTienDo(true)
    }
  }, [luuTienDo])

  // ---- sự kiện video -----------------------------------------------------
  const khiCoMetadata = useCallback(async () => {
    const v = videoRef.current
    if (!v) return
    datThoiLuong(v.duration || 0)
    datDangTai(false)
    try {
      const r = await fetch('/api/xem?khoa=' + encodeURIComponent(khoa))
      const j = await r.json()
      const vt = Number(j?.xem?.vi_tri) || 0
      if (vt > 30 && (!v.duration || vt < v.duration - 20)) {
        v.currentTime = vt
        datTiepTuc(vt)
        setTimeout(() => datTiepTuc(null), 7000)
      }
    } catch {
      // không có tiến độ cũ thì xem từ đầu
    }
  }, [khoa])

  const khiHet = useCallback(() => {
    datDangPhat(false)
    luuTienDo()
    if (henGio === 'het-tap') {
      datHenGio(null)
      return
    }
    if (!tapSau) return
    // Xem liền mấy tập mà không ai chạm vào thì hỏi, đừng phát cả đêm.
    let dem = 0
    try {
      dem = Number(sessionStorage.getItem(KHOA_TU_SANG) || '0') + 1
      sessionStorage.setItem(KHOA_TU_SANG, String(dem))
    } catch {
      // trình duyệt chặn sessionStorage thì bỏ qua, cứ chạy tiếp
    }
    if (dem >= NGUONG_HOI) {
      datHoiConXem(true)
      return
    }
    // Không nhảy ngay: mở đếm ngược để còn kịp huỷ (xem DEM_NGUOC_GIAY).
    datDemNguoc(DEM_NGUOC_GIAY)
  }, [tapSau, luuTienDo, henGio])

  // ---- đếm ngược sang tập kế ---------------------------------------------
  useEffect(() => {
    if (demNguoc === null) return
    if (demNguoc <= 0) {
      if (tapSau) router.push(tapSau.href)
      return
    }
    const t = setTimeout(() => datDemNguoc((n) => (n === null ? null : n - 1)), 1000)
    return () => clearTimeout(t)
  }, [demNguoc, tapSau, router])

  // ---- hẹn giờ tắt --------------------------------------------------------
  useEffect(() => {
    if (typeof henGio !== 'number') {
      datConLai(0)
      return
    }
    datConLai(henGio * 60)
    const t = setInterval(() => {
      datConLai((c) => {
        if (c <= 1) {
          videoRef.current?.pause()
          datHenGio(null)
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [henGio])

  // Bất kỳ thao tác nào cũng coi như "vẫn còn người xem"
  const conNguoi = useCallback(() => {
    try {
      sessionStorage.setItem(KHOA_TU_SANG, '0')
    } catch {
      // không sao
    }
  }, [])

  // ---- đánh dấu / bỏ qua intro -------------------------------------------
  const baoNhac = useCallback((tin: string) => {
    datNhac(tin)
    setTimeout(() => datNhac(null), 3500)
  }, [])

  const danhDauIntro = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (dangDanhDau === null) {
      datDangDanhDau(v.currentTime)
      baoNhac(`Đã đánh dấu ĐẦU intro ở ${mmss(v.currentTime)}. Bấm I lần nữa ở chỗ intro kết thúc.`)
      return
    }
    const batDau = Math.min(dangDanhDau, v.currentTime)
    const ketThuc = Math.max(dangDanhDau, v.currentTime)
    datDangDanhDau(null)
    if (ketThuc - batDau < 3) {
      baoNhac('Khoảng intro quá ngắn, bỏ qua.')
      return
    }
    datIntro({ bat_dau: batDau, ket_thuc: ketThuc })
    fetch('/api/xem', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ viec: 'moc-intro', slug, batDau, ketThuc }),
    }).catch(() => {})
    baoNhac(`Đã lưu intro ${mmss(batDau)}–${mmss(ketThuc)} cho cả phim này.`)
  }, [dangDanhDau, slug, baoNhac])

  const doiTieng = useCallback(
    (chiSo: number) => {
      if (!tepLocal || chiSo === amDangChon) return
      const v = videoRef.current
      const moc = v?.currentTime ?? 0
      datAmDangChon(chiSo)
      datMenu('')
      datLaHls(false)
      // Chuyển mã không tua được bằng Range, nên nhảy tới đúng chỗ bằng ?t=
      datSrc(`/api/tep?ma=${encodeURIComponent(tepLocal)}&am=${chiSo}&t=${Math.floor(moc)}`)
    },
    [tepLocal, amDangChon],
  )

  const boQuaIntro = useCallback(() => {
    const v = videoRef.current
    if (v && intro) v.currentTime = intro.ket_thuc
  }, [intro])

  const trongIntro = !!intro && thoiGian >= intro.bat_dau && thoiGian < intro.ket_thuc - 0.5

  // ---- điều khiển --------------------------------------------------------
  const batTat = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play().catch(() => {})
    else v.pause()
  }, [])

  const nhay = useCallback((giay: number) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = Math.max(0, Math.min((v.duration || 0) - 0.5, v.currentTime + giay))
  }, [])

  const doiToanManHinh = useCallback(() => {
    const b = boxRef.current
    if (!b) return
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else b.requestFullscreen().catch(() => {})
  }, [])

  const doiPip = useCallback(async () => {
    const v = videoRef.current
    if (!v) return
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture()
      else await v.requestPictureInPicture()
    } catch {
      // trình duyệt không cho thì bỏ qua
    }
  }, [])

  useEffect(() => {
    const f = () => datToanManHinh(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', f)
    return () => document.removeEventListener('fullscreenchange', f)
  }, [])

  // ---- phím tắt ----------------------------------------------------------
  useEffect(() => {
    function xuLy(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const v = videoRef.current
      if (!v) return
      let chan = true
      conNguoi()
      switch (e.key.toLowerCase()) {
        case 'enter':
          /**
           * Nút OK của remote TV gửi Enter. Nhưng Enter khi đang đứng trên một
           * nút thì phải là "bấm nút đó" — nếu cướp ở đây thì mọi nút trong
           * thanh điều khiển đều bấm ra phát/dừng, không bấm được gì khác.
           */
          if (t && (t.tagName === 'BUTTON' || t.tagName === 'A' || t.tagName === 'SELECT')) return
          batTat()
          break
        case ' ':
        case 'k':
          batTat()
          break
        case 'arrowright':
        case 'l':
          nhay(10)
          break
        case 'arrowleft':
        case 'j':
          nhay(-10)
          break
        case 'arrowup':
          datAmLuong((a) => {
            const m = Math.min(1, a + 0.1)
            ghiCaiDat({ amLuong: m })
            return m
          })
          datTat(false)
          break
        case 'arrowdown':
          datAmLuong((a) => {
            const m = Math.max(0, a - 0.1)
            ghiCaiDat({ amLuong: m })
            return m
          })
          break
        case 'f':
          doiToanManHinh()
          break
        case 'i':
          danhDauIntro()
          break
        case 's':
          if (intro) boQuaIntro()
          break
        case 'm':
          datTat((x) => !x)
          break
        case 'p':
          doiPip()
          break
        case 'c':
          datChiSoPhuDe((i) => (i >= 0 ? -1 : dsPhuDe.length ? 0 : -1))
          break
        case 'n':
          if (tapSau) router.push(tapSau.href)
          break
        case '[':
          datTocDo((x) => {
            const m = TOC_DO[Math.max(0, TOC_DO.indexOf(x) - 1)] ?? x
            ghiCaiDat({ tocDo: m })
            return m
          })
          break
        case ']':
          datTocDo((x) => {
            const m = TOC_DO[Math.min(TOC_DO.length - 1, TOC_DO.indexOf(x) + 1)] ?? x
            ghiCaiDat({ tocDo: m })
            return m
          })
          break
        default:
          if (/^[0-9]$/.test(e.key) && v.duration) v.currentTime = (v.duration * Number(e.key)) / 10
          else chan = false
      }
      if (chan) e.preventDefault()
    }
    window.addEventListener('keydown', xuLy)
    return () => window.removeEventListener('keydown', xuLy)
  }, [batTat, nhay, doiToanManHinh, doiPip, dsPhuDe.length, tapSau, router, ghiCaiDat, danhDauIntro, boQuaIntro, intro, conNguoi])

  // ---- tự ẩn thanh điều khiển -------------------------------------------
  const danhThuc = useCallback(() => {
    datHienDk(true)
    if (anRef.current) clearTimeout(anRef.current)
    anRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused && !menu) datHienDk(false)
    }, 3000)
  }, [menu])

  // ---- kéo thả phụ đề ----------------------------------------------------
  const themPhuDeTuFile = useCallback(async (f: File) => {
    const chu = await f.text()
    const vtt = f.name.toLowerCase().endsWith('.srt') || !chu.trimStart().startsWith('WEBVTT') ? srtSangVtt(chu) : chu
    datDsPhuDe((ds) => {
      const moi = [...ds, { ma: 'tuy-chon', nhan: f.name, noiDung: vtt }]
      datChiSoPhuDe(moi.length - 1)
      return moi
    })
  }, [])

  const phanTramDem = useMemo(() => (thoiLuong ? (dem / thoiLuong) * 100 : 0), [dem, thoiLuong])
  const phanTramChay = useMemo(() => (thoiLuong ? (thoiGian / thoiLuong) * 100 : 0), [thoiGian, thoiLuong])

  const cssCue = useMemo(
    () =>
      `#video-chinh::cue{font-size:${coChu}%;color:#fff;background:${
        nenPhuDe ? 'rgba(0,0,0,.75)' : 'transparent'
      };text-shadow:${nenPhuDe ? 'none' : '0 2px 4px rgba(0,0,0,.9)'}}`,
    [coChu, nenPhuDe],
  )

  return (
    <div
      ref={boxRef}
      className="trinh-phat group relative aspect-video w-full select-none overflow-hidden rounded-lg bg-black"
      onMouseMove={danhThuc}
      onMouseLeave={() => videoRef.current && !videoRef.current.paused && datHienDk(false)}
      onDragOver={(e) => {
        e.preventDefault()
        datKeoVao(true)
      }}
      onDragLeave={() => datKeoVao(false)}
      onDrop={(e) => {
        e.preventDefault()
        datKeoVao(false)
        const f = e.dataTransfer.files?.[0]
        if (f && /[.](srt|vtt)$/i.test(f.name)) themPhuDeTuFile(f)
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: cssCue }} />

      <video
        id="video-chinh"
        ref={videoRef}
        poster={poster}
        className="h-full w-full"
        playsInline
        onClick={batTat}
        onDoubleClick={doiToanManHinh}
        onLoadedMetadata={khiCoMetadata}
        onPlay={() => {
          datDangPhat(true)
          danhThuc()
        }}
        onPause={() => {
          datDangPhat(false)
          datHienDk(true)
          luuTienDo()
        }}
        onWaiting={() => datDangTai(true)}
        onPlaying={() => datDangTai(false)}
        onEnded={khiHet}
        onTimeUpdate={(e) => {
          const v = e.currentTarget
          datThoiGian(v.currentTime)
          if (v.buffered.length) datDem(v.buffered.end(v.buffered.length - 1))
          if (tapSau && v.duration && v.duration - v.currentTime < 30) datHienTapSau(true)
          else datHienTapSau(false)
          if (tapSau && v.duration && v.duration - v.currentTime < TAI_TRUOC_GIAY && !daTaiTruocRef.current) {
            daTaiTruocRef.current = true
            router.prefetch(tapSau.href)
          }
        }}
      >
        {blobPhuDe && (
          <track
            key={blobPhuDe}
            kind="subtitles"
            src={blobPhuDe}
            srcLang={dsPhuDe[chiSoPhuDe]?.ma || 'vi'}
            label={dsPhuDe[chiSoPhuDe]?.nhan || 'Phụ đề'}
            default
          />
        )}
      </video>

      {/* trạng thái */}
      {dangTai && !loi && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-white/25 border-t-white" />
        </div>
      )}

      {loi && (
        <div className="absolute inset-0 grid place-items-center bg-black/80 px-6 text-center">
          <div>
            <p className="mb-3 text-sm text-white/90">{loi}</p>
            <button
              onClick={() => {
                datLoi(null)
                datDangTai(true)
                if (src) datSrc(src + '&t=' + Date.now())
              }}
              className="rounded bg-white px-4 py-2 text-sm font-medium text-black"
            >
              Thử lại
            </button>
          </div>
        </div>
      )}

      {keoVao && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center border-2 border-dashed border-white/70 bg-black/60">
          <p className="text-sm font-medium">Thả file .srt hoặc .vtt vào đây</p>
        </div>
      )}

      {tiepTuc !== null && (
        <div className="absolute left-4 top-4 flex items-center gap-3 rounded bg-black/80 px-3 py-2 text-xs">
          <span>Đã tiếp tục từ {mmss(tiepTuc)}</span>
          <button
            onClick={() => {
              if (videoRef.current) videoRef.current.currentTime = 0
              datTiepTuc(null)
            }}
            className="underline underline-offset-2 hover:text-white"
          >
            Xem từ đầu
          </button>
        </div>
      )}

      {hienTapSau && tapSau && demNguoc === null && (
        <button
          onClick={() => router.push(tapSau.href)}
          className="absolute bottom-24 right-4 rounded bg-white/95 px-4 py-2 text-sm font-medium text-black hover:bg-white"
        >
          {tapSau.nhan} &rarr;
        </button>
      )}

      {/* Hết tập: đếm ngược thay vì nhảy thẳng sang tập sau. Vùng bấm để to vì
          trên TV phải trỏ trúng bằng con trỏ ảo. */}
      {demNguoc !== null && tapSau && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/75 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-xl bg-[#15151c] p-5 text-center ring-1 ring-white/10">
            <p className="text-xs uppercase tracking-wide text-white/40">Tập tiếp theo</p>
            <p className="mt-1 truncate text-lg font-semibold">{tapSau.nhan}</p>

            <p className="mt-4 text-4xl font-black tabular-nums">{demNguoc}</p>
            <div className="mx-auto mt-2 h-1 w-40 overflow-hidden rounded bg-white/15">
              <div
                className="h-full bg-[var(--color-nhan)] transition-[width] duration-1000 ease-linear"
                style={{ width: (demNguoc / DEM_NGUOC_GIAY) * 100 + '%' }}
              />
            </div>

            <div className="mt-5 flex justify-center gap-2">
              <button
                onClick={() => router.push(tapSau.href)}
                className="rounded bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/85"
              >
                Xem ngay
              </button>
              <button
                onClick={() => datDemNguoc(null)}
                className="rounded bg-white/10 px-5 py-2.5 text-sm text-white/85 transition hover:bg-white/20"
              >
                Huỷ
              </button>
            </div>
          </div>
        </div>
      )}

      {trongIntro && (
        <button
          onClick={boQuaIntro}
          className="absolute bottom-24 right-4 rounded border border-white/60 bg-black/70 px-5 py-2.5 text-sm font-semibold backdrop-blur transition hover:bg-black/90"
        >
          Bỏ qua intro
        </button>
      )}

      {nhac && (
        <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded bg-black/85 px-4 py-2 text-center text-xs text-white/90 shadow-lg">
          {nhac}
        </div>
      )}

      {typeof henGio === 'number' && conLai > 0 && (
        <div className="absolute right-4 top-4 rounded bg-black/75 px-3 py-1.5 text-xs tabular-nums text-white/80">
          Tắt sau {mmss(conLai)}
        </div>
      )}

      {hoiConXem && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/85 px-6 text-center">
          <div>
            <p className="text-lg font-semibold">Bạn còn xem không?</p>
            <p className="mt-1 text-sm text-white/60">Đã tự chuyển {NGUONG_HOI} tập liên tiếp.</p>
            <div className="mt-4 flex justify-center gap-3">
              <button
                onClick={() => {
                  conNguoi()
                  datHoiConXem(false)
                  if (tapSau) router.push(tapSau.href)
                }}
                className="rounded bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-white/85"
              >
                Xem tiếp
              </button>
              <button
                onClick={() => {
                  conNguoi()
                  datHoiConXem(false)
                }}
                className="rounded bg-white/15 px-5 py-2.5 text-sm font-semibold hover:bg-white/25"
              >
                Dừng ở đây
              </button>
            </div>
          </div>
        </div>
      )}

      {/* thanh điều khiển */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent px-3 pb-2 pt-10 transition-opacity ${
          hienDk || !dangPhat ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="mb-1 truncate px-1 text-xs text-white/70">{tieuDe}</div>

        {/* thanh tua */}
        <div
          className="group/tua relative h-4 cursor-pointer"
          onClick={(e) => {
            const v = videoRef.current
            if (!v || !v.duration) return
            const r = e.currentTarget.getBoundingClientRect()
            v.currentTime = ((e.clientX - r.left) / r.width) * v.duration
          }}
          onMouseMove={(e) => {
            const v = videoRef.current
            if (!v || !v.duration) return
            const r = e.currentTarget.getBoundingClientRect()
            const ti = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
            datReMoc({ giay: ti * v.duration, trai: ti * r.width })
          }}
          onMouseLeave={() => datReMoc(null)}
        >
          <div className="absolute top-1.5 h-1 w-full rounded bg-white/25" />
          <div className="absolute top-1.5 h-1 rounded bg-white/40" style={{ width: phanTramDem + '%' }} />
          <div className="absolute top-1.5 h-1 rounded bg-red-600" style={{ width: phanTramChay + '%' }} />
          <div
            className="absolute top-0.5 h-3 w-3 -translate-x-1/2 rounded-full bg-red-600 opacity-0 transition-opacity group-hover/tua:opacity-100"
            style={{ left: phanTramChay + '%' }}
          />

          {/* Xem trước khi tua: cắt đúng ô trong ảnh lưới bằng background-position */}
          {reMoc && (
            <div
              className="pointer-events-none absolute bottom-6 -translate-x-1/2 rounded border border-white/20 bg-black/90 p-1 shadow-xl"
              style={{ left: reMoc.trai }}
            >
              {anhTua && (
                <div
                  style={{
                    width: anhTua.rongO,
                    height: anhTua.caoO,
                    backgroundImage: `url(${anhTua.url})`,
                    backgroundPosition: (() => {
                      const i = Math.min(anhTua.tong - 1, Math.floor(reMoc.giay / anhTua.giay))
                      const x = (i % anhTua.cot) * anhTua.rongO
                      const y = Math.floor(i / anhTua.cot) * anhTua.caoO
                      return `-${x}px -${y}px`
                    })(),
                  }}
                />
              )}
              <p className="mt-0.5 text-center text-[11px] tabular-nums text-white/85">{mmss(reMoc.giay)}</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 text-white">
          <NutBam onClick={batTat} nhan={dangPhat ? 'Tạm dừng (K)' : 'Phát (K)'}>
            {dangPhat ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </NutBam>

          <NutBam onClick={() => nhay(-10)} nhan="Lùi 10 giây (J)">
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M12 5V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z" />
            </svg>
          </NutBam>
          <NutBam onClick={() => nhay(10)} nhan="Tiến 10 giây (L)">
            <svg viewBox="0 0 24 24" className="h-5 w-5 -scale-x-100 fill-current">
              <path d="M12 5V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z" />
            </svg>
          </NutBam>

          <div className="group/am flex items-center">
            <NutBam onClick={() => datTat((x) => !x)} nhan="Tắt tiếng (M)">
              {tat || amLuong === 0 ? (
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.6 3l2.7-2.7-1.4-1.4L15.2 10.6 12.5 7.9l-1.4 1.4 2.7 2.7-2.7 2.7 1.4 1.4 2.7-2.7 2.7 2.7 1.4-1.4-2.7-2.7z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05A4.47 4.47 0 0 0 16.5 12z" />
                </svg>
              )}
            </NutBam>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={tat ? 0 : amLuong}
              onChange={(e) => {
                const m = Number(e.target.value)
                datAmLuong(m)
                datTat(m === 0)
                ghiCaiDat({ amLuong: m })
              }}
              className="h-1 w-0 cursor-pointer accent-white transition-all group-hover/am:w-20"
              aria-label="Âm lượng"
            />
          </div>

          <span className="ml-1 text-xs tabular-nums text-white/80">
            {mmss(thoiGian)} / {mmss(thoiLuong)}
          </span>

          <div className="ml-auto flex items-center gap-1">
            {/* phụ đề */}
            <div className="relative">
              <NutBam
                onClick={() => datMenu((m) => (m === 'phude' ? '' : 'phude'))}
                nhan="Phụ đề (C)"
                sang={chiSoPhuDe >= 0}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                  <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM7 15v-2h4v2H7zm0-4v-2h6v2H7zm10 4h-4v-2h4v2zm0-4h-2V9h2v2z" />
                </svg>
              </NutBam>
              {menu === 'phude' && (
                <Menu onDong={() => datMenu('')}>
                  <p className="px-3 pb-1 pt-2 text-[11px] uppercase tracking-wide text-white/50">Phụ đề</p>
                  <MucMenu chon={chiSoPhuDe === -1} onClick={() => datChiSoPhuDe(-1)}>
                    Tắt
                  </MucMenu>
                  {dsPhuDe.map((p, i) => (
                    <MucMenu key={i} chon={chiSoPhuDe === i} onClick={() => datChiSoPhuDe(i)}>
                      {p.nhan}
                    </MucMenu>
                  ))}
                  <label className="mx-2 mt-1 block cursor-pointer rounded px-1 py-1.5 text-center text-xs text-white/70 ring-1 ring-white/20 hover:bg-white/10">
                    Chọn file phụ đề...
                    <input
                      type="file"
                      accept=".srt,.vtt"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) themPhuDeTuFile(f)
                      }}
                    />
                  </label>

                  <div className="mt-2 border-t border-white/10 px-3 py-2 text-xs">
                    <div className="mb-1 flex items-center justify-between text-white/60">
                      <span>Độ trễ</span>
                      <span className="tabular-nums">{buGiay > 0 ? '+' : ''}{buGiay.toFixed(2)}s</span>
                    </div>
                    <div className="flex gap-1">
                      <NutNho onClick={() => datBuGiay((b) => +(b - 0.25).toFixed(2))}>-0,25s</NutNho>
                      <NutNho onClick={() => datBuGiay(0)}>0</NutNho>
                      <NutNho onClick={() => datBuGiay((b) => +(b + 0.25).toFixed(2))}>+0,25s</NutNho>
                    </div>

                    <div className="mb-1 mt-3 flex items-center justify-between text-white/60">
                      <span>Cỡ chữ</span>
                      <span className="tabular-nums">{coChu}%</span>
                    </div>
                    <input
                      type="range"
                      min={70}
                      max={200}
                      step={10}
                      value={coChu}
                      onChange={(e) => {
                        const m = Number(e.target.value)
                        datCoChu(m)
                        ghiCaiDat({ coChu: m })
                      }}
                      className="w-full accent-white"
                    />
                    <label className="mt-2 flex cursor-pointer items-center gap-2 text-white/70">
                      <input
                        type="checkbox"
                        checked={nenPhuDe}
                        onChange={(e) => {
                          datNenPhuDe(e.target.checked)
                          ghiCaiDat({ nenPhuDe: e.target.checked })
                        }}
                      />
                      Nền tối sau chữ
                    </label>
                  </div>
                </Menu>
              )}
            </div>

            {/* tiếng — chỉ hiện khi file có nhiều hơn một luồng */}
            {trackAm.length > 1 && (
              <div className="relative">
                <NutBam onClick={() => datMenu((m) => (m === 'tieng' ? '' : 'tieng'))} nhan="Chọn tiếng">
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                    <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zm7 9a7 7 0 0 1-6 6.9V22h-2v-3.1A7 7 0 0 1 5 12h2a5 5 0 0 0 10 0z" />
                  </svg>
                </NutBam>
                {menu === 'tieng' && (
                  <Menu onDong={() => datMenu('')}>
                    <p className="px-3 pb-1 pt-2 text-[11px] uppercase tracking-wide text-white/50">Tiếng</p>
                    {trackAm.map((t) => (
                      <MucMenu key={t.chiSo} chon={amDangChon === t.chiSo} onClick={() => doiTieng(t.chiSo)}>
                        {t.nhan}
                      </MucMenu>
                    ))}
                    <p className="px-3 pb-2 pt-1 text-[11px] leading-relaxed text-white/35">
                      Đổi tiếng phải chuyển mã bằng ffmpeg nên tua sẽ hơi chậm.
                    </p>
                  </Menu>
                )}
              </div>
            )}

            {/* tốc độ */}
            <div className="relative">
              <NutBam onClick={() => datMenu((m) => (m === 'tocdo' ? '' : 'tocdo'))} nhan="Tốc độ ([ ])">
                <span className="px-1 text-xs font-semibold tabular-nums">{tocDo}x</span>
              </NutBam>
              {menu === 'tocdo' && (
                <Menu onDong={() => datMenu('')}>
                  {TOC_DO.map((t) => (
                    <MucMenu
                      key={t}
                      chon={tocDo === t}
                      onClick={() => {
                        datTocDo(t)
                        ghiCaiDat({ tocDo: t })
                        datMenu('')
                      }}
                    >
                      {t === 1 ? 'Bình thường' : t + 'x'}
                    </MucMenu>
                  ))}
                </Menu>
              )}
            </div>

            {/* hẹn giờ tắt */}
            <div className="relative">
              <NutBam
                onClick={() => datMenu((m) => (m === 'hengio' ? '' : 'hengio'))}
                nhan="Hẹn giờ tắt"
                sang={henGio !== null}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                  <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 11h-5v-2h3V6h2v7z" />
                </svg>
              </NutBam>
              {menu === 'hengio' && (
                <Menu onDong={() => datMenu('')}>
                  <p className="px-3 pb-1 pt-2 text-[11px] uppercase tracking-wide text-white/50">Hẹn giờ tắt</p>
                  <MucMenu
                    chon={henGio === null}
                    onClick={() => {
                      datHenGio(null)
                      datMenu('')
                    }}
                  >
                    Tắt hẹn giờ
                  </MucMenu>
                  {[15, 30, 45, 60, 90].map((p) => (
                    <MucMenu
                      key={p}
                      chon={henGio === p}
                      onClick={() => {
                        datHenGio(p)
                        datMenu('')
                      }}
                    >
                      Sau {p} phút
                    </MucMenu>
                  ))}
                  <MucMenu
                    chon={henGio === 'het-tap'}
                    onClick={() => {
                      datHenGio('het-tap')
                      datMenu('')
                    }}
                  >
                    Hết tập này
                  </MucMenu>

                  <div className="mt-1 border-t border-white/10 px-3 py-2 text-[11px] text-white/50">
                    {intro ? (
                      <>
                        <p>
                          Intro: {mmss(intro.bat_dau)}–{mmss(intro.ket_thuc)}
                        </p>
                        <button
                          onClick={() => {
                            datIntro(null)
                            fetch('/api/xem', {
                              method: 'POST',
                              headers: { 'content-type': 'application/json' },
                              body: JSON.stringify({ viec: 'xoa-moc-intro', slug }),
                            }).catch(() => {})
                            datMenu('')
                          }}
                          className="mt-1 underline underline-offset-2 hover:text-white"
                        >
                          Xoá mốc intro
                        </button>
                      </>
                    ) : (
                      <p>
                        Bấm <kbd className="rounded bg-white/15 px-1">I</kbd> ở đầu và cuối intro để đánh dấu — dùng
                        chung cho cả phim.
                      </p>
                    )}
                  </div>
                </Menu>
              )}
            </div>

            <NutBam onClick={doiPip} nhan="Cửa sổ nhỏ (P)">
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                <path d="M19 11h-8v6h8v-6zm4 8V5a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2zm-2 .01H3V4.98h18v14.03z" />
              </svg>
            </NutBam>

            <NutBam onClick={doiToanManHinh} nhan="Toàn màn hình (F)">
              {toanManHinh ? (
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                  <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                </svg>
              )}
            </NutBam>
          </div>
        </div>
      </div>
    </div>
  )
}

function NutBam({
  children,
  onClick,
  nhan,
  sang,
}: {
  children: React.ReactNode
  onClick: () => void
  nhan: string
  sang?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={nhan}
      aria-label={nhan}
      className={`grid h-9 w-9 place-items-center rounded transition hover:bg-white/15 ${
        sang ? 'text-white' : 'text-white/85'
      }`}
    >
      {children}
    </button>
  )
}

function Menu({ children, onDong }: { children: React.ReactNode; onDong: () => void }) {
  useEffect(() => {
    const f = () => onDong()
    const t = setTimeout(() => document.addEventListener('click', f), 0)
    return () => {
      clearTimeout(t)
      document.removeEventListener('click', f)
    }
  }, [onDong])
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute bottom-11 right-0 max-h-80 w-56 overflow-y-auto rounded-lg bg-neutral-900/95 py-1 text-sm shadow-xl ring-1 ring-white/10 backdrop-blur"
    >
      {children}
    </div>
  )
}

function MucMenu({
  children,
  chon,
  onClick,
}: {
  children: React.ReactNode
  chon: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-white/10 ${
        chon ? 'text-white' : 'text-white/70'
      }`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${chon ? 'bg-red-500' : 'bg-transparent'}`} />
      <span className="truncate">{children}</span>
    </button>
  )
}

function NutNho({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 rounded bg-white/10 px-1 py-1 text-[11px] text-white/80 hover:bg-white/20"
    >
      {children}
    </button>
  )
}
