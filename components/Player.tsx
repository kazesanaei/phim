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
 *
 * Bố cục lớp điều khiển theo đúng thứ các trình phát lớn đã dạy người xem:
 * trên cùng là lối về + tên phim, giữa là phát/dừng, dưới cùng là thanh tua và
 * hàng nút. Mọi tuỳ chọn ít dùng gom vào một bảng Cài đặt thay vì bày ra năm
 * nút — trên TV mỗi nút thừa là một chỗ con trỏ ảo phải lách qua.
 */
import Link from 'next/link'
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

/** Một lựa chọn điều hướng trong trình phát: tập, hoặc máy chủ. */
export type LoiDi = { nhan: string; href: string; dang: boolean }

type Props = {
  nguon: NguonPhat
  khoa: string
  /** Tên đầy đủ kèm tập — ghi vào lịch sử xem. */
  tieuDe: string
  /** Hai dòng trên thanh trên cùng; thiếu thì dùng tieuDe. */
  tenPhim?: string
  nhanTap?: string
  phuDeThem?: PhuDeMuc[]
  /** Poster DỌC — ghi vào lịch sử để thẻ "Tiếp tục xem" khung 2:3 ở PC. */
  poster?: string
  /** Ảnh NGANG — khung chờ của video và thẻ 16:9 ở chế độ TV. */
  anhNen?: string
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
  /** Danh sách tập, ĐÃ sắp — bảng chọn tập ngay trong trình phát. */
  dsTap?: LoiDi[]
  /** Các máy chủ phát của tập này — đổi nhanh khi một bên chết. */
  mayChu?: LoiDi[]
  /** Nút quay lại về đâu khi không có lịch sử để lùi (mở thẳng link). */
  veTrang?: string
}

const TOC_DO = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
const KHOA_CAI_DAT = 'phim:cai-dat-player'

/**
 * Trần âm lượng khi bật "Tăng âm lượng".
 *
 * Loa laptop mỏng phát lời thoại rất nhỏ ngay cả ở 100%. Trình duyệt chặn
 * `video.volume` ở 1.0, nên phần vượt 100% đi qua Web Audio: một nút GainNode
 * nhân biên độ, theo sau là DynamicsCompressor làm bộ giới hạn đỉnh — không có
 * nó thì ở 200–300% các đoạn nổ, nhạc to sẽ vỡ tiếng rè rè trên loa nhỏ.
 */
const TRAN_TANG_AM = 3
/**
 * Phần bộ giới hạn tự bù thêm khi tiếng đi qua nó (makeup gain, không tắt được).
 * Đo bằng tín hiệu thật trên Chromium/Edge với đúng thông số bên dưới: mức đặt
 * 1,8 ra 2,07 lần, mức 3 ra 3,41 lần — cùng ≈ 1,15. Chia GainNode cho số này để
 * "180%" ra đúng gần 1,8 lần, và kéo qua mốc 100% không bị vọt lên 20%.
 */
const BU_CHAN = 1.15
/** Kéo thanh âm lượng tới gần 100% thì bám vào đúng 100% cho khỏi lố tay. */
const VUNG_BAM = 0.06

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

/** Bảng lớn hơn ngưỡng này thì chia khoảng, giống lưới tập ngoài trang. */
const NGUONG_CHIA_TAP = 60
const MOI_KHOANG_TAP = 100

