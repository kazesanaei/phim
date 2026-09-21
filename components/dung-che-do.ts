'use client'

/**
 * Hook đọc chế độ hiển thị cho các thành phần cần đổi CẤU TRÚC (bớt hàng, đổi
 * bố cục), không chỉ đổi kiểu dáng. Đổi kiểu dáng thì cứ để CSS bắt
 * `[data-che-do="tv"]` — nhanh hơn và không phải chờ hydrate.
 *
 * Trả 'pc' ở lượt dựng đầu để máy chủ và trình duyệt khớp nhau, rồi mới đọc giá
 * trị thật trong useEffect. Đọc thẳng lúc dựng sẽ vênh HTML giữa hai bên.
 */
import { useEffect, useState } from 'react'
import { docCheDo, type CheDo } from '@/lib/che-do'

export function dungCheDo(): CheDo {
  const [cd, datCd] = useState<CheDo>('pc')

  useEffect(() => {
    datCd(docCheDo())
    const f = (e: Event) => datCd((e as CustomEvent<CheDo>).detail)
    window.addEventListener('doi-che-do', f)
    return () => window.removeEventListener('doi-che-do', f)
  }, [])

  return cd
}
