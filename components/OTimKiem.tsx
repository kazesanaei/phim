'use client'

/**
 * Ô tìm phim: gõ tới đâu gợi ý tới đó, thêm hai lối vào dành cho remote TV.
 *
 * BÀN PHÍM ẢO CHỈ CÓ A–Z: tìm kiếm bỏ dấu ở cả hai phía (kho so bằng cột
 * `ten_khong_dau`, xem lib/kho-nguon.ts), nên gõ "bo gia" vẫn ra "Bố Già".
 * Khỏi phải dựng cả bảng dấu tiếng Việt — trên remote thì đó là ác mộng.
 *
 * NÚT MIC LÀ NÚT TRONG TRANG, không phải nút mic trên remote. Nút mic vật lý
 * thuộc về Android TV: hệ điều hành nuốt phím đó và mở trợ lý của nó, trang web
 * không có cách nào giành lại. Nút ở đây bấm bằng con trỏ, dùng Web Speech API
 * nên nghe xong là điền thẳng vào ô, không rời trang. Trình duyệt nào không có
 * API đó thì nút tự ẩn.
 */
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { dungCheDo } from '@/components/dung-che-do'

type GoiY = {
  phim: { slug: string; ten: string; nam?: number; poster?: string }[]
  nguoi: { ten: string; loai: string; soPhim: number }[]
}

const HANG_PHIM = [
  ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
  ['H', 'I', 'J', 'K', 'L', 'M', 'N'],
  ['O', 'P', 'Q', 'R', 'S', 'T', 'U'],
  ['V', 'W', 'X', 'Y', 'Z', '0', '1'],
  ['2', '3', '4', '5', '6', '7', '8'],
]

