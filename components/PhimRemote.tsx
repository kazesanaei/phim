'use client'

/**
 * Điều khiển toàn bộ giao diện bằng remote: 4 mũi tên + OK + Back.
 *
 * CHỈ CHẠY Ở CHẾ ĐỘ TV. Ở chế độ máy tính thì mũi tên phải giữ nguyên nghĩa cũ
 * (cuộn trang, di con trỏ trong ô nhập).
 *
 * VÌ SAO PHẢI TỰ VIẾT: CSS có thuộc tính điều hướng không gian (`nav-right`...)
 * nhưng gần như không trình duyệt nào còn hỗ trợ. Chrome có điều hướng bằng
 * mũi tên nhưng phải bật bằng cờ dòng lệnh, không bật được từ trang web. Nên
 * phần chọn ô kế tiếp buộc phải tính bằng hình học ở đây.
 *
 * VỀ NÚT BACK: trên Android TV nút Back là phím của hệ điều hành, Chrome nhận
 * rồi tự lùi lịch sử — trang web KHÔNG chặn được. Chỗ này chỉ bắt được ở những
 * trình duyệt TV có gửi phím xuống trang (Escape, Backspace, GoBack, mã 10009
 * kiểu Tizen hoặc 461 kiểu webOS).
 */
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { docCheDo, laMayNhe } from '@/lib/che-do'

const PHIM_LUI = new Set(['Escape', 'Backspace', 'GoBack', 'BrowserBack'])
const MA_LUI = new Set([10009, 461])
const HUONG: Record<string, 'len' | 'xuong' | 'trai' | 'phai'> = {
  ArrowUp: 'len',
  ArrowDown: 'xuong',
  ArrowLeft: 'trai',
  ArrowRight: 'phai',
}

const CHON_DUOC =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Đang gõ trong ô nhập thì mũi tên là di con trỏ, Backspace là xoá chữ. */
function dangGo(t: EventTarget | null): boolean {
  const e = t as HTMLElement | null
  if (!e) return false
  return e.tagName === 'INPUT' || e.tagName === 'TEXTAREA' || e.isContentEditable
}

type O = { e: HTMLElement; x: number; y: number; r: DOMRect }

/**
 * Hộp thoại đang mở trên cùng (xem nhanh phim, menu TV), hoặc cả trang.
 *
 * Phải khoanh lại: hộp thoại phủ lên trang nhưng các thẻ phim phía sau VẪN là ô bấm được và
 * vẫn có toạ độ — không khoanh thì mũi tên đi lòng vòng giữa các thẻ bị che, không bao giờ
 * tới được "Xem ngay" (người dùng gặp thật trên TV Box 22/10/2026).
 */
function vungChon(): ParentNode {
  // data-giu-tro: bảng bung không phải hộp thoại về ngữ nghĩa (bảng cài đặt của trình phát)
  // nhưng cũng phải giữ ô trỏ ở trong.
  const ds = document.querySelectorAll<HTMLElement>('[aria-modal="true"], [data-giu-tro]')
  return ds.length ? ds[ds.length - 1] : document
}

function dsChonDuoc(goc: ParentNode = vungChon()): O[] {
  const ra: O[] = []
  for (const e of goc.querySelectorAll<HTMLElement>(CHON_DUOC)) {
    // Nút "+ Lưu vào Xem sau" đè ở góc thẻ phim: với remote nó là cái bẫy — mũi tên xuống từ đầu
    // trang rơi vào nó, bấm OK là lưu phim thay vì mở phim. Lưu vẫn làm được trong hộp thoại phim.
    if (e.classList.contains('nut-luu')) continue
    const r = e.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    const cs = getComputedStyle(e)
    if (cs.visibility === 'hidden' || cs.display === 'none') continue
    ra.push({ e, x: r.left + r.width / 2, y: r.top + r.height / 2, r })
  }
  return ra
}

/**
 * Ô gần nhất theo hướng đã cho.
 *
 * Chấm điểm = khoảng cách theo trục đi + 2 lần lệch theo trục ngang. Nhân đôi
 * phần lệch để mũi tên xuống rơi vào ô NGAY DƯỚI chứ không nhảy chéo sang cột
 * bên cạnh chỉ vì ô đó nhích gần hơn vài pixel.
 */
