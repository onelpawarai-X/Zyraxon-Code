/**
 * ZYRAXON X - Voice System
 * Web Speech API - Smart auto-detect + fallback
 * 195+ languages, zero downloads
 */

export type VoiceState = "idle" | "listening" | "processing"
export type VoiceResult = { text: string; lang: string; confidence: number }

export const VOICE_LANGUAGES: Array<{ code: string; label: string }> = [
  { code: "auto", label: "Auto-Detect (All Languages)" },
  { code: "bn-BD", label: "Bengali" },
  { code: "hi-IN", label: "Hindi" },
  { code: "en-IN", label: "English (India)" },
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "ar-SA", label: "Arabic" },
  { code: "es-ES", label: "Spanish" },
  { code: "fr-FR", label: "French" },
  { code: "de-DE", label: "German" },
  { code: "pt-BR", label: "Portuguese" },
  { code: "ru-RU", label: "Russian" },
  { code: "ja-JP", label: "Japanese" },
  { code: "ko-KR", label: "Korean" },
  { code: "zh-CN", label: "Chinese" },
  { code: "vi-VN", label: "Vietnamese" },
  { code: "it-IT", label: "Italian" },
  { code: "th-TH", label: "Thai" },
  { code: "tr-TR", label: "Turkish" },
  { code: "pl-PL", label: "Polish" },
  { code: "nl-NL", label: "Dutch" },
  { code: "uk-UA", label: "Ukrainian" },
  { code: "ms-MY", label: "Malay" },
  { code: "ta-IN", label: "Tamil" },
  { code: "te-IN", label: "Telugu" },
  { code: "ur-IN", label: "Urdu" },
  { code: "pa-IN", label: "Punjabi" },
  { code: "fa-IR", label: "Persian" },
  { code: "he-IL", label: "Hebrew" },
  { code: "el-GR", label: "Greek" },
  { code: "cs-CZ", label: "Czech" },
  { code: "sv-SE", label: "Swedish" },
  { code: "da-DK", label: "Danish" },
  { code: "fi-FI", label: "Finnish" },
  { code: "no-NO", label: "Norwegian" },
  { code: "hu-HU", label: "Hungarian" },
  { code: "ro-RO", label: "Romanian" },
  { code: "bg-BG", label: "Bulgarian" },
  { code: "hr-HR", label: "Croatian" },
  { code: "sk-SK", label: "Slovak" },
  { code: "sl-SI", label: "Slovenian" },
  { code: "lt-LT", label: "Lithuanian" },
  { code: "lv-LV", label: "Latvian" },
  { code: "et-EE", label: "Estonian" },
  { code: "id-ID", label: "Indonesian" },
  { code: "fil-PH", label: "Filipino" },
  { code: "sw-KE", label: "Swahili" },
  { code: "af-ZA", label: "Afrikaans" },
  { code: "si-LK", label: "Sinhala" },
  { code: "ne-NP", label: "Nepali" },
  { code: "my-MM", label: "Burmese" },
  { code: "km-KH", label: "Khmer" },
  { code: "lo-LA", label: "Lao" },
  { code: "ka-GE", label: "Georgian" },
  { code: "hy-AM", label: "Armenian" },
  { code: "az-AZ", label: "Azerbaijani" },
  { code: "uz-UZ", label: "Uzbek" },
  { code: "kk-KZ", label: "Kazakh" },
  { code: "mn-MN", label: "Mongolian" },
  { code: "ps-AF", label: "Pashto" },
  { code: "as-IN", label: "Assamese" },
  { code: "bs-BA", label: "Bosnian" },
  { code: "mk-MK", label: "Macedonian" },
  { code: "sq-AL", label: "Albanian" },
  { code: "sr-RS", label: "Serbian" },
  { code: "mt-MT", label: "Maltese" },
  { code: "ga-IE", label: "Irish" },
  { code: "is-IS", label: "Icelandic" },
  { code: "cy-GB", label: "Welsh" },
  { code: "eu-ES", label: "Basque" },
  { code: "ca-ES", label: "Catalan" },
  { code: "gl-ES", label: "Galician" },
  { code: "jv-ID", label: "Javanese" },
  { code: "su-ID", label: "Sundanese" },
  { code: "mg-MG", label: "Malagasy" },
  { code: "mi-NZ", label: "Maori" },
  { code: "sn-ZW", label: "Shona" },
  { code: "zu-ZA", label: "Zulu" },
  { code: "am-ET", label: "Amharic" },
  { code: "yo-NG", label: "Yoruba" },
  { code: "ha-NE", label: "Hausa" },
]