/** Trình duyệt nào cũng giấu API này sau tiền tố riêng. */
function layNhanDang(): (new () => SpeechRecognition) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognition
    webkitSpeechRecognition?: new () => SpeechRecognition
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export default function OTimKiem() {
  const router = useRouter()
  const sp = useSearchParams()
  const cheDo = dungCheDo()
  const [q, datQ] = useState(sp.get('q') || '')
  const [goiY, datGoiY] = useState<GoiY | null>(null)
  const [mo, datMo] = useState(false)
  const [dangNghe, datDangNghe] = useState(false)
  const [coMic, datCoMic] = useState(false)
  const [loiMic, datLoiMic] = useState<string | null>(null)
  const oRef = useRef<HTMLInputElement>(null)
  const boRef = useRef<HTMLDivElement>(null)
  const nhanRef = useRef<SpeechRecognition | null>(null)

  const laTv = cheDo === 'tv'

  useEffect(() => datCoMic(!!layNhanDang()), [])

  // Phím "/" nhảy vào ô tìm, quen tay như trên các trang tài liệu.
  useEffect(() => {
    function f(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === '/') {
        e.preventDefault()
        oRef.current?.focus()
      }
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [])

  // Bấm ra ngoài thì đóng bảng gợi ý
  useEffect(() => {
    if (!mo) return
    function f(e: MouseEvent) {
      if (!boRef.current?.contains(e.target as Node)) datMo(false)
    }
    document.addEventListener('mousedown', f)
    return () => document.removeEventListener('mousedown', f)
  }, [mo])

  // Gõ xong mới hỏi, đừng bắn mỗi phím một yêu cầu
  useEffect(() => {
    const t = q.trim()
    if (t.length < 2) {
      datGoiY(null)
      return
    }
    const bo = new AbortController()
    const hen = setTimeout(async () => {
      try {
        const r = await fetch('/api/goi-y?q=' + encodeURIComponent(t), { signal: bo.signal })
        if (r.ok) datGoiY(await r.json())
      } catch {
        // huỷ giữa chừng hoặc mạng lỗi — im lặng, gợi ý không phải thứ sống còn
      }
    }, 220)
    return () => {
      clearTimeout(hen)
      bo.abort()
    }
  }, [q])

  const guiDi = useCallback(
    (chuoi?: string) => {
      const t = (chuoi ?? q).trim()
      if (!t) return
      datMo(false)
      router.push('/tim-kiem?q=' + encodeURIComponent(t))
    },
    [q, router],
  )

  function nghe() {
    const NhanDang = layNhanDang()
    if (!NhanDang) return
    if (dangNghe) {
      nhanRef.current?.stop()
      return
    }
    datLoiMic(null)
    const nd = new NhanDang()
    nhanRef.current = nd
    nd.lang = 'vi-VN'
    nd.interimResults = true
    nd.continuous = false
    nd.onstart = () => datDangNghe(true)
    nd.onerror = (e: SpeechRecognitionErrorEvent) => {
      datDangNghe(false)
      datLoiMic(
        e.error === 'not-allowed'
          ? 'Trình duyệt chưa cho dùng micro'
          : e.error === 'no-speech'
            ? 'Không nghe thấy gì'
            : 'Không nhận được giọng nói',
      )
    }
    nd.onend = () => datDangNghe(false)
    nd.onresult = (e: SpeechRecognitionEvent) => {
      const chu = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join('')
      datQ(chu)
      datMo(true)
      // Câu đã chốt thì tìm luôn, khỏi bắt người dùng bấm thêm nút nào nữa.
      if (e.results[e.results.length - 1].isFinal) guiDi(chu)
    }
    try {
      nd.start()
    } catch {
      datLoiMic('Không bật được micro')
    }
  }

  function goPhim(c: string) {
    datQ((v) => v + c)
    datMo(true)
    oRef.current?.focus()
  }

  const coGoiY = !!goiY && (goiY.phim.length > 0 || goiY.nguoi.length > 0)

  return (
    <div ref={boRef} className="relative">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          guiDi()
        }}
        className="flex items-center gap-1"
      >
        <input
          ref={oRef}
          value={q}
          onChange={(e) => {
            datQ(e.target.value)
            datMo(true)
          }}
          onFocus={() => datMo(true)}
          placeholder={laTv ? 'Tìm kiếm' : 'Tìm phim...   /'}
          aria-label="Tìm phim hoặc tên diễn viên"
          autoComplete="off"
          className="w-36 rounded border border-[var(--color-vien)] bg-[var(--color-nen-2)] px-3 py-1.5 text-sm outline-none transition-all placeholder:text-white/30 focus:w-60 focus:border-white/40 sm:w-48"
        />

        {coMic && (
          <button
            type="button"
            onClick={nghe}
            title={dangNghe ? 'Đang nghe — bấm để dừng' : 'Nói tên phim hoặc tên diễn viên'}
            aria-label={dangNghe ? 'Dừng nghe' : 'Tìm bằng giọng nói'}
            aria-pressed={dangNghe}
            className={`grid h-8 w-8 shrink-0 place-items-center rounded border transition ${
              dangNghe
                ? 'animate-pulse border-[var(--color-nhan)] bg-[var(--color-nhan)]/20 text-white'
                : 'border-[var(--color-vien)] text-white/60 hover:border-white/40 hover:text-white'
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
              <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" />
            </svg>
          </button>
        )}
      </form>

      {mo && (coGoiY || laTv || loiMic || dangNghe) && (
        <div className="buong-xuong absolute right-0 top-full z-[70] mt-2 w-[min(92vw,26rem)] overflow-hidden rounded-lg border border-[var(--color-vien)] bg-[#141419] shadow-[0_18px_50px_rgba(0,0,0,.75)]">
          {(dangNghe || loiMic) && (
            <p
              className={`border-b border-[var(--color-vien)] px-3 py-2 text-xs ${
                dangNghe ? 'text-[var(--color-nhan)]' : 'text-white/50'
              }`}
            >
              {dangNghe ? 'Đang nghe, nói tên phim hoặc diễn viên...' : loiMic}
            </p>
          )}

          {!!goiY?.nguoi.length && (
            <div className="border-b border-[var(--color-vien)] p-2">
              <p className="px-1 pb-1 text-[11px] uppercase tracking-wide text-white/35">Diễn viên · đạo diễn</p>
              {goiY.nguoi.map((n) => (
                <button
                  key={n.loai + n.ten}
                  onClick={() => guiDi(n.ten)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-white/85 transition hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:outline-none"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-[10px] font-bold">
                    {n.ten.charAt(0).toUpperCase()}
                  </span>
                  <span className="flex-1 truncate">{n.ten}</span>
                  <span className="shrink-0 text-[11px] text-white/35">
                    {n.loai === 'dd' ? 'đạo diễn' : ''} {n.soPhim} phim
                  </span>
                </button>
              ))}
            </div>
          )}

          {!!goiY?.phim.length && (
            <div className="p-2">
              <p className="px-1 pb-1 text-[11px] uppercase tracking-wide text-white/35">Phim</p>
              {goiY.phim.map((p) => (
                <button
                  key={p.slug}
                  onClick={() => {
                    datMo(false)
                    router.push('/phim/' + p.slug)
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-white/85 transition hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:outline-none"
                >
                  <span className="flex-1 truncate">{p.ten}</span>
                  {p.nam && <span className="shrink-0 text-[11px] text-white/35">{p.nam}</span>}
                </button>
              ))}
            </div>
          )}

          {laTv && (
            <div className="border-t border-[var(--color-vien)] p-2">
              <p className="px-1 pb-1.5 text-[11px] uppercase tracking-wide text-white/35">
                Bàn phím — gõ không dấu vẫn ra đúng phim
              </p>
              <div className="grid grid-cols-7 gap-1">
                {HANG_PHIM.flat().map((c) => (
                  <button
                    key={c}
                    onClick={() => goPhim(c.toLowerCase())}
                    className="rounded bg-white/10 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/20 hover:text-white focus-visible:bg-white/25 focus-visible:outline-none"
                  >
                    {c}
                  </button>
                ))}
                <button
                  onClick={() => goPhim(' ')}
                  className="col-span-3 rounded bg-white/10 py-2 text-xs text-white/85 transition hover:bg-white/20"
                >
                  Cách
                </button>
                <button
                  onClick={() => datQ((v) => v.slice(0, -1))}
                  className="col-span-2 rounded bg-white/10 py-2 text-xs text-white/85 transition hover:bg-white/20"
                >
                  Xoá
                </button>
                <button
                  onClick={() => guiDi()}
                  className="col-span-2 rounded bg-[var(--color-nhan)] py-2 text-xs font-semibold text-white transition hover:brightness-110"
                >
                  Tìm
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
