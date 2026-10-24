/* ============================================================
   语音输入（Web Speech API）
   浏览器原生 SpeechRecognition，零依赖。
   不支持时 supported=false，界面自动隐藏麦克风按钮。
   ============================================================ */
import { ref, onBeforeUnmount } from 'vue'

interface SpeechWindow extends Window {
  SpeechRecognition?: new () => SpeechRecognitionLike
  webkitSpeechRecognition?: new () => SpeechRecognitionLike
}

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  onresult: ((e: SpeechResultEventLike) => void) | null
  onerror: ((e: { error?: string }) => void) | null
  onend: (() => void) | null
}

interface SpeechResultEventLike {
  results: { isFinal: boolean; 0: { transcript: string } }[]
}

export function useSpeechInput() {
  const supported =
    typeof window !== 'undefined' &&
    (!!(window as SpeechWindow).SpeechRecognition ||
      !!(window as SpeechWindow).webkitSpeechRecognition)

  const listening = ref(false)
  const error = ref('')
  let recognition: SpeechRecognitionLike | null = null

  function start(onFinal: (text: string) => void): void {
    const w = window as SpeechWindow
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SR) return
    try {
      recognition = new SR()
    } catch {
      error.value = '语音识别初始化失败'
      return
    }
    recognition.lang = 'zh-CN'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (e: SpeechResultEventLike) => {
      let final = ''
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript
      }
      if (final) onFinal(final)
    }
    recognition.onerror = (e) => {
      error.value = e.error || '识别失败'
      stop()
    }
    recognition.onend = () => {
      listening.value = false
    }
    recognition.start()
    listening.value = true
    error.value = ''
  }

  function stop(): void {
    try {
      recognition?.stop()
    } catch {
      /* ignore */
    }
    listening.value = false
  }

  onBeforeUnmount(stop)

  return { supported, listening, error, start, stop }
}
