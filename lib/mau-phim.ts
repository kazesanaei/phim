/**
 * Màu nền riêng của phim cho trang dựng phía máy chủ (A2). Import động và bỏ qua
 * lúc `next build`: lib/anh.ts có đường dẫn tệp động, kéo thẳng vào đồ thị mô-đun
 * của trang là build gãy (xem chú thích hâm ảnh ở app/page.tsx). Chờ tối đa
 * 1,5 giây — ảnh chưa đệm thì lần này trang không có màu, lần sau có.
 */
export async function layMau(u: string | null | undefined): Promise<string | null> {
  if (!u || process.env.NEXT_PHASE === 'phase-production-build') return null
  try {
    const { mauPhim } = await import('./anh')
    return await Promise.race([mauPhim(u), new Promise<null>((r) => setTimeout(() => r(null), 1500))])
  } catch {
    return null
  }
}