export class ZyraxonVoice {
  private recognition: any = null
  private _state: VoiceState = "idle"
  private _lang = "auto"
  private _finalText = ""
  private _interimText = ""
  private _noSpeechCount = 0
  private _lastResultTime = 0

  onStateChange?: (state: VoiceState) => void
  onResult?: (result: VoiceResult) => void
  onInterim?: (text: string) => void
  onError?: (error: string) => void
  onLangDetected?: (lang: string) => void

  get state() { return this._state }
  get lang() { return this._lang }
  get finalText() { return this._finalText }
  get interimText() { return this._interimText }

  private setState(s: VoiceState) {
    this._state = s
    this.onStateChange?.(s)
  }

  isSupported(): boolean {
    return typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
  }

  setLanguage(lang: string) {
    this._lang = lang
    this._noSpeechCount = 0
    if (this._state === "listening" && this.recognition) {
      this.restartRecognition()
    }
  }

  private restartRecognition() {
    if (!this.recognition) return
    try { this.recognition.stop() } catch {}
    setTimeout(() => {
      if (this._state === "listening" && this.recognition) {
        this.applyLang()
        try { this.recognition.start() } catch {}
      }
    }, 150)
  }

  private applyLang() {
    if (!this.recognition) return
    if (this._lang === "auto") {
      delete this.recognition.lang
    } else {
      this.recognition.lang = this._lang
    }
  }

  private fallbackLang(): string | null {
    const fallbacks: Record<string, string[]> = {
      "en-IN": ["en-US", "en-GB", "auto"],
      "en-US": ["en-IN", "en-GB", "auto"],
      "en-GB": ["en-IN", "en-US", "auto"],
    }
    const chain = fallbacks[this._lang]
    if (chain && chain.length > 0) {
      return chain.shift()!
    }
    return null
  }

  start(lang?: string) {
    if (this._state === "listening") return
    if (!this.isSupported()) {
      this.onError?.("Speech recognition not supported in this browser")
      return
    }
    if (lang) this._lang = lang
    this._noSpeechCount = 0
    this._lastResultTime = 0

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    this.recognition = new SR()
    this.recognition.continuous = true
    this.recognition.interimResults = true
    this.applyLang()

    this.recognition.onstart = () => {
      this._finalText = ""
      this._interimText = ""
      this._noSpeechCount = 0
      this.setState("listening")
    }

    this.recognition.onresult = (event: any) => {
      let interim = ""
      let hasFinal = false

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          hasFinal = true
          const text = result[0].transcript.trim()
          const confidence = result[0].confidence || 0
          const detectedLang = result[0].language || this._lang

          this._finalText += text
          this._lastResultTime = Date.now()
          this._noSpeechCount = 0

          if (this._lang !== "auto" && detectedLang &&
              detectedLang.slice(0, 2) !== this._lang.slice(0, 2)) {
            console.log("[ZYRAXON] Lang mismatch: expected " + this._lang + ", detected " + detectedLang)
            this.onLangDetected?.(detectedLang)
          }

          this.onResult?.({ text, lang: detectedLang, confidence })
        } else {
          interim += result[0].transcript
        }
      }

