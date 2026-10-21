import { networkInterfaces } from 'node:os'
import QRCode from 'qrcode'
import { traLoiLoi, chanCheoTrang } from '@/lib/an-toan'
import { taoMa, guiLenh, hopLeLenh, nghe } from '@/lib/dieu-khien'

/** TV nghe lệnh: luồng SSE theo mã ghép. Ping 20 giây/lần cho khỏi bị cắt vì im lâu. */
export async function GET(req: Request) {
  const ma = new URL(req.url).searchParams.get('ma') || ''
  let thoi: (() => void) | null = null
  let ping: ReturnType<typeof setInterval> | undefined
  const maHoa = new TextEncoder()
  const luong = new ReadableStream<Uint8Array>({
    start(ctl) {
      thoi = nghe(ma, (l) => ctl.enqueue(maHoa.encode(`data: ${JSON.stringify(l)}\n\n`)))
      if (!thoi) {
        ctl.enqueue(maHoa.encode('event: het\ndata: 1\n\n'))
        ctl.close()
        return
      }
      ctl.enqueue(maHoa.encode(': mo\n\n'))
      ping = setInterval(() => ctl.enqueue(maHoa.encode(': ping\n\n')), 20_000)
      req.signal.addEventListener('abort', () => {
        clearInterval(ping)
        thoi?.()
        try {
          ctl.close()
        } catch {}
      })
    },
    cancel() {
      clearInterval(ping)
      thoi?.()
    },
  })
  return new Response(luong, {
    headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' },
  })
}

export async function POST(req: Request) {
  try {
    chanCheoTrang(req)
    const b = (await req.json()) as { viec?: string; ma?: string; lenh?: unknown; goc?: string }
    if (b.viec === 'tao') {
      const ma = taoMa()
      // Địa chỉ lấy theo chính trang TV đang mở (IP trong mạng nhà), không theo Host
      // máy chủ thấy — sau bộ chuyển tiếp hai cái có thể khác nhau.
      const goc = new URL(/^https?:\/\/[^/\s]+$/.test(b.goc || '') ? (b.goc as string) : req.url)
      // Mở trang ghép bằng localhost trên chính máy chủ thì điện thoại không tới
      // được địa chỉ đó — đổi sang IPv4 mạng nhà của máy.
      if (/^(localhost|127\.|\[::1\])/.test(goc.hostname)) {
        const ip = Object.values(networkInterfaces())
          .flat()
          .find((n) => n && n.family === 'IPv4' && !n.internal)?.address
        if (ip) goc.hostname = ip
      }
      const url = `${goc.origin}/dk?ma=${ma}`
      const svg = await QRCode.toString(url, { type: 'svg', margin: 1, color: { dark: '#000', light: '#fff' } })
      return Response.json({ ma, url, svg })
    }
    if (b.viec === 'gui') {
      if (!hopLeLenh(b.lenh)) return Response.json({ loi: 'Lệnh lạ' }, { status: 400 })
      const n = guiLenh(String(b.ma || ''), b.lenh)
      return Response.json({ ok: n > 0, soTv: n })
    }
    return Response.json({ loi: 'Việc lạ' }, { status: 400 })
  } catch (e) {
    return traLoiLoi(e)
  }
}
