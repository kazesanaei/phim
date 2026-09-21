'use client'

/**
 * Trang đo màn hình và phím remote — mở trên chính TV Box rồi đọc số.
 *
 * VÌ SAO CẦN: model TV và model Box KHÔNG cho biết khung CSS mà trang web nhận
 * được. Cùng một TV 40" có trình duyệt báo 960px, có cái báo 1280px, tuỳ
 * devicePixelRatio và cách trình duyệt đặt viewport. Đoán sai thì chữ hoặc quá
 * bé hoặc tràn ra ngoài mép — đã dính đúng lỗi đó một lần.
 *
 * Phần bắt phím còn quan trọng hơn: mỗi trình duyệt TV gửi một mã khác nhau cho
 * nút Back và cụm mũi tên. Biết mã thật thì mới điều hướng bằng remote cho đúng.
 *
 * Chữ để to vì đọc từ ghế sofa cách 2–3 m.
 */
import { useEffect, useState } from 'react'

type Phim = { key: string; code: string; keyCode: number; luc: string }

function Dong({ nhan, giaTri }: { nhan: string; giaTri: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 border-b border-white/10 py-2">
      <span className="w-56 shrink-0 text-white/45">{nhan}</span>
      <span className="font-mono text-[1.15em] font-semibold text-white">{giaTri}</span>
    </div>
  )
}

export default function TrangDoManHinh() {
  const [d, datD] = useState<Record<string, string> | null>(null)
  const [phim, datPhim] = useState<Phim[]>([])

  useEffect(() => {
    const doLai = () =>
      datD({
        khung: `${window.innerWidth} x ${window.innerHeight}`,
        dpr: String(window.devicePixelRatio),
        thuc: `${Math.round(window.innerWidth * window.devicePixelRatio)} x ${Math.round(
          window.innerHeight * window.devicePixelRatio,
        )}`,
        manHinh: `${screen.width} x ${screen.height}`,
        coChuGoc: getComputedStyle(document.documentElement).fontSize,
        cheDo: document.documentElement.dataset.cheDo ?? '(chưa đặt)',
        camUng: 'ontouchstart' in window ? 'có' : 'không',
        ua: navigator.userAgent,
      })
    doLai()
    window.addEventListener('resize', doLai)

    function batPhim(e: KeyboardEvent) {
      // Đừng chặn gì cả — chỉ ghi lại. Chặn ở đây thì không thoát ra được nữa.
      datPhim((cu) =>
        [
          {
            key: e.key,
            code: e.code || '(rỗng)',
            keyCode: e.keyCode,
            luc: new Date().toLocaleTimeString('vi-VN'),
          },
          ...cu,
        ].slice(0, 8),
      )
    }
    window.addEventListener('keydown', batPhim)
    return () => {
      window.removeEventListener('resize', doLai)
      window.removeEventListener('keydown', batPhim)
    }
  }, [])

  if (!d) return <div className="p-8 text-lg">Đang đo...</div>

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 text-[1.05rem]">
      <h1 className="text-2xl font-bold">Đo màn hình và remote</h1>
      <p className="mt-2 text-white/50">
        Chụp ảnh màn hình này hoặc đọc lại các con số. Bấm thử từng nút trên remote để xem mã phím ở phần dưới.
      </p>

      <section className="mt-6 rounded-lg border border-[var(--color-vien)] bg-[var(--color-nen-2)] p-5">
        <Dong nhan="Khung trang (CSS px)" giaTri={d.khung} />
        <Dong nhan="devicePixelRatio" giaTri={d.dpr} />
        <Dong nhan="Điểm ảnh thật" giaTri={d.thuc} />
        <Dong nhan="screen" giaTri={d.manHinh} />
        <Dong nhan="Cỡ chữ gốc đang dùng" giaTri={d.coChuGoc} />
        <Dong nhan="Chế độ hiển thị" giaTri={d.cheDo} />
        <Dong nhan="Có cảm ứng" giaTri={d.camUng} />
      </section>

      {/* Kết luận to đùng để đọc được từ ghế sofa: trình duyệt này có dùng được
          điều hướng bằng mũi tên hay không. Đây là câu hỏi quyết định khi thử
          một trình duyệt lạ trên TV Box. */}
      <section
        className={`mt-5 rounded-lg border-2 p-5 text-center ${
          phim.length ? 'border-emerald-500 bg-emerald-500/10' : 'border-amber-500 bg-amber-500/10'
        }`}
      >
        <p className="text-2xl font-bold">
          {phim.length ? '✓ Remote ĐIỀU KHIỂN ĐƯỢC' : 'Bấm thử 4 mũi tên và nút OK'}
        </p>
        <p className="mt-1 text-white/60">
          {phim.length
            ? 'Trình duyệt này gửi phím xuống trang — dùng mũi tên đi lại trong giao diện được.'
            : 'Bấm mà ô này không đổi màu nghĩa là trình duyệt nuốt phím để lái con trỏ, không điều khiển bằng mũi tên được.'}
        </p>
      </section>

      <section className="mt-5 rounded-lg border border-[var(--color-vien)] bg-[var(--color-nen-2)] p-5">
        <h2 className="mb-3 font-semibold">Phím remote vừa bấm</h2>
        {phim.length === 0 ? (
          <p className="text-white/45">
            Bấm thử: 4 mũi tên, nút OK, nút Back. Nút nào không hiện ở đây nghĩa là trình duyệt không gửi nó xuống
            trang — trang web không xử lý được nút đó.
          </p>
        ) : (
          <ul className="space-y-1 font-mono">
            {phim.map((p, i) => (
              <li key={i} className={i === 0 ? 'text-white' : 'text-white/45'}>
                key=<b>{p.key}</b> · code={p.code} · keyCode=<b>{p.keyCode}</b>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-5 break-all text-sm text-white/35">{d.ua}</p>
    </div>
  )
}