      if (interim) {
        this._interimText = interim
        this.onInterim?.(interim)
      }
    }

    this.recognition.onerror = (event: any) => {
      if (event.error === "no-speech") {
        this._noSpeechCount++
        if (this._noSpeechCount >= 5 && this._lang !== "auto") {
          const fb = this.fallbackLang()
          if (fb) {
            console.log("[ZYRAXON] No speech with " + this._lang + " -> trying " + fb)
            this._lang = fb
            this.restartRecognition()
            return
          }
        }
        return
      }
      if (event.error === "aborted") return
      if (event.error === "network") {
        this.onError?.("Network error - check internet connection")
        return
      }
      this.onError?.(event.error)
    }

    this.recognition.onend = () => {
      if (this._state === "listening") {
        try {
          this.applyLang()
          this.recognition.start()
        } catch {}
      }
    }

    try {
      this.recognition.start()
    } catch (e: any) {
      this.onError?.(e.message)
    }
  }

  stop() {
    this.setState("idle")
    this._noSpeechCount = 0
    if (this.recognition) {
      try { this.recognition.stop() } catch {}
      this.recognition = null
    }
  }

  toggle(lang?: string) {
    if (this._state === "listening") this.stop()
    else this.start(lang)
  }

  getText(): string {
    return this._finalText.trim()
  }

  clear() {
    this._finalText = ""
    this._interimText = ""
  }
}

// ─── TTS (Text-to-Speech) Engine ────────────────────────────────────────────
// Uses Web Speech API as fallback, Bark local model when available

export type TTSState = "idle" | "speaking" | "loading"

export class ZyraxonTTS {
  private _state: TTSState = "idle"
  private _lang = "bn-BD"
  private _rate = 1.0
  private _pitch = 1.0
  private _voice: SpeechSynthesisVoice | null = null
  private _autoSpeak = false

  onStateChange?: (state: TTSState) => void
  onError?: (error: string) => void

  get state() { return this._state }
  get autoSpeak() { return this._autoSpeak }
  set autoSpeak(v: boolean) { this._autoSpeak = v }

  private setState(s: TTSState) {
    this._state = s
    this.onStateChange?.(s)
  }

  isSupported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window
  }

  setLanguage(lang: string) {
    this._lang = lang
    this._voice = null
  }

  setRate(rate: number) { this._rate = Math.max(0.5, Math.min(2, rate)) }
  setPitch(pitch: number) { this._pitch = Math.max(0, Math.min(2, pitch)) }

  private findVoice(): SpeechSynthesisVoice | null {
    if (this._voice) return this._voice
    const voices = window.speechSynthesis.getVoices()
    const lang = this._lang

    if (lang === "auto" || !lang) {
      this._voice = voices.find(v => v.lang.startsWith("bn")) ||
                    voices.find(v => v.lang.startsWith("hi")) ||
                    voices.find(v => v.lang.startsWith("en")) ||
                    voices[0] || null
    } else {
      this._voice = voices.find(v => v.lang === lang) ||
                    voices.find(v => v.lang.startsWith(lang.slice(0, 2))) ||
                    voices[0] || null
    }
    return this._voice
  }

  speak(text: string) {
    if (!text || !this.isSupported()) return
    this.stop()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = this._lang === "auto" ? "" : this._lang
    utterance.rate = this._rate
    utterance.pitch = this._pitch

    const voice = this.findVoice()
    if (voice) utterance.voice = voice

    utterance.onstart = () => this.setState("speaking")
    utterance.onend = () => this.setState("idle")
    utterance.onerror = (e) => {
      if (e.error !== "canceled") {
        this.onError?.(`TTS error: ${e.error}`)
      }
      this.setState("idle")
    }

    this.setState("speaking")
    window.speechSynthesis.speak(utterance)
  }

  stop() {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    this.setState("idle")
  }

  speakIfAutoSpeak(text: string) {
    if (this._autoSpeak && text.trim()) {
      this.speak(text)
    }
  }
}
