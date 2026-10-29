// Theo dõi phím remote NGAY TRONG app Kho phim đang mở trên box, qua DevTools của WebView. Không bấm gì, không sửa gì:
// người dùng tự bấm remote, mỗi phím in một dòng — trang có nhận phím không, ai chặn, ô trỏ từ đâu sang đâu.
//   node theo-doi-remote.mjs <cổng devtools> [số giây]     — theo-doi-remote.sh lo adb rồi gọi tệp này
// Viết 29/10/2026: trang thể loại trên Chromecast bấm Xuống không đi, Trái/Phải vẫn đi — máy giả lập thì đi bình thường.
const CONG = Number(process.argv[2] || 9222)
const GIAY = Number(process.argv[3] || 60)
const nghi = (ms) => new Promise((r) => setTimeout(r, ms))

let trang
for (let i = 0; i < 20 && !trang; i++) {
  try {
    const ds = await (await fetch(`http://127.0.0.1:${CONG}/json`)).json()
    trang = ds.find((x) => x.type === 'page' && x.url.startsWith('http://127.0.0.1:3000'))
  } catch {}
  if (!trang) await nghi(500)
}
if (!trang) {
  console.log('Không thấy trang Kho phim trong app — mở app Kho phim trên TV trước.')
  process.exit(1)
}

const ws = new WebSocket(trang.webSocketDebuggerUrl)
await new Promise((ok, loi) => { ws.onopen = ok; ws.onerror = loi })
let soId = 0
const cho = new Map()
ws.onmessage = (m) => {
  const d = JSON.parse(m.data)
  if (d.id && cho.has(d.id)) { cho.get(d.id)(d); cho.delete(d.id); return }
  if (d.method === 'Runtime.consoleAPICalled') {
    const chu = d.params.args.map((a) => a.value ?? '').join(' ')
    if (chu.startsWith('@@')) console.log(chu.slice(2))
  } else if (d.method === 'Runtime.exceptionThrown') {
    console.log('  LỖI JS: ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text || '').split('\n')[0])
  }
}
const goi = (method, params = {}) => new Promise((ok) => {
  const id = ++soId
  cho.set(id, ok)
  ws.send(JSON.stringify({ id, method, params }))
})

// Gắn vào trang: nghe phím ở pha bắt (trước mọi xử lý của trang), rồi đợi các xử lý chạy xong mới đọc kết quả.
// Gắn cả cho trang sau khi chuyển trang (addScriptToEvaluateOnNewDocument) — vào thể loại là đổi trang.
const GAN = `(() => {
  if (window.__theoDoi) return
  window.__theoDoi = 1
  const ten = { ArrowUp: 'LÊN', ArrowDown: 'XUỐNG', ArrowLeft: 'TRÁI', ArrowRight: 'PHẢI', Enter: 'OK', Escape: 'BACK' }
  const ta = (e) => {
    if (!e || e === document.body) return 'body'
    const r = e.getBoundingClientRect()
    const chu = (e.getAttribute('href') || e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 28)
    return e.tagName.toLowerCase() + ' ' + chu + ' (' + Math.round(r.left) + ',' + Math.round(r.top) + ')'
  }
  window.addEventListener('keydown', (e) => {
    const truoc = document.activeElement, y0 = Math.round(scrollY)
    setTimeout(() => {
      const sau = document.activeElement
      console.log('@@' + (ten[e.key] || e.key + '/' + e.keyCode).padEnd(6) + ' chặn=' + (e.defaultPrevented ? 'có' : 'không') +
        ' | ' + (sau === truoc ? 'ĐỨNG YÊN ở ' + ta(sau) : ta(truoc) + ' → ' + ta(sau)) +
        (scrollY !== y0 ? ' | cuộn ' + y0 + '→' + Math.round(scrollY) : ''))
    }, 80)
  }, true)
  console.log('@@--- trang ' + location.pathname + location.search + ' | khung ' + innerWidth + 'x' + innerHeight + ' @' + devicePixelRatio +
    'x | chế độ=' + (document.documentElement.dataset.cheDo || '?') + ' nhẹ=' + (document.documentElement.dataset.nhe || '-'))
})()`
await goi('Runtime.enable')
await goi('Page.enable')
await goi('Page.addScriptToEvaluateOnNewDocument', { source: `addEventListener('DOMContentLoaded', () => setTimeout(() => {${GAN}}, 300))` })
await goi('Runtime.evaluate', { expression: GAN })

console.log(`Đang nghe ${GIAY} giây. Bấm remote trên TV: XUỐNG 3 lần, PHẢI 2 lần, XUỐNG 3 lần, rồi đợi.`)
console.log('(Dòng nào không hiện khi bấm = phím không tới được trang.)')
await nghi(GIAY * 1000)
await goi('Runtime.evaluate', { expression: 'void 0' })
ws.close()
console.log('--- xong')