function mmss(giay: number): string {
  if (!Number.isFinite(giay) || giay < 0) return '0:00'
  const g = Math.floor(giay)
  const h = Math.floor(g / 3600)
  const p = Math.floor((g % 3600) / 60)
  const s = g % 60
  const hai = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${hai(p)}:${hai(s)}` : `${p}:${hai(s)}`
}

type CaiDat = { amLuong: number; tocDo: number; coChu: number; nenPhuDe: boolean; tangAm: boolean }
const MAC_DINH: CaiDat = { amLuong: 1, tocDo: 1, coChu: 100, nenPhuDe: true, tangAm: false }

function docCaiDat(): CaiDat {
  if (typeof window === 'undefined') return MAC_DINH
  try {
    const l = JSON.parse(localStorage.getItem(KHOA_CAI_DAT) || '{}')
    const tangAm = l.tangAm === true
    // Ép kiểu tường minh: coChu/nenPhuDe được nội suy vào <style> inline, không
    // để giá trị lạ trong localStorage lọt vào chuỗi CSS.
    const am = Number(l.amLuong)
    return {
      amLuong: Math.min(tangAm ? TRAN_TANG_AM : 1, Math.max(0, Number.isFinite(am) ? am : MAC_DINH.amLuong)),
      tocDo: TOC_DO.includes(Number(l.tocDo)) ? Number(l.tocDo) : MAC_DINH.tocDo,
      coChu: Math.min(300, Math.max(50, Number(l.coChu) || MAC_DINH.coChu)),
      nenPhuDe: typeof l.nenPhuDe === 'boolean' ? l.nenPhuDe : MAC_DINH.nenPhuDe,
      tangAm,
    }
  } catch {
    return MAC_DINH
  }
}

type Bang =
  | 'cai-dat'
  | 'phu-de'
  | 'kieu-phu-de'
  | 'toc-do'
  | 'tieng'
  | 'hen-gio'
  | 'intro'
  | 'may-chu'
  | 'phim-tat'
  | 'tap'

type DoThiAm = { ctx: AudioContext; gain: GainNode; chan: DynamicsCompressorNode; quaChan: boolean }

/**
 * Chỉ cho tiếng đi qua bộ giới hạn khi ĐANG vượt 100%.
 *
 * DynamicsCompressor của trình duyệt tự bù thêm âm lượng (makeup gain) và không
 * tắt được. Đo bằng tín hiệu thật: để nó luôn nằm trên đường thì ngay ở mức 100%
 * tiếng đã to hơn gốc ~20%, và mức 180% ra 2,07 lần. Dưới 100% đi vòng qua thì
 * 100% đúng bằng âm lượng gốc; vượt 100% mới cần nó để chặn vỡ tiếng.
 */
function noiDuong(dt: DoThiAm, quaChan: boolean) {
  if (dt.quaChan === quaChan) return
  dt.gain.disconnect()
  dt.gain.connect(quaChan ? dt.chan : dt.ctx.destination)
  dt.quaChan = quaChan
}

export default function Player({
  nguon,
  khoa,
  tieuDe,
  tenPhim,
  nhanTap,
  phuDeThem = [],
  poster,
  anhNen,
  slug,
  tap,
  nguonTen = 'vsmov',
  tapSau = null,
  mocIntro = null,
  trackAm = [],
  tepLocal,
  tapId,
  dsTap = [],
  mayChu = [],
  veTrang,
}: Props) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const tuaRef = useRef<HTMLDivElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const anRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const luuRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const thuLaiRef = useRef(0)
  // onTimeUpdate bắn ~4 lần/giây; không có chốt này là gọi prefetch hàng trăm lần.
  const daTaiTruocRef = useRef(false)
  const doThiRef = useRef<DoThiAm | null>(null)
  const osdHenRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nhayHenRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [dangTai, datDangTai] = useState(true)
  const [loi, datLoi] = useState<string | null>(null)
  const [dangPhat, datDangPhat] = useState(false)
  const [daPhatLanNao, datDaPhatLanNao] = useState(false)
  const [thoiGian, datThoiGian] = useState(0)
  const [thoiLuong, datThoiLuong] = useState(0)
  const [dem, datDem] = useState(0)
  const [amLuong, datAmLuong] = useState(MAC_DINH.amLuong)
  const [tangAm, datTangAm] = useState(MAC_DINH.tangAm)
  const [coWebAudio, datCoWebAudio] = useState(false)
  const [coPip, datCoPip] = useState(false)
  const [tat, datTat] = useState(false)
  const [tocDo, datTocDo] = useState(1)
  const [toanManHinh, datToanManHinh] = useState(false)
  const [hienDk, datHienDk] = useState(true)
  const [bang, datBang] = useState<Bang | null>(null)
  const [dsPhuDe, datDsPhuDe] = useState<PhuDeMuc[]>([])
  const [chiSoPhuDe, datChiSoPhuDe] = useState(-1)
  /** Phụ đề tắt bằng nút CC thì nhớ cái đang chọn để bật lại đúng cái đó. */
  const [phuDeTruoc, datPhuDeTruoc] = useState(0)
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
  const [hienConLai, datHienConLai] = useState(false)

  // Phản hồi tức thì khi đổi bằng phím: âm lượng, tốc độ, tua
  const [osd, datOsd] = useState<{ chu: string; k: number } | null>(null)
  const [nhayBong, datNhayBong] = useState<{ huong: -1 | 1; giay: number; k: number } | null>(null)

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

  // Xem trước khi tua, và kéo tua
  const [reMoc, datReMoc] = useState<{ giay: number; trai: number; rong: number } | null>(null)
  const [keoTua, datKeoTua] = useState<number | null>(null)
  const [anhTua, datAnhTua] = useState<AnhTua | null>(null)

  // Bảng chọn tập: đang mở khoảng nào
  const [khoangTap, datKhoangTap] = useState<number | null>(null)

  // ---- nạp cài đặt đã nhớ ------------------------------------------------
  useEffect(() => {
    const c = docCaiDat()
    datAmLuong(c.amLuong)
    datTocDo(c.tocDo)
    datCoChu(c.coChu)
    datNenPhuDe(c.nenPhuDe)
    datTangAm(c.tangAm)
    const w = window as unknown as { AudioContext?: unknown; webkitAudioContext?: unknown }
    datCoWebAudio(!!(w.AudioContext || w.webkitAudioContext))
    datCoPip(!!document.pictureInPictureEnabled)
  }, [])

  const ghiCaiDat = useCallback((moi: Partial<CaiDat>) => {
    try {
      localStorage.setItem(KHOA_CAI_DAT, JSON.stringify({ ...docCaiDat(), ...moi }))
    } catch {
      // trình duyệt chặn localStorage thì thôi, không phải lỗi chặn đường
    }
  }, [])

  const baoOsd = useCallback((chu: string) => {
    datOsd({ chu, k: Date.now() })
    if (osdHenRef.current) clearTimeout(osdHenRef.current)
    osdHenRef.current = setTimeout(() => datOsd(null), 1100)
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
        else datLoi('Trình duyệt này không phát được luồng HLS.')
        return
      }
      const hls = new HlsCtor({ enableWorker: true, lowLatencyMode: false })
      hlsRef.current = hls
      hls.loadSource(src)
      hls.attachMedia(videoRef.current)
      hls.on(HlsCtor.Events.ERROR, (_e, d) => {
        if (!d.fatal) return
        if (thuLaiRef.current >= 3) {
          datLoi('Máy chủ này không phát được tập này.')
          datDangTai(false)
          return
        }
        thuLaiRef.current += 1
        if (d.type === HlsCtor.ErrorTypes.NETWORK_ERROR) hls.startLoad()
        else if (d.type === HlsCtor.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError()
        else {
          datLoi('Máy chủ này không phát được tập này.')
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

  // ---- âm lượng và tăng âm -----------------------------------------------
  /**
   * Dựng đồ thị Web Audio cho phần vượt 100%. CHỈ gọi trong một thao tác của
   * người xem (bấm phát, kéo thanh, bấm phím): AudioContext tạo ngoài thao tác
   * thì nằm ở trạng thái 'suspended', mà video đã nối vào đồ thị thì toàn bộ
   * tiếng chảy qua nó — tức là CÂM cho tới khi có ai bấm gì đó.
   *
   * createMediaElementSource chỉ gọi được MỘT lần cho mỗi thẻ video, nên giữ
   * lại trong ref; Player gắn lại theo từng tập (key) thì đồ thị cũng dựng lại.
   * Nguồn phát luôn đi qua /api/tep cùng gốc, nên không dính lỗi CORS làm câm.
   */
  const damBaoDoThi = useCallback((): DoThiAm | null => {
    if (doThiRef.current) return doThiRef.current
    const v = videoRef.current
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
    const AC = w.AudioContext || w.webkitAudioContext
    if (!v || !AC) return null
    try {
      const ctx = new AC()
      const vao = ctx.createMediaElementSource(v)
      const gain = ctx.createGain()
      // Bộ giới hạn đỉnh: giữ đỉnh dưới 0 dBFS khi đã nhân biên độ lên 2–3 lần,
      // nên lời thoại nhỏ được kéo lên mà tiếng nổ không bị vỡ.
      const chan = ctx.createDynamicsCompressor()
      chan.threshold.value = -3
      chan.knee.value = 4
      chan.ratio.value = 20
      chan.attack.value = 0.003
      chan.release.value = 0.25
      vao.connect(gain)
      chan.connect(ctx.destination)
      // Mặc định đi thẳng ra loa; noiDuong() chuyển qua bộ giới hạn khi vượt 100%
      gain.connect(ctx.destination)
      doThiRef.current = { ctx, gain, chan, quaChan: false }
      return doThiRef.current
    } catch {
      return null
    }
  }, [])

  // Đồng bộ âm lượng xuống video và đồ thị (nếu đã có)
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.muted = tat
    const dt = doThiRef.current
    if (amLuong <= 1) {
      v.volume = amLuong
      if (dt) {
        dt.gain.gain.value = 1
        noiDuong(dt, false)
      }
      return
    }
    // Vượt 100%: video mở hết cỡ, phần còn lại do GainNode nhân lên.
    // Chưa có đồ thị (chưa có thao tác nào) thì tạm đứng ở 100% — lần bấm phát
    // đầu tiên sẽ dựng đồ thị và đẩy lên đúng mức đã nhớ.
    v.volume = 1
    if (dt) {
      dt.gain.gain.value = amLuong / BU_CHAN
      noiDuong(dt, true)
      if (dt.ctx.state === 'suspended') dt.ctx.resume().catch(() => {})
    }
  }, [amLuong, tat])

  useEffect(
    () => () => {
      doThiRef.current?.ctx.close().catch(() => {})
      doThiRef.current = null
    },
    [],
  )

  /** Đặt âm lượng từ một thao tác của người xem (thanh kéo, phím). */
  const datMucAm = useCallback(
    (m: number, phanHoi: boolean) => {
      const tran = tangAm && coWebAudio ? TRAN_TANG_AM : 1
      let x = Math.min(tran, Math.max(0, Math.round(m * 100) / 100))
      if (tran > 1 && Math.abs(x - 1) < VUNG_BAM) x = 1
      if (x > 1) {
        const dt = damBaoDoThi()
        if (dt && dt.ctx.state === 'suspended') dt.ctx.resume().catch(() => {})
      }
      datAmLuong(x)
      datTat(x === 0)
      ghiCaiDat({ amLuong: x })
      if (phanHoi) baoOsd(`Âm lượng ${Math.round(x * 100)}%`)
    },
    [tangAm, coWebAudio, damBaoDoThi, ghiCaiDat, baoOsd],
  )

  const doiTangAm = useCallback(
    (bat: boolean) => {
      datTangAm(bat)
      ghiCaiDat({ tangAm: bat })
      if (!bat) {
        // Tắt tăng âm thì kéo về trần cũ, không để video đột ngột câm hay vọt.
        if (amLuong > 1) {
          datAmLuong(1)
          ghiCaiDat({ tangAm: false, amLuong: 1 })
        }
        baoOsd('Đã tắt tăng âm lượng')
      } else {
        // Dựng đồ thị ngay trong cú bấm này — đang có thao tác của người xem.
        damBaoDoThi()?.ctx.resume().catch(() => {})
        baoOsd('Kéo thanh âm lượng qua 100% để to hơn')
      }
    },
    [amLuong, ghiCaiDat, baoOsd, damBaoDoThi],
  )

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
    let lan = 0

    async function hoi() {
      const r = await fetch('/api/anh-tua?tap=' + tapId)
      if (!r.ok) return
      const j = await r.json()
      if (huy) return
      if (j.anh) {
        datAnhTua(j.anh)
        return
      }
      if (!j.dangLam && lan === 0) {
        // Chưa có thì nhờ sinh, rồi hỏi lại
        await fetch('/api/anh-tua', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ tap: tapId }),
        })
      }
      if (++lan < 20 && !huy) setTimeout(hoi, 5000)
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
        anhNgang: anhNen || null,
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
    [khoa, slug, tap, tieuDe, poster, anhNen, nguonTen],
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
    let soLan = 0
    try {
      soLan = Number(sessionStorage.getItem(KHOA_TU_SANG) || '0') + 1
      sessionStorage.setItem(KHOA_TU_SANG, String(soLan))
    } catch {
      // trình duyệt chặn sessionStorage thì bỏ qua, cứ chạy tiếp
    }
    if (soLan >= NGUONG_HOI) {
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
      baoNhac(`Đã đánh dấu đầu intro ở ${mmss(v.currentTime)}. Tới chỗ intro hết thì đánh dấu lần nữa.`)
      return
    }
    const batDau = Math.min(dangDanhDau, v.currentTime)
    const ketThuc = Math.max(dangDanhDau, v.currentTime)
    datDangDanhDau(null)
    if (ketThuc - batDau < 3) {
      baoNhac('Đoạn intro ngắn hơn 3 giây, chưa lưu. Đánh dấu lại từ đầu.')
      return
    }
    datIntro({ bat_dau: batDau, ket_thuc: ketThuc })
    fetch('/api/xem', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ viec: 'moc-intro', slug, batDau, ketThuc }),
    }).catch(() => {})
    baoNhac(`Đã lưu intro ${mmss(batDau)}–${mmss(ketThuc)} cho mọi tập của phim này.`)
  }, [dangDanhDau, slug, baoNhac])

  const xoaIntro = useCallback(() => {
    datIntro(null)
    fetch('/api/xem', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ viec: 'xoa-moc-intro', slug }),
    }).catch(() => {})
  }, [slug])

  const doiTieng = useCallback(
    (chiSo: number) => {
      if (!tepLocal || chiSo === amDangChon) return
      const v = videoRef.current
      const moc = v?.currentTime ?? 0
      datAmDangChon(chiSo)
      datBang(null)
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
    // Bấm liền tay thì cộng dồn: "+10", "+20", "+30 giây" như YouTube
    const huong: -1 | 1 = giay < 0 ? -1 : 1
    datNhayBong((c) => ({
      huong,
      giay: c && c.huong === huong ? c.giay + Math.abs(giay) : Math.abs(giay),
      k: Date.now(),
    }))
    if (nhayHenRef.current) clearTimeout(nhayHenRef.current)
    nhayHenRef.current = setTimeout(() => datNhayBong(null), 700)
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

  const doiPhuDe = useCallback(() => {
    if (!dsPhuDe.length) {
      datBang('phu-de')
      return
    }
    if (chiSoPhuDe >= 0) {
      datPhuDeTruoc(chiSoPhuDe)
      datChiSoPhuDe(-1)
      baoOsd('Đã tắt phụ đề')
    } else {
      const i = Math.min(phuDeTruoc, dsPhuDe.length - 1)
      datChiSoPhuDe(i)
      baoOsd('Phụ đề: ' + dsPhuDe[i].nhan)
    }
  }, [dsPhuDe, chiSoPhuDe, phuDeTruoc, baoOsd])

  const datToc = useCallback(
    (t: number, phanHoi: boolean) => {
      datTocDo(t)
      ghiCaiDat({ tocDo: t })
      if (phanHoi) baoOsd(t === 1 ? 'Tốc độ bình thường' : `Tốc độ ${t}×`)
    },
    [ghiCaiDat, baoOsd],
  )

  const quayLai = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    // Mở thẳng link (không có trang trước trong app) thì về trang phim
    if (window.history.length > 1) router.back()
    else router.push(veTrang || '/')
  }, [router, veTrang])

  useEffect(() => {
    const f = () => datToanManHinh(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', f)
    return () => document.removeEventListener('fullscreenchange', f)
  }, [])

  // ---- phím tắt ----------------------------------------------------------
  useEffect(() => {
    function xuLy(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
        // Thanh trượt vẫn để trình duyệt tự lo mũi tên của nó
        return
      }
      const v = videoRef.current
      if (!v) return
      let chan = true
      conNguoi()
      switch (e.key.toLowerCase()) {
        case 'escape':
          if (bang) datBang(null)
          else chan = false
          break
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
          if (t && t.tagName === 'BUTTON' && e.key === ' ') return
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
        case 'arrowup': {
          const tran = tangAm && coWebAudio ? TRAN_TANG_AM : 1
          if (amLuong >= 1 && tran === 1) {
            // Chạm trần mà chưa bật tăng âm: chỉ chỗ bật, thay vì im lặng
            baoOsd('Âm lượng 100% · bật "Tăng âm lượng" trong Cài đặt để to hơn')
          } else datMucAm(amLuong + 0.1, true)
          break
        }
        case 'arrowdown':
          datMucAm(amLuong - 0.1, true)
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
          datTat(!tat)
          baoOsd(tat ? `Âm lượng ${Math.round(amLuong * 100)}%` : 'Đã tắt tiếng')
          break
        case 'p':
          doiPip()
          break
        case 'c':
          doiPhuDe()
          break
        case 'n':
          if (tapSau) router.push(tapSau.href)
          break
        case '[': {
          const m = TOC_DO[Math.max(0, TOC_DO.indexOf(tocDo) - 1)] ?? tocDo
          datToc(m, true)
          break
        }
        case ']': {
          const m = TOC_DO[Math.min(TOC_DO.length - 1, TOC_DO.indexOf(tocDo) + 1)] ?? tocDo
          datToc(m, true)
          break
        }
        case '?':
          datBang((b) => (b === 'phim-tat' ? null : 'phim-tat'))
          break
        default:
          if (/^[0-9]$/.test(e.key) && v.duration) v.currentTime = (v.duration * Number(e.key)) / 10
          else chan = false
      }
      if (chan) e.preventDefault()
    }
    window.addEventListener('keydown', xuLy)
    return () => window.removeEventListener('keydown', xuLy)
  }, [
    batTat,
    nhay,
    doiToanManHinh,
    doiPip,
    doiPhuDe,
    tapSau,
    router,
    danhDauIntro,
    boQuaIntro,
    intro,
    conNguoi,
    bang,
    amLuong,
    tangAm,
    coWebAudio,
    datMucAm,
    baoOsd,
    tocDo,
    datToc,
    tat,
  ])

  // ---- tự ẩn thanh điều khiển -------------------------------------------
  const danhThuc = useCallback(() => {
    datHienDk(true)
    if (anRef.current) clearTimeout(anRef.current)
    anRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) datHienDk(false)
    }, 3000)
  }, [])

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

  // ---- thanh tua: rê, bấm, kéo ------------------------------------------
  const viTriTua = useCallback((clientX: number) => {
    const e = tuaRef.current
    if (!e) return null
    const r = e.getBoundingClientRect()
    return { ti: Math.min(1, Math.max(0, (clientX - r.left) / r.width)), rong: r.width }
  }, [])

  const phanTramDem = useMemo(() => (thoiLuong ? Math.min(100, (dem / thoiLuong) * 100) : 0), [dem, thoiLuong])
  const tiChay = keoTua ?? (thoiLuong ? thoiGian / thoiLuong : 0)

  /**
   * Hai luật: bản thường và bản TV (to hơn 1,65 lần cho khoảng cách 2,5 m).
   * Bản TV PHẢI sinh ở đây từ chính con số người xem chọn. Trước đây nó là một
   * luật cứng trong globals.css, mạnh hơn luật này, nên trên TV thanh chỉnh cỡ
   * chữ phụ đề không có tác dụng gì.
   */
  const cssCue = useMemo(() => {
    const kieu = `color:#fff;background:${nenPhuDe ? 'rgba(0,0,0,.72)' : 'transparent'};text-shadow:${
      nenPhuDe ? 'none' : '0 2px 4px rgba(0,0,0,.9),0 0 2px rgba(0,0,0,.9)'
    }`
    return (
      `#video-chinh::cue{font-size:${coChu}%;${kieu}}` +
      `[data-che-do='tv'] #video-chinh::cue{font-size:${Math.round(coChu * 1.65)}%}`
    )
  }, [coChu, nenPhuDe])

  // Khoảng tập trong bảng chọn tập
  const khoangCuaTap = useMemo(() => {
    if (dsTap.length <= NGUONG_CHIA_TAP) return null
    const ra: { nhan: string; tu: number; den: number }[] = []
    for (let i = 0; i < dsTap.length; i += MOI_KHOANG_TAP) {
      const den = Math.min(i + MOI_KHOANG_TAP, dsTap.length)
      ra.push({ nhan: `${dsTap[i].nhan} – ${dsTap[den - 1].nhan}`, tu: i, den })
    }
    return ra
  }, [dsTap])
  const khoangDangXem = useMemo(() => {
    if (!khoangCuaTap) return 0
    const i = dsTap.findIndex((t) => t.dang)
    return Math.max(0, khoangCuaTap.findIndex((k) => i >= k.tu && i < k.den))
  }, [dsTap, khoangCuaTap])
  const khoangMo = khoangTap ?? khoangDangXem
  const tapHien = khoangCuaTap ? dsTap.slice(khoangCuaTap[khoangMo].tu, khoangCuaTap[khoangMo].den) : dsTap

  const tranAm = tangAm && coWebAudio ? TRAN_TANG_AM : 1
  const amHien = tat ? 0 : amLuong
  const dangTangAm = !tat && amLuong > 1
  const hien = hienDk || !dangPhat || !!bang || keoTua !== null
  const coLop = demNguoc !== null || hoiConXem || !!loi
  const tenTren = tenPhim || tieuDe
  const mayChuDang = mayChu.find((m) => m.dang)
  const mayChuKhac = mayChu.find((m) => !m.dang)

  const nhanPhuDe = chiSoPhuDe >= 0 ? dsPhuDe[chiSoPhuDe]?.nhan || 'Bật' : 'Tắt'
  const nhanHenGio =
    henGio === null ? 'Tắt' : henGio === 'het-tap' ? 'Hết tập này' : `Còn ${mmss(conLai)}`

  return (
    <div
      ref={boxRef}
      className={`trinh-phat group/tp relative aspect-video w-full select-none overflow-hidden bg-black text-white md:rounded-xl ${
        hien ? '' : 'cursor-none'
      }`}
      data-hien={hien ? '1' : undefined}
      onMouseMove={danhThuc}
      onMouseLeave={() => videoRef.current && !videoRef.current.paused && !bang && datHienDk(false)}
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
        poster={anhNen || poster}
        className="h-full w-full object-contain"
        playsInline
        onClick={() => {
          if (bang) datBang(null)
          else batTat()
        }}
        onDoubleClick={doiToanManHinh}
        onLoadedMetadata={khiCoMetadata}
        onPlay={() => {
          datDangPhat(true)
          datDaPhatLanNao(true)
          danhThuc()
          // Cú bấm phát là thao tác của người xem: lúc dựng đồ thị tăng âm an toàn
          if (amLuong > 1 && tangAm) {
            const dt = damBaoDoThi()
            if (dt) {
              dt.gain.gain.value = amLuong / BU_CHAN
              noiDuong(dt, true)
              if (dt.ctx.state === 'suspended') dt.ctx.resume().catch(() => {})
            }
          }
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

      {/* Lớp tối trên và dưới: chữ và nút luôn đọc được dù cảnh phim sáng */}
      <div
        aria-hidden
        className={`tp-man-tren pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/75 to-transparent transition-opacity duration-300 ${
          hien ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        aria-hidden
        className={`tp-man-duoi pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 ${
          hien ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* ---- thanh trên: lối về + tên phim ---- */}
      <div
        className={`tp-tren absolute inset-x-0 top-0 flex items-center gap-2 px-2 pt-2 transition-opacity duration-300 md:px-3 md:pt-3 ${
          hien ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <NutDk nhan="Quay lại" onClick={quayLai}>
          <Bieu ten="lui" />
        </NutDk>
        <div className="min-w-0 flex-1">
          <p className="tp-ten truncate text-[15px] font-semibold leading-tight tracking-tight md:text-base">{tenTren}</p>
          {nhanTap && <p className="tp-tap truncate text-xs text-white/65">{nhanTap}</p>}
        </div>
        {typeof henGio === 'number' && conLai > 0 && (
          <span className="tp-nhan shrink-0 rounded-full bg-black/55 px-3 py-1 text-xs tabular-nums text-white/85 backdrop-blur">
            Tắt sau {mmss(conLai)}
          </span>
        )}
        {henGio === 'het-tap' && (
          <span className="tp-nhan shrink-0 rounded-full bg-black/55 px-3 py-1 text-xs text-white/85 backdrop-blur">
            Tắt khi hết tập
          </span>
        )}
      </div>

      {/* ---- giữa: đang tải / nút phát to ---- */}
      {dangTai && !loi && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="tp-quay h-14 w-14 animate-spin rounded-full border-[3px] border-white/15 border-t-white" />
        </div>
      )}

      {!dangPhat && !dangTai && !coLop && (
        <button
          type="button"
          onClick={batTat}
          aria-label={daPhatLanNao ? 'Phát tiếp' : 'Phát'}
          className="tp-giua absolute left-1/2 top-1/2 grid h-[4.5rem] w-[4.5rem] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/50 ring-1 ring-white/25 backdrop-blur-sm transition duration-200 hover:scale-105 hover:bg-[var(--color-nhan)] hover:ring-transparent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white"
        >
          <Bieu ten="phat" className="tp-icon-giua ml-1 h-9 w-9" />
        </button>
      )}

      {/* ---- phản hồi tua: bong bóng hai bên ---- */}
      {nhayBong && (
        <div
          key={nhayBong.k}
          aria-hidden
          className={`tp-nhay pointer-events-none absolute top-1/2 grid h-24 w-24 -translate-y-1/2 place-items-center rounded-full bg-white/12 backdrop-blur-sm ${
            nhayBong.huong < 0 ? 'left-[10%]' : 'right-[10%]'
          }`}
        >
          <div className="text-center">
            <BieuNhay toi={nhayBong.huong > 0} className="mx-auto h-7 w-7" />
            <p className="mt-0.5 text-xs font-semibold tabular-nums">
              {nhayBong.huong < 0 ? '−' : '+'}
              {nhayBong.giay} giây
            </p>
          </div>
        </div>
      )}

      {/* ---- phản hồi âm lượng / tốc độ ---- */}
      {osd && (
        <div
          key={osd.k}
          role="status"
          className="tp-osd pointer-events-none absolute left-1/2 top-[16%] max-w-[80%] -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 text-center text-sm font-semibold tabular-nums backdrop-blur"
        >
          {osd.chu}
        </div>
      )}

      {/* ---- lỗi phát ---- */}
      {loi && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/80 px-6 text-center">
          <div className="tp-the max-w-sm">
            <Bieu ten="loi" className="mx-auto h-10 w-10 text-white/60" />
            <p className="mt-3 text-base font-semibold">{loi}</p>
            <p className="mt-1 text-sm text-white/60">
              {mayChuKhac ? 'Thử lại, hoặc đổi sang máy chủ khác.' : 'Thử tải lại nguồn phát.'}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  datLoi(null)
                  datDangTai(true)
                  if (src) datSrc(src + '&t=' + Date.now())
                }}
                className="tp-nut-chu rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/85"
              >
                Thử lại
              </button>
              {mayChuKhac && (
                <Link
                  href={mayChuKhac.href}
                  className="tp-nut-chu rounded-md bg-white/12 px-5 py-2.5 text-sm font-semibold transition hover:bg-white/20"
                >
                  Đổi sang {mayChuKhac.nhan}
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {keoVao && (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center border-2 border-dashed border-white/70 bg-black/60">
          <p className="text-sm font-medium">Thả tệp .srt hoặc .vtt vào đây để gắn phụ đề</p>
        </div>
      )}

      {tiepTuc !== null && (
        <div className="tp-tiep-tuc absolute left-4 top-16 flex items-center gap-3 rounded-full bg-black/70 py-1.5 pl-4 pr-1.5 text-xs backdrop-blur md:top-20">
          <span>Đã tiếp tục từ {mmss(tiepTuc)}</span>
          <button
            type="button"
            onClick={() => {
              if (videoRef.current) videoRef.current.currentTime = 0
              datTiepTuc(null)
            }}
            className="rounded-full bg-white/15 px-3 py-1 font-semibold transition hover:bg-white/25"
          >
            Xem từ đầu
          </button>
        </div>
      )}

      {nhac && (
        <div
          role="status"
          className="tp-nhac absolute left-1/2 top-16 max-w-[85%] -translate-x-1/2 rounded-lg bg-black/80 px-4 py-2 text-center text-xs text-white/90 shadow-lg backdrop-blur md:top-20"
        >
          {nhac}
        </div>
      )}

      {/* ---- nút nổi góc phải: bỏ qua intro / tập kế ---- */}
      {trongIntro && !coLop && (
        <button
          type="button"
          onClick={boQuaIntro}
          className="tp-noi absolute bottom-24 right-4 flex items-center gap-2 rounded-md border border-white/70 bg-black/55 px-5 py-2.5 text-sm font-semibold backdrop-blur transition hover:border-white hover:bg-white hover:text-black md:right-6"
        >
          <Bieu ten="tua-nhanh" className="h-5 w-5" />
          Bỏ qua intro
        </button>
      )}

      {hienTapSau && tapSau && demNguoc === null && !trongIntro && !coLop && (
        <button
          type="button"
          onClick={() => router.push(tapSau.href)}
          className="tp-noi absolute bottom-24 right-4 flex items-center gap-2 rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-black shadow-lg transition hover:bg-white/85 md:right-6"
        >
          <Bieu ten="phat" className="h-5 w-5" />
          {tapSau.nhan}
        </button>
      )}

      {/* ---- hết tập: đếm ngược sang tập kế ----
          Vùng bấm to vì trên TV phải trỏ trúng bằng con trỏ ảo. */}
      {demNguoc !== null && tapSau && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/75 backdrop-blur-sm">
          <div className="tp-the mx-4 w-full max-w-sm rounded-2xl bg-[#141419]/95 p-6 text-center ring-1 ring-white/10">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/45">Tập tiếp theo</p>
            <p className="mt-1 truncate text-lg font-semibold">{tapSau.nhan}</p>

            <VongDem con={demNguoc} tong={DEM_NGUOC_GIAY} />

            <div className="mt-5 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => router.push(tapSau.href)}
                className="tp-nut-chu rounded-md bg-white px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-white/85"
              >
                Xem ngay
              </button>
              <button
                type="button"
                onClick={() => datDemNguoc(null)}
                className="tp-nut-chu rounded-md bg-white/10 px-6 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/20"
              >
                Huỷ
              </button>
            </div>
          </div>
        </div>
      )}

      {hoiConXem && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/85 px-6 text-center">
          <div className="tp-the">
            <p className="text-xl font-semibold">Bạn còn đang xem không?</p>
            <p className="mt-1 text-sm text-white/60">Đã tự chuyển {NGUONG_HOI} tập liên tiếp mà không ai chạm vào.</p>
            <div className="mt-5 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  conNguoi()
                  datHoiConXem(false)
                  if (tapSau) router.push(tapSau.href)
                }}
                className="tp-nut-chu rounded-md bg-white px-6 py-2.5 text-sm font-semibold text-black hover:bg-white/85"
              >
                Xem tiếp
              </button>
              <button
                type="button"
                onClick={() => {
                  conNguoi()
                  datHoiConXem(false)
                }}
                className="tp-nut-chu rounded-md bg-white/15 px-6 py-2.5 text-sm font-semibold hover:bg-white/25"
              >
                Dừng ở đây
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- thanh dưới: thanh tua + hàng nút ---- */}
      <div
        className={`tp-duoi absolute inset-x-0 bottom-0 px-2.5 pb-1.5 transition-opacity duration-300 md:px-4 md:pb-2.5 ${
          hien ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <div
          ref={tuaRef}
          role="slider"
          tabIndex={0}
          aria-label="Vị trí phát"
          aria-valuemin={0}
          aria-valuemax={Math.round(thoiLuong)}
          aria-valuenow={Math.round(tiChay * thoiLuong)}
          aria-valuetext={`${mmss(tiChay * thoiLuong)} trên ${mmss(thoiLuong)}`}
          className="tp-tua group/tua relative flex h-5 cursor-pointer touch-none items-center focus-visible:outline-none"
          onPointerDown={(e) => {
            const p = viTriTua(e.clientX)
            if (!p || !thoiLuong) return
            e.currentTarget.setPointerCapture(e.pointerId)
            datKeoTua(p.ti)
            datReMoc({ giay: p.ti * thoiLuong, trai: p.ti * p.rong, rong: p.rong })
          }}
          onPointerMove={(e) => {
            const p = viTriTua(e.clientX)
            if (!p || !thoiLuong) return
            datReMoc({ giay: p.ti * thoiLuong, trai: p.ti * p.rong, rong: p.rong })
            if (keoTua !== null) datKeoTua(p.ti)
          }}
          onPointerUp={(e) => {
            if (keoTua === null) return
            const p = viTriTua(e.clientX)
            const v = videoRef.current
            if (v && p && v.duration) v.currentTime = p.ti * v.duration
            datKeoTua(null)
          }}
          onPointerLeave={() => {
            if (keoTua === null) datReMoc(null)
          }}
        >
          <div className="tp-ray relative h-1 w-full overflow-hidden rounded-full bg-white/25 transition-[height] duration-150 group-hover/tua:h-1.5">
            <div className="absolute inset-y-0 left-0 bg-white/35" style={{ width: phanTramDem + '%' }} />
            {/* Đoạn intro hiện thành một vệt: nhìn là biết bỏ qua được tới đâu */}
            {intro && thoiLuong > 0 && (
              <div
                title="Intro"
                className="absolute inset-y-0 bg-amber-300/45"
                style={{
                  left: (intro.bat_dau / thoiLuong) * 100 + '%',
                  width: ((intro.ket_thuc - intro.bat_dau) / thoiLuong) * 100 + '%',
                }}
              />
            )}
            <div className="absolute inset-y-0 left-0 bg-[var(--color-nhan)]" style={{ width: tiChay * 100 + '%' }} />
          </div>
          <div
            aria-hidden
            className={`tp-num pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-nhan)] shadow-[0_0_0_3px_rgba(229,37,31,.25)] transition-transform duration-150 ${
              keoTua !== null ? 'scale-125' : 'scale-0 group-hover/tua:scale-100'
            }`}
            style={{ left: tiChay * 100 + '%' }}
          />

          {/* Xem trước khi tua: cắt đúng ô trong ảnh lưới bằng background-position.
              Kẹp trong khung, không thì ở hai đầu thanh nó tràn ra ngoài video. */}
          {reMoc &&
            (() => {
              const rongHop = anhTua ? anhTua.rongO + 8 : 64
              const trai = Math.min(Math.max(reMoc.trai, rongHop / 2), reMoc.rong - rongHop / 2)
              return (
                <div
                  className="tp-xem-truoc pointer-events-none absolute bottom-6 -translate-x-1/2 overflow-hidden rounded-lg bg-black/90 p-1 shadow-2xl ring-1 ring-white/15"
                  style={{ left: trai }}
                >
                  {anhTua && (
                    <div
                      className="rounded-md"
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
                  <p className="px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums">{mmss(reMoc.giay)}</p>
                </div>
              )
            })()}
        </div>

        <div className="tp-hang mt-0.5 flex items-center gap-0.5">
          <NutDk nhan={dangPhat ? 'Tạm dừng (K)' : 'Phát (K)'} onClick={batTat}>
            <Bieu ten={dangPhat ? 'dung' : 'phat'} />
          </NutDk>
          <NutDk nhan="Lùi 10 giây (J)" onClick={() => nhay(-10)}>
            <BieuNhay toi={false} />
          </NutDk>
          <NutDk nhan="Tới 10 giây (L)" onClick={() => nhay(10)}>
            <BieuNhay toi />
          </NutDk>

          {/* Âm lượng: thanh lộ ra khi rê chuột; trên TV luôn hiện (globals.css) */}
          <div className="tp-am group/am flex items-center">
            <NutDk
              nhan={tat ? 'Bật tiếng (M)' : 'Tắt tiếng (M)'}
              onClick={() => datTat((x) => !x)}
            >
              {/* Màu đặt thẳng lên biểu tượng: đặt trên nút thì chọi với lớp
                  text-white của nút, và lớp nào thắng tuỳ thứ tự sinh CSS. */}
              <Bieu
                ten={tat || amLuong === 0 ? 'tat-tieng' : amLuong < 0.5 ? 'am-thap' : 'am-cao'}
                className={`tp-icon h-6 w-6 ${dangTangAm ? 'text-amber-400' : ''}`}
              />
            </NutDk>
            <div className="tp-khung-am w-0 overflow-hidden opacity-0 transition-[width,opacity] duration-200 group-focus-within/am:w-[6.5rem] group-focus-within/am:opacity-100 group-hover/am:w-[6.5rem] group-hover/am:opacity-100">
              <ThanhAm
                giaTri={amHien}
                tran={tranAm}
                onDoi={(m) => datMucAm(m, false)}
              />
            </div>
            {(dangTangAm || tranAm > 1) && (
              <span
                className={`tp-phan-tram ml-1 w-10 text-xs font-semibold tabular-nums ${
                  dangTangAm ? 'text-amber-400' : 'text-white/60'
                }`}
              >
                {Math.round(amHien * 100)}%
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => datHienConLai((x) => !x)}
            title="Bấm để đổi giữa thời gian đã xem và thời gian còn lại"
            className="tp-gio ml-1 rounded px-1.5 py-1 text-[13px] tabular-nums text-white/85 transition hover:text-white"
          >
            {hienConLai
              ? `−${mmss(Math.max(0, thoiLuong - tiChay * thoiLuong))}`
              : `${mmss(tiChay * thoiLuong)} / ${mmss(thoiLuong)}`}
          </button>

          <div className="ml-auto flex items-center gap-0.5">
            {tapSau && (
              <NutDk nhan={`${tapSau.nhan} (N)`} onClick={() => router.push(tapSau.href)}>
                <Bieu ten="tap-sau" />
              </NutDk>
            )}
            {dsTap.length > 1 && (
              <NutDk nhan="Danh sách tập" onClick={() => datBang((b) => (b === 'tap' ? null : 'tap'))} sang={bang === 'tap'}>
                <Bieu ten="ds-tap" />
              </NutDk>
            )}
            <NutDk nhan={chiSoPhuDe >= 0 ? 'Tắt phụ đề (C)' : 'Bật phụ đề (C)'} onClick={doiPhuDe} gachDuoi={chiSoPhuDe >= 0}>
              <Bieu ten="cc" />
            </NutDk>
            <NutDk
              nhan="Cài đặt"
              onClick={() => datBang((b) => (b && b !== 'tap' ? null : 'cai-dat'))}
              className={bang && bang !== 'tap' ? '[&>svg]:rotate-45' : ''}
            >
              <Bieu ten="cai-dat" className="tp-icon h-6 w-6 transition-transform duration-300" />
            </NutDk>
            {coPip && (
              <span className="an-tren-tv contents">
                <NutDk nhan="Cửa sổ nhỏ (P)" onClick={doiPip}>
                  <Bieu ten="pip" />
                </NutDk>
              </span>
            )}
            <NutDk nhan={toanManHinh ? 'Thoát toàn màn hình (F)' : 'Toàn màn hình (F)'} onClick={doiToanManHinh}>
              <Bieu ten={toanManHinh ? 'thoat-toan-man' : 'toan-man'} />
            </NutDk>
          </div>
        </div>
      </div>

      {/* ---- bảng: cài đặt và chọn tập ----
          Lớp hứng bấm phía sau bảng: bấm ra ngoài là đóng, kể cả trên TV. */}
      {bang && (
        <div className="absolute inset-0 z-30" onClick={() => datBang(null)}>
          <div
            role="menu"
            onClick={(e) => e.stopPropagation()}
            className={`tp-bang buong-len absolute bottom-[4.75rem] right-3 overflow-y-auto rounded-2xl bg-[#121217]/95 py-1.5 text-sm shadow-2xl ring-1 ring-white/10 backdrop-blur-md md:right-4 ${
              bang === 'tap' ? 'tp-bang-tap w-[22rem] max-w-[calc(100%-1.5rem)]' : 'w-[20rem] max-w-[calc(100%-1.5rem)]'
            }`}
            style={{ maxHeight: 'min(72%, 30rem)' }}
          >
            {bang === 'cai-dat' && (
              <>
                {mayChu.length > 1 && (
                  <HangBang bieu="may-chu" nhan="Máy chủ" giaTri={mayChuDang?.nhan || ''} onClick={() => datBang('may-chu')} />
                )}
                <HangBang bieu="cc" nhan="Phụ đề" giaTri={nhanPhuDe} onClick={() => datBang('phu-de')} />
                <HangBang
                  bieu="kieu-chu"
                  nhan="Kiểu phụ đề"
                  giaTri={`${coChu}%${nenPhuDe ? ' · có nền' : ''}`}
                  onClick={() => datBang('kieu-phu-de')}
                />
                {trackAm.length > 1 && (
                  <HangBang
                    bieu="tieng"
                    nhan="Tiếng"
                    giaTri={trackAm.find((t) => t.chiSo === amDangChon)?.nhan || ''}
                    onClick={() => datBang('tieng')}
                  />
                )}
                <HangBang
                  bieu="toc-do"
                  nhan="Tốc độ phát"
                  giaTri={tocDo === 1 ? 'Bình thường' : `${tocDo}×`}
                  onClick={() => datBang('toc-do')}
                />

                <div className="tp-hang-bang flex items-start gap-3 px-4 py-2.5">
                  <Bieu ten="am-cao" className={`mt-0.5 h-5 w-5 shrink-0 ${tangAm ? 'text-amber-400' : 'text-white/70'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-white/95">Tăng âm lượng</p>
                    <p className="mt-0.5 text-xs leading-snug text-white/50">
                      {coWebAudio
                        ? `Cho kéo vượt 100%, tối đa ${TRAN_TANG_AM * 100}%. Hợp với loa laptop nhỏ; có bộ giới hạn để không rè.`
                        : 'Trình duyệt này không hỗ trợ.'}
                    </p>
                  </div>
                  <CongTac bat={tangAm} khoa={!coWebAudio} onDoi={doiTangAm} nhan="Tăng âm lượng" />
                </div>

                <HangBang bieu="hen-gio" nhan="Hẹn giờ tắt" giaTri={nhanHenGio} onClick={() => datBang('hen-gio')} />
                <HangBang
                  bieu="tua-nhanh"
                  nhan="Đoạn intro"
                  giaTri={intro ? `${mmss(intro.bat_dau)}–${mmss(intro.ket_thuc)}` : 'Chưa đặt'}
                  onClick={() => datBang('intro')}
                />
                <div className="an-tren-tv">
                  <HangBang bieu="ban-phim" nhan="Phím tắt" giaTri="?" onClick={() => datBang('phim-tat')} />
                </div>
              </>
            )}

            {bang === 'may-chu' && (
              <>
                <TieuDeBang nhan="Máy chủ" onLui={() => datBang('cai-dat')} />
                {mayChu.map((m) => (
                  <Link
                    key={m.href}
                    href={m.href}
                    onClick={() => datBang(null)}
                    className="tp-hang-bang flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-white/[0.07]"
                  >
                    <DauChon chon={m.dang} />
                    <span className={`truncate ${m.dang ? 'text-white' : 'text-white/75'}`}>{m.nhan}</span>
                  </Link>
                ))}
                <p className="px-4 pb-2 pt-1 text-xs leading-snug text-white/45">
                  Máy chủ đang dùng chập chờn hay không phát được thì đổi sang cái khác.
                </p>
              </>
            )}

            {bang === 'phu-de' && (
              <>
                <TieuDeBang nhan="Phụ đề" onLui={() => datBang('cai-dat')} />
                <MucChon chon={chiSoPhuDe === -1} onClick={() => datChiSoPhuDe(-1)}>
                  Tắt
                </MucChon>
                {dsPhuDe.map((p, i) => (
                  <MucChon key={i} chon={chiSoPhuDe === i} onClick={() => datChiSoPhuDe(i)}>
                    {p.nhan}
                  </MucChon>
                ))}
                <label className="tp-hang-bang mx-3 my-1.5 flex cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-white/75 ring-1 ring-white/15 transition hover:bg-white/[0.07] hover:text-white">
                  Chọn tệp phụ đề .srt / .vtt
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
                <p className="an-tren-tv px-4 pb-2 text-xs text-white/40">Hoặc kéo thả tệp thẳng vào khung hình.</p>
              </>
            )}

            {bang === 'kieu-phu-de' && (
              <>
                <TieuDeBang nhan="Kiểu phụ đề" onLui={() => datBang('cai-dat')} />
                <div className="px-4 pb-3 pt-1">
                  <div className="mb-1.5 flex items-center justify-between text-white/70">
                    <span>Cỡ chữ</span>
                    <span className="tabular-nums text-white">{coChu}%</span>
                  </div>
                  <ThanhTruot
                    giaTri={coChu}
                    min={70}
                    max={200}
                    buoc={10}
                    nhan="Cỡ chữ phụ đề"
                    onDoi={(m) => {
                      datCoChu(m)
                      ghiCaiDat({ coChu: m })
                    }}
                  />

                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-white/70">Nền tối sau chữ</span>
                    <CongTac
                      bat={nenPhuDe}
                      nhan="Nền tối sau chữ"
                      onDoi={(b) => {
                        datNenPhuDe(b)
                        ghiCaiDat({ nenPhuDe: b })
                      }}
                    />
                  </div>

                  <div className="mb-1.5 mt-4 flex items-center justify-between text-white/70">
                    <span>Lệch thời gian</span>
                    <span className="tabular-nums text-white">
                      {buGiay > 0 ? '+' : ''}
                      {buGiay.toFixed(2)} giây
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <NutNho onClick={() => datBuGiay((b) => +(b - 0.25).toFixed(2))}>Sớm 0,25</NutNho>
                    <NutNho onClick={() => datBuGiay(0)}>Khớp</NutNho>
                    <NutNho onClick={() => datBuGiay((b) => +(b + 0.25).toFixed(2))}>Muộn 0,25</NutNho>
                  </div>
                </div>
              </>
            )}

            {bang === 'tieng' && (
              <>
                <TieuDeBang nhan="Tiếng" onLui={() => datBang('cai-dat')} />
                {trackAm.map((t) => (
                  <MucChon key={t.chiSo} chon={amDangChon === t.chiSo} onClick={() => doiTieng(t.chiSo)}>
                    {t.nhan}
                  </MucChon>
                ))}
                <p className="px-4 pb-2 pt-1 text-xs leading-snug text-white/45">
                  Đổi tiếng phải chuyển mã bằng ffmpeg nên tua sẽ chậm hơn một chút.
                </p>
              </>
            )}

            {bang === 'toc-do' && (
              <>
                <TieuDeBang nhan="Tốc độ phát" onLui={() => datBang('cai-dat')} />
                {TOC_DO.map((t) => (
                  <MucChon
                    key={t}
                    chon={tocDo === t}
                    onClick={() => {
                      datToc(t, false)
                      datBang('cai-dat')
                    }}
                  >
                    {t === 1 ? 'Bình thường' : `${t}×`}
                  </MucChon>
                ))}
              </>
            )}

            {bang === 'hen-gio' && (
              <>
                <TieuDeBang nhan="Hẹn giờ tắt" onLui={() => datBang('cai-dat')} />
                <MucChon
                  chon={henGio === null}
                  onClick={() => {
                    datHenGio(null)
                    datBang(null)
                  }}
                >
                  Không hẹn giờ
                </MucChon>
                {[15, 30, 45, 60, 90].map((p) => (
                  <MucChon
                    key={p}
                    chon={henGio === p}
                    onClick={() => {
                      datHenGio(p)
                      datBang(null)
                      baoOsd(`Sẽ tạm dừng sau ${p} phút`)
                    }}
                  >
                    Sau {p} phút
                  </MucChon>
                ))}
                <MucChon
                  chon={henGio === 'het-tap'}
                  onClick={() => {
                    datHenGio('het-tap')
                    datBang(null)
                    baoOsd('Sẽ dừng khi hết tập này')
                  }}
                >
                  Khi hết tập này
                </MucChon>
              </>
            )}

            {bang === 'intro' && (
              <>
                <TieuDeBang nhan="Đoạn intro" onLui={() => datBang('cai-dat')} />
                <div className="px-4 pb-3 pt-1 text-xs leading-relaxed text-white/60">
                  {intro ? (
                    <p>
                      Intro từ <b className="text-white">{mmss(intro.bat_dau)}</b> tới{' '}
                      <b className="text-white">{mmss(intro.ket_thuc)}</b>, dùng chung cho mọi tập của phim này.
                    </p>
                  ) : (
                    <p>Đánh dấu một lần ở đầu và cuối intro là mọi tập của phim này đều có nút bỏ qua.</p>
                  )}
                  <div className="mt-3 grid gap-1.5">
                    {/* Nút thay cho phím I: trên TV không có bàn phím để bấm */}
                    <NutNho onClick={danhDauIntro}>
                      {dangDanhDau === null
                        ? `Đánh dấu ĐẦU intro tại ${mmss(thoiGian)}`
                        : `Đánh dấu CUỐI intro tại ${mmss(thoiGian)}`}
                    </NutNho>
                    {intro && (
                      <>
                        <NutNho
                          onClick={() => {
                            boQuaIntro()
                            datBang(null)
                          }}
                        >
                          Bỏ qua intro ngay
                        </NutNho>
                        <NutNho onClick={xoaIntro}>Xoá mốc intro</NutNho>
                      </>
                    )}
                  </div>
                  <p className="an-tren-tv mt-2 text-white/40">
                    Phím tắt: <kbd className="rounded bg-white/15 px-1">I</kbd> đánh dấu,{' '}
                    <kbd className="rounded bg-white/15 px-1">S</kbd> bỏ qua.
                  </p>
                </div>
              </>
            )}

            {bang === 'phim-tat' && (
              <>
                <TieuDeBang nhan="Phím tắt" onLui={() => datBang('cai-dat')} />
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 px-4 pb-3 pt-1 text-xs">
                  {[
                    ['Space · K', 'Phát / dừng'],
                    ['← → · J L', 'Lùi / tới 10 giây'],
                    ['↑ ↓', 'Âm lượng'],
                    ['M', 'Tắt tiếng'],
                    ['F', 'Toàn màn hình'],
                    ['C', 'Phụ đề'],
                    ['N', 'Tập sau'],
                    ['[ ]', 'Chậm / nhanh hơn'],
                    ['0 – 9', 'Nhảy tới 0% – 90%'],
                    ['I · S', 'Đánh dấu / bỏ qua intro'],
                    ['P', 'Cửa sổ nhỏ'],
                    ['?', 'Bảng này'],
                  ].map(([k, y]) => (
                    <div key={k} className="contents">
                      <dt className="font-mono text-white/90">{k}</dt>
                      <dd className="text-white/60">{y}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}

            {bang === 'tap' && (
              <>
                <div className="flex items-center justify-between px-4 pb-1.5 pt-2">
                  <p className="font-semibold">Danh sách tập</p>
                  <p className="text-xs text-white/50">{dsTap.length} tập</p>
                </div>
                {khoangCuaTap && (
                  <div className="an-cuon flex gap-1.5 overflow-x-auto px-3 pb-2">
                    {khoangCuaTap.map((k, i) => (
                      <button
                        key={k.tu}
                        type="button"
                        onClick={() => datKhoangTap(i)}
                        className={`shrink-0 rounded-full px-3 py-1 text-xs tabular-nums transition ${
                          i === khoangMo ? 'bg-white text-black' : 'bg-white/10 text-white/75 hover:bg-white/20'
                        }`}
                      >
                        {k.nhan}
                      </button>
                    ))}
                  </div>
                )}
                <div className="tp-luoi-tap grid grid-cols-5 gap-1.5 px-3 pb-3">
                  {tapHien.map((t) => (
                    <Link
                      key={t.href}
                      href={t.href}
                      onClick={() => datBang(null)}
                      aria-current={t.dang ? 'true' : undefined}
                      className={`truncate rounded-md px-1 py-2 text-center text-xs font-semibold tabular-nums transition ${
                        t.dang ? 'bg-[var(--color-nhan)] text-white' : 'bg-white/[0.07] text-white/80 hover:bg-white/15 hover:text-white'
                      }`}
                    >
                      {t.nhan}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ==================================================================
   Mảnh ghép giao diện
   ================================================================== */

const DUONG: Record<string, string> = {
  phat: 'M8 5.14v13.72a1 1 0 0 0 1.52.85l10.8-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14z',
  dung: 'M7 4.5h3.2a.8.8 0 0 1 .8.8v13.4a.8.8 0 0 1-.8.8H7a.8.8 0 0 1-.8-.8V5.3a.8.8 0 0 1 .8-.8zm6.8 0H17a.8.8 0 0 1 .8.8v13.4a.8.8 0 0 1-.8.8h-3.2a.8.8 0 0 1-.8-.8V5.3a.8.8 0 0 1 .8-.8z',
  'am-cao':
    'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z',
  'am-thap': 'M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z',
  'tat-tieng':
    'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z',
  cc: 'M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z',
  'cai-dat':
    'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
  'tap-sau': 'M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z',
  'ds-tap': 'M19 9H2v2h17V9zm0-4H2v2h17V5zM2 15h13v-2H2v2zm15-2v6l5-3-5-3z',
  pip: 'M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z',
  'toan-man': 'M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z',
  'thoat-toan-man': 'M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z',
  lui: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
  phai: 'M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z',
  trai: 'M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z',
  'toc-do':
    'M20.38 8.57l-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.35 19a2 2 0 0 0 1.72 1h13.85a2 2 0 0 0 1.74-1 10 10 0 0 0-.27-10.44zm-9.79 6.84a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83z',
  'kieu-chu': 'M5 17v2h14v-2H5zm4.5-4.2h5l.9 2.2h2.1L12.75 4h-1.5L6.5 15h2.1l.9-2.2zM12 5.98 13.87 11h-3.74L12 5.98z',
  tieng: 'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z',
  'may-chu':
    'M20 13H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-6c0-.55-.45-1-1-1zM7 19c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM20 3H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1zM7 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z',
  'hen-gio':
    'M15 1H9v2h6V1zm-4 13h2V8h-2v6zm8.03-6.61 1.42-1.42c-.43-.51-.9-.99-1.41-1.41l-1.42 1.42A8.962 8.962 0 0 0 12 4c-4.97 0-9 4.03-9 9s4.02 9 9 9 9-4.03 9-9c0-2.12-.74-4.07-1.97-5.61zM12 20c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z',
  'tua-nhanh': 'M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z',
  'ban-phim':
    'M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z',
  loi: 'M11 15h2v2h-2zm0-8h2v6h-2zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z',
  'dung-roi': 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
}

function Bieu({ ten, className = 'tp-icon h-6 w-6' }: { ten: keyof typeof DUONG | string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`${className} fill-current`}>
      <path d={DUONG[ten]} />
    </svg>
  )
}

/** Mũi tên vòng kèm số 10 — chữ vẽ bằng <text> để luôn sắc nét ở mọi cỡ. */
function BieuNhay({ toi, className = 'tp-icon h-6 w-6' }: { toi: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <g transform={toi ? 'matrix(-1 0 0 1 24 0)' : undefined}>
        <path
          className="fill-current"
          d="M12 5V1.5L7 6.5l5 5V8a5.5 5.5 0 1 1-5.5 5.5H4.5A7.5 7.5 0 1 0 12 6z"
        />
      </g>
      <text
        x="12"
        y="16.3"
        textAnchor="middle"
        fontSize="6.2"
        fontWeight="700"
        className="fill-current"
        style={{ fontFamily: 'inherit' }}
      >
        10
      </text>
    </svg>
  )
}

function NutDk({
  children,
  onClick,
  nhan,
  sang,
  gachDuoi,
  className = '',
}: {
  children: React.ReactNode
  onClick: () => void
  nhan: string
  /** Đang mở bảng của nút này */
  sang?: boolean
  /** Gạch đỏ dưới chân — kiểu nút CC của YouTube khi phụ đề đang bật */
  gachDuoi?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={nhan}
      aria-label={nhan}
      aria-pressed={gachDuoi ?? sang}
      className={`tp-nut relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-white/90 transition duration-150 hover:bg-white/12 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
        sang ? 'bg-white/15 text-white' : ''
      } ${className}`}
    >
      {children}
      {gachDuoi && (
        <span aria-hidden className="absolute bottom-1 left-1/2 h-[3px] w-4 -translate-x-1/2 rounded-full bg-[var(--color-nhan)]" />
      )}
    </button>
  )
}

/**
 * Thanh âm lượng có MỐC 100% và VÙNG TĂNG ÂM màu hổ phách phía sau mốc.
 *
 * Màu khác hẳn phần dưới 100% vì đây là vùng có cái giá: to hơn thật nhưng
 * dựa vào bộ giới hạn, nhạc mạnh sẽ bị nén. Người xem nhìn là biết mình đang
 * vượt mức chuẩn, không phải vô tình kéo lố.
 */
function ThanhAm({ giaTri, tran, onDoi }: { giaTri: number; tran: number; onDoi: (m: number) => void }) {
  const pt = (x: number) => (x / tran) * 100
  const tang = giaTri > 1
  return (
    <div className="tp-thanh-am relative mx-1.5 flex h-8 w-[5.75rem] items-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-[calc(var(--nut-tt,14px)/2)] right-[calc(var(--nut-tt,14px)/2)] flex items-center"
      >
        <div className="absolute inset-x-0 h-1 rounded-full bg-white/25" />
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 h-1 rounded-full bg-white"
          style={{ width: pt(Math.min(giaTri, 1)) + '%' }}
        />
        {tang && (
          <div
            aria-hidden
            className="pointer-events-none absolute h-1 rounded-r-full bg-amber-400"
            style={{ left: pt(1) + '%', width: pt(giaTri - 1) + '%' }}
          />
        )}
        {tran > 1 && (
          <div
            aria-hidden
            title="100%"
            className="pointer-events-none absolute h-3 w-[2px] -translate-x-1/2 rounded-full bg-white/80"
            style={{ left: pt(1) + '%' }}
          />
        )}
      </div>
      <input
        type="range"
        min={0}
        max={tran}
        step={0.05}
        value={giaTri}
        onChange={(e) => onDoi(Number(e.target.value))}
        aria-label="Âm lượng"
        aria-valuetext={`${Math.round(giaTri * 100)}%`}
        data-tang={tang ? '1' : undefined}
        className="thanh-truot relative h-8 w-full"
      />
    </div>
  )
}

function ThanhTruot({
  giaTri,
  min,
  max,
  buoc,
  nhan,
  onDoi,
}: {
  giaTri: number
  min: number
  max: number
  buoc: number
  nhan: string
  onDoi: (m: number) => void
}) {
  const pt = ((giaTri - min) / (max - min)) * 100
  return (
    <div className="relative flex h-7 items-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-[calc(var(--nut-tt,14px)/2)] right-[calc(var(--nut-tt,14px)/2)] flex items-center"
      >
        <div className="absolute inset-x-0 h-1 rounded-full bg-white/20" />
        <div className="absolute left-0 h-1 rounded-full bg-white" style={{ width: pt + '%' }} />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={buoc}
        value={giaTri}
        onChange={(e) => onDoi(Number(e.target.value))}
        aria-label={nhan}
        className="thanh-truot relative h-7 w-full"
      />
    </div>
  )
}

function CongTac({
  bat,
  onDoi,
  nhan,
  khoa = false,
}: {
  bat: boolean
  onDoi: (b: boolean) => void
  nhan: string
  khoa?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={bat}
      aria-label={nhan}
      disabled={khoa}
      onClick={() => onDoi(!bat)}
      className={`tp-cong-tac relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-40 ${
        bat ? 'bg-[var(--color-nhan)]' : 'bg-white/20'
      }`}
    >
      <span
        aria-hidden
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] duration-200 ${
          bat ? 'left-[1.375rem]' : 'left-0.5'
        }`}
      />
    </button>
  )
}

function HangBang({
  bieu,
  nhan,
  giaTri,
  onClick,
}: {
  bieu: string
  nhan: string
  giaTri: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="tp-hang-bang flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-white/[0.07]"
    >
      <Bieu ten={bieu} className="h-5 w-5 shrink-0 text-white/70" />
      <span className="flex-1 text-white/95">{nhan}</span>
      <span className="max-w-[8rem] truncate text-xs text-white/50">{giaTri}</span>
      <Bieu ten="phai" className="h-5 w-5 shrink-0 text-white/40" />
    </button>
  )
}

function TieuDeBang({ nhan, onLui }: { nhan: string; onLui: () => void }) {
  return (
    <button
      type="button"
      onClick={onLui}
      className="tp-hang-bang mb-1 flex w-full items-center gap-2 border-b border-white/10 px-3 py-2.5 text-left font-semibold transition hover:bg-white/[0.05]"
    >
      <Bieu ten="trai" className="h-5 w-5 text-white/70" />
      {nhan}
    </button>
  )
}

function DauChon({ chon }: { chon: boolean }) {
  return (
    <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center">
      {chon && <Bieu ten="dung-roi" className="h-5 w-5 text-[var(--color-nhan)]" />}
    </span>
  )
}

function MucChon({ children, chon, onClick }: { children: React.ReactNode; chon: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={chon}
      onClick={onClick}
      className="tp-hang-bang flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-white/[0.07]"
    >
      <DauChon chon={chon} />
      <span className={`truncate ${chon ? 'text-white' : 'text-white/75'}`}>{children}</span>
    </button>
  )
}

function NutNho({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tp-nut-nho flex-1 rounded-lg bg-white/[0.08] px-2 py-2 text-xs font-medium text-white/85 transition hover:bg-white/15 hover:text-white"
    >
      {children}
    </button>
  )
}

/** Vòng đếm ngược sang tập kế: vòng tròn rút dần thay cho một thanh mỏng. */
function VongDem({ con, tong }: { con: number; tong: number }) {
  const R = 26
  const C = 2 * Math.PI * R
  return (
    <div className="relative mx-auto mt-4 h-20 w-20">
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={R} fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="4" />
        <circle
          cx="32"
          cy="32"
          r={R}
          fill="none"
          stroke="var(--color-nhan)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - con / tong)}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-2xl font-black tabular-nums">{con}</span>
    </div>
  )
}
