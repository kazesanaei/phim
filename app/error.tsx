'use client'

import Trong from '@/components/Trong'

/** Lỗi lúc dựng trang (thường là nguồn phim không trả lời). Thử lại = dựng lại đoạn đó. */
export default function Loi({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <Trong
      hinh="loi"
      tieuDe="Trang này chưa tải được"
      moTa={error.message.includes('fetch') ? 'Nguồn phim đang không trả lời. Đợi vài giây rồi thử lại.' : 'Có lỗi khi dựng trang. Thử lại, hoặc về trang chủ.'}
      nut={[{ nhan: 'Về trang chủ', href: '/' }]}
    >
      <button
        onClick={() => retry()}
        className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/85 focus-visible:ring-2 focus-visible:ring-white"
      >
        Thử lại
      </button>
    </Trong>
  )
}
