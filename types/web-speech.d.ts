/**
 * Khai báo tối thiểu cho Web Speech API (tìm bằng giọng nói).
 *
 * TypeScript chưa đưa nhóm API này vào lib.dom vì nó vẫn là bản nháp và mỗi
 * trình duyệt một kiểu (Chrome dùng `webkitSpeechRecognition`). Chỉ khai đúng
 * những gì components/OTimKiem.tsx dùng tới, không chép cả đặc tả.
 */
interface SpeechRecognitionAlternative {
  readonly transcript: string
  readonly confidence: number
}

interface SpeechRecognitionResult {
  readonly length: number
  readonly isFinal: boolean
  [i: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionResultList {
  readonly length: number
  [i: number]: SpeechRecognitionResult
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string
  readonly message: string
}

interface SpeechRecognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onstart: ((e: Event) => void) | null
  onend: ((e: Event) => void) | null
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null
  onresult: ((e: SpeechRecognitionEvent) => void) | null
}

declare const SpeechRecognition: { new (): SpeechRecognition } | undefined

interface Window {
  SpeechRecognition?: { new (): SpeechRecognition }
  webkitSpeechRecognition?: { new (): SpeechRecognition }
}
