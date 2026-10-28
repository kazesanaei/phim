// Đo độ mượt của app Kho phim NGAY TRÊN BOX, qua DevTools của WebView (app bật sẵn setWebContentsDebuggingEnabled).
//   node do-muot.mjs [cổng devtools, mặc định 9222]      — do-muot.sh lo phần adb forward rồi gọi tệp này
// Bấm phím mũi tên giả như remote trên trang đang mở, đo khung hình/giây, khung giật (>50 ms), độ trễ từ lúc bấm
// tới lúc ô được chọn đổi trên màn, thời gian tính style/bố cục. Đo lần lượt với từng nhóm hiệu ứng bị TẮT TẠM
// (chèn <style>, tải lại trang là mất) để biết nhóm nào gây giật — không sửa gì vĩnh viễn.
const CONG = Number(process.argv[2] || 9222)

const ds = await (await fetch(`http://127.0.0.1:${CONG}/json`)).json()
const trang = ds.find((t) => t.type === 'page' && /^http:\/\/127\.0\.0\.1:3000/.test(t.url)) || ds.find((t) => t.type === 'page')
if (!trang) throw new Error('Không thấy trang nào trong app Kho phim')
console.log(`Trang: ${trang.url}`)

const ws = new WebSocket(trang.webSocketDebuggerUrl)
await new Promise((ok, loi) => { ws.onopen = ok; ws.onerror = loi })
let soId = 0
const cho = new Map()
ws.onmessage = (m) => {
  const d = JSON.parse(m.data)
  if (d.id && cho.has(d.id)) { cho.get(d.id)(d); cho.delete(d.id) }
}
const goi = (method, params = {}) => new Promise((ok, loi) => {
  const id = ++soId
  cho.set(id, (d) => (d.error ? loi(new Error(`${method}: ${d.error.message}`)) : ok(d.result)))
  ws.send(JSON.stringify({ id, method, params }))
})
const nghi = (ms) => new Promise((r) => setTimeout(r, ms))
const chay = async (bt) => (await goi('Runtime.evaluate', { expression: bt, returnByValue: true, awaitPromise: true })).result.value

await goi('Performance.enable')

const PHIM = {
  ArrowRight: 39, ArrowLeft: 37, ArrowDown: 40, ArrowUp: 38,
}
async function bam(key) {
  const p = { key, code: key, windowsVirtualKeyCode: PHIM[key], nativeVirtualKeyCode: PHIM[key] }
  await goi('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...p })
  await goi('Input.dispatchKeyEvent', { type: 'keyUp', ...p })
}

// Bộ đếm trong trang: mỗi khung ghi thời điểm; lúc ô được chọn đổi thì tính trễ từ lần bấm gần nhất
const CAI_DEM = `(() => {
  const d = window.__doMuot = { khung: [], tre: [], bam: 0, truoc: document.activeElement, chay: true }
  addEventListener('keydown', (e) => { d.bam = performance.now() }, true)
  const vong = (t) => {
    if (!d.chay) return
    d.khung.push(t)
    if (document.activeElement !== d.truoc) {
      d.truoc = document.activeElement
      if (d.bam) { d.tre.push(t - d.bam); d.bam = 0 }
    }
    requestAnimationFrame(vong)
  }
  requestAnimationFrame(vong)
  return true
})()`
const LAY_DEM = `(() => { const d = window.__doMuot; d.chay = false; return { khung: d.khung, tre: d.tre } })()`

const BIEN_THE = [
  ['Gốc (như bố đang dùng)', ''],
  ['Tắt làm mờ nền (backdrop-filter, filter blur)',
    '*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;filter:none!important}'],
  ['+ Tắt phóng to thẻ khi chọn',
    '*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;filter:none!important}' +
    '.the-phim{transition:none!important}.the-phim:focus-within{transform:none!important}'],
  ['+ Tắt mọi chuyển động (transition, animation)',
    '*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;filter:none!important;' +
    'transition:none!important;animation:none!important}.the-phim:focus-within{transform:none!important}'],
  ['+ Không vẽ hàng phim ngoài màn hình (content-visibility)',
    '*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;filter:none!important;' +
    'transition:none!important;animation:none!important}.the-phim:focus-within{transform:none!important}' +
    'main section{content-visibility:auto;contain-intrinsic-size:auto 22rem}'],
]
const LUOT = ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowUp', 'ArrowUp']

const metric = async () => Object.fromEntries((await goi('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]))

const tt = await chay(`({ rong: innerWidth, cao: innerHeight, dpr: devicePixelRatio, anh: document.images.length,
  nut: document.getElementsByTagName('*').length, cheDo: document.documentElement.dataset.cheDo,
  ua: navigator.userAgent.replace(/.*Chrome\\//, 'Chrome/') })`)
console.log(`Khung ${tt.rong}x${tt.cao} @${tt.dpr}x, chế độ ${tt.cheDo}, ${tt.anh} ảnh, ${tt.nut} phần tử, ${tt.ua}`)
console.log('')
console.log('Mỗi lượt bấm 14 phím mũi tên, cách nhau 300 ms (như người bấm remote).')
console.log('fps: khung/giây (60 là mượt) | giật: số khung > 50 ms | trễ: từ lúc bấm tới lúc ô chọn đổi (TB / tệ nhất)')
console.log('')

const kq = []
for (const [ten, css] of BIEN_THE) {
  await chay(`(() => { let s = document.getElementById('thu-muot'); if (!s) { s = document.createElement('style');
    s.id = 'thu-muot'; document.head.append(s) } s.textContent = ${JSON.stringify(css)}; return true })()`)
  await nghi(1500)
  // Về đầu trang, chọn thẻ phim đầu tiên cho mọi lượt bắt đầu như nhau
  await chay(`(() => { scrollTo(0, 0); const a = document.querySelector('.the-phim a, .the-phim'); a && a.focus(); return !!a })()`)
  await nghi(800)
  const m0 = await metric()
  await chay(CAI_DEM)
  const bd = Date.now()
  for (const k of LUOT) { await bam(k); await nghi(300) }
  await nghi(700)
  const giay = (Date.now() - bd) / 1000
  const { khung, tre } = await chay(LAY_DEM)
  const m1 = await metric()
  let giat = 0
  for (let i = 1; i < khung.length; i++) if (khung[i] - khung[i - 1] > 50) giat++
  const tb = tre.length ? tre.reduce((a, b) => a + b, 0) / tre.length : NaN
  const dong = {
    ten, fps: khung.length / giay, giat, treTB: tb, treMax: tre.length ? Math.max(...tre) : NaN, doi: tre.length,
    style: (m1.RecalcStyleDuration - m0.RecalcStyleDuration) * 1000,
    layout: (m1.LayoutDuration - m0.LayoutDuration) * 1000,
    script: (m1.ScriptDuration - m0.ScriptDuration) * 1000,
  }
  kq.push(dong)
  console.log(`${ten}`)
  console.log(`   fps ${dong.fps.toFixed(0)} | giật ${giat} | trễ ${tb.toFixed(0)} / ${dong.treMax.toFixed(0)} ms (${tre.length}/14 lần đổi ô)` +
    ` | style ${dong.style.toFixed(0)} ms, bố cục ${dong.layout.toFixed(0)} ms, JS ${dong.script.toFixed(0)} ms`)
}

// Trả trang về như cũ
await chay(`(() => { document.getElementById('thu-muot')?.remove(); scrollTo(0, 0); return true })()`)
const heap = (await metric()).JSHeapUsedSize / 1048576
console.log('')
console.log(`Bộ nhớ JS của trang: ${heap.toFixed(0)} MB`)
ws.close()