function timO(tu: DOMRect, ds: O[], huong: 'len' | 'xuong' | 'trai' | 'phai'): HTMLElement | null {
  const gx = tu.left + tu.width / 2
  const gy = tu.top + tu.height / 2
  const doc = huong === 'trai' || huong === 'phai'

  /**
   * Ưu tiên ô CÙNG HÀNG (hoặc cùng cột) trước.
   *
   * Không có bước này thì bấm Phải ở cuối một hàng sẽ vọt lên tận đầu trang,
   * chỉ vì bên phải không còn gì mà nút trên header lại "đủ gần" theo điểm số.
   * Đã thấy thật khi đo: từ "Xem tất cả" (y=304) nhảy lên "Tiếp tục xem" (y=26).
   *
   * Chỉ khi không ô nào trùng hàng mới xét tới cả đám — nhờ vậy vẫn đi được từ
   * hàng phim cuối lên thanh đầu trang.
   */
  const trung = ds.filter((o) =>
    doc ? o.r.bottom > tu.top && o.r.top < tu.bottom : o.r.right > tu.left && o.r.left < tu.right,
  )
  const ungVien = trung.length ? trung : ds

  let tot: HTMLElement | null = null
  let diem = Infinity

  for (const o of ungVien) {
    // Phải nằm hẳn về phía đó, không chỉ nhích một tí — nếu không thì hai ô
    // chồng mép sẽ nhảy qua lại lẫn nhau.
    const di = doc
      ? huong === 'phai'
        ? o.r.left - tu.right
        : tu.left - o.r.right
      : huong === 'xuong'
        ? o.r.top - tu.bottom
        : tu.top - o.r.bottom
    if (di < -Math.min(tu.height, o.r.height) / 2) continue

    const lech = doc ? Math.abs(o.y - gy) : Math.abs(o.x - gx)
    const d = Math.max(0, di) + 2 * lech
    if (d < diem) {
      diem = d
      tot = o.e
    }
  }
  return tot
}

export default function PhimRemote() {
  const router = useRouter()
  const duong = usePathname()

  useEffect(() => {
    function f(e: KeyboardEvent) {
      if (docCheDo() !== 'tv') return

      /**
       * Đánh dấu "trình duyệt này CÓ gửi phím xuống trang" ngay lần đầu nhận
       * được một phím điều khiển.
       *
       * Cần cờ này vì Cốc Cốc trên TV nuốt sạch D-pad để lái con trỏ ảo — đo
       * thật trên máy người dùng: bấm hết mọi nút, không phím nào tới trang.
       * Nếu cứ mặc định giấu các nút dành cho chuột (nút cuộn hàng phim), người
       * dùng trình duyệt kiểu đó sẽ kẹt: vừa không có nút bấm, vừa không có
       * mũi tên. Chỉ giấu SAU KHI biết chắc mũi tên dùng được.
       */
      if (!document.documentElement.dataset.remote) {
        document.documentElement.dataset.remote = '1'
      }

      // ----- Back -----
      if (PHIM_LUI.has(e.key) || MA_LUI.has(e.keyCode)) {
        if (dangGo(e.target)) return
        // Hộp thoại / trình phát / menu đã tự xử lý Back (đóng mình) — đừng lùi trang thêm lần nữa
        if (e.defaultPrevented) return
        if (document.querySelector('[data-lop-phu-mo="1"]')) return
        // Ở trang chủ để Back thoát ra ngoài như bình thường, đừng giữ người
        // dùng trong một vòng không lối ra.
        if (duong === '/') return
        e.preventDefault()
        if (window.history.length > 1) router.back()
        else router.push('/')
        return
      }

      // ----- Mũi tên -----
      const huong = HUONG[e.key]
      if (!huong) return

      const dich = e.target as HTMLElement | null
      // Trong ô nhập: trái/phải để di con trỏ, chỉ lên/xuống mới rời ô.
      if (dangGo(dich) && (huong === 'trai' || huong === 'phai')) return

      // App trên TV box: cuộn trượt (smooth) vừa chậm vừa giật trên chip yếu — nhảy thẳng tới ô mới.
      // 'instant' chứ không 'auto': hàng phim có lớp scroll-smooth, 'auto' vẫn trượt theo CSS.
      const dangChon = document.activeElement
      const vung = vungChon()
      /**
       * Trong vùng giữ ô trỏ (trình phát, hộp thoại) chỉ cuộn 'nearest': 'center' kéo luôn cả trang phía
       * sau cho ô vào giữa màn — trên TV trình phát chiếm trọn màn, chọn một dòng trong bảng máy chủ là
       * trang trượt lên 100px, đầu khung phim hụt khỏi màn (thử 28/10/2026 bằng tv-box/kiem-tra-app).
       */
      const giua = vung === document ? 'center' : 'nearest'
      const cuon: ScrollIntoViewOptions = { block: giua, inline: giua, behavior: laMayNhe() ? 'instant' : 'smooth' }
      // Ô đang trỏ nằm ngoài hộp thoại (thẻ phim phía sau) cũng tính là chưa chọn gì.
      const laThat =
        dangChon instanceof HTMLElement && dangChon !== document.body && (vung === document || vung.contains(dangChon))
      // Chưa chọn gì thì mũi tên đầu tiên nhảy vào ô trên cùng bên trái.
      if (!laThat) {
        const ds = dsChonDuoc()
        if (!ds.length) return
        e.preventDefault()
        const dau = ds.slice().sort((a, b) => a.y - b.y || a.x - b.x)[0]
        dau.e.focus()
        dau.e.scrollIntoView(cuon)
        return
      }

      const tu = dangChon.getBoundingClientRect()
      /**
       * Trái/phải trong một hàng phim: chỉ xét các ô của chính hàng đó. Quét cả trang là đo toạ độ
       * hàng trăm ô (trang chủ ~270 thẻ) cho MỖI lần bấm — trên Chromecast đo được 500–800 ms JS cho 14
       * phím (tv-box/do-muot.mjs, 28/10/2026). Hết ô trong hàng thì mới quét cả trang như cũ.
       */
      const hang = huong === 'trai' || huong === 'phai' ? dangChon.closest('.hang-phim, .cuon-ngang') : null
      let moi = hang ? timO(tu, dsChonDuoc(hang), huong) : null
      if (!moi) {
        const ds = dsChonDuoc()
        if (!ds.length) return
        moi = timO(tu, ds, huong)
      }
      if (!moi) {
        /**
         * Hết ô theo hướng đó. Cả trang thì để trình duyệt cuộn như thường. Trong vùng giữ ô trỏ
         * (trình phát, hộp thoại) thì CHẶN: trình duyệt cuộn trang phía sau đi mất — trang xem trên TV
         * bị đẩy lệch lên, trình phát hụt khỏi màn (người dùng gặp 28/10/2026 khi bấm Xuống ở thanh
         * điều khiển để tìm chỗ đổi máy chủ).
         */
        if (vung !== document) e.preventDefault()
        return
      }
      e.preventDefault()
      moi.focus()
      moi.scrollIntoView(cuon)
      if (laMayNhe()) henTaiTruoc(moi)
    }

    /**
     * App TV box tắt tải trước theo khung nhìn (lib/che-do.ts taiTruoc) — bù lại bằng tải trước đúng
     * phim đang được chọn khi ô trỏ dừng ở đó 0,6 giây: lướt nhanh qua thì không tốn gì, dừng lại
     * xem thì bấm OK đã có sẵn dữ liệu.
     */
    let hen: ReturnType<typeof setTimeout> | undefined
    function henTaiTruoc(o: HTMLElement) {
      clearTimeout(hen)
      const href = o.getAttribute('href')
      if (!href || !href.startsWith('/') || !/^\/(phim|xem)\//.test(href)) return
      hen = setTimeout(() => {
        if (document.activeElement === o) router.prefetch(href)
      }, 600)
    }

    window.addEventListener('keydown', f)
    return () => {
      clearTimeout(hen)
      window.removeEventListener('keydown', f)
    }
  }, [router, duong])

  return null
}
