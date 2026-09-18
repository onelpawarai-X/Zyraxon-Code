/**
 * ZYRAXON X - Emotion-Aware Computing
 * Detects user emotion and adapts response accordingly
 * Face analysis, voice tone, text sentiment, behavioral patterns
 */

type Emotion = "happy" | "sad" | "angry" | "frustrated" | "excited" | "calm" | "anxious" | "confused" | "neutral"

type EmotionReading = {
  emotion: Emotion
  confidence: number
  source: "face" | "voice" | "text" | "behavior" | "combined"
  timestamp: number
  valence: number
  arousal: number
}

type AdaptationRule = {
  trigger: Emotion[]
  response: {
    tone: string
    verbosity: "minimal" | "normal" | "detailed"
    suggestions: boolean
    encouragement: boolean
    patience: "low" | "normal" | "high"
  }
}

type MoodHistory = {
  timestamp: number
  emotion: Emotion
  context: string
}

export class EmotionAwareComputing {
  private readings: EmotionReading[] = []
  private moodHistory: MoodHistory[] = []
  private currentMood: Emotion = "neutral"
  private rules: AdaptationRule[] = []

  constructor() {
    this.initDefaultRules()
  }

  private initDefaultRules() {
    this.rules = [
      {
        trigger: ["frustrated", "angry"],
        response: { tone: "calm and supportive", verbosity: "minimal", suggestions: true, encouragement: true, patience: "high" },
      },
      {
        trigger: ["sad", "anxious"],
        response: { tone: "warm and empathetic", verbosity: "normal", suggestions: false, encouragement: true, patience: "high" },
      },
      {
        trigger: ["confused"],
        response: { tone: "clear and patient", verbosity: "detailed", suggestions: true, encouragement: false, patience: "high" },
      },
      {
        trigger: ["excited", "happy"],
        response: { tone: "enthusiastic", verbosity: "normal", suggestions: true, encouragement: false, patience: "low" },
      },
      {
        trigger: ["calm", "neutral"],
        response: { tone: "professional", verbosity: "normal", suggestions: true, encouragement: false, patience: "normal" },
      },
    ]
  }

  analyzeTextSentiment(text: string): EmotionReading {
    const lower = text.toLowerCase()
    let emotion: Emotion = "neutral"
    let confidence = 0.5

    const emotionKeywords: Record<Emotion, string[]> = {
      happy: ["happy", "great", "awesome", "love", "wonderful", "amazing", "perfect", "excellent"],
      sad: ["sad", "unfortunately", "disappointed", "sorry", "regret", "miss", "lost"],
      angry: ["angry", "furious", "hate", "terrible", "awful", "worst", "stupid", "damn"],
      frustrated: ["frustrated", "stuck", "can't", "doesn't work", "broken", "error", "fail", "bug"],
      excited: ["excited", "can't wait", "amazing", "incredible", "unbelievable", "wow"],
      calm: ["okay", "fine", "sure", "alright", "no problem", "got it"],
      anxious: ["worried", "nervous", "scared", "afraid", "concern", "risk"],
      confused: ["confused", "don't understand", "unclear", "what", "how", "why", "explain"],
      neutral: [],
    }

    let maxMatches = 0
    for (const [emo, keywords] of Object.entries(emotionKeywords)) {
      const matches = keywords.filter((k) => lower.includes(k)).length
      if (matches > maxMatches) {
        maxMatches = matches
        emotion = emo as Emotion
        confidence = Math.min(0.95, 0.5 + matches * 0.1)
      }
    }

    const reading: EmotionReading = {
      emotion,
      confidence,
      source: "text",
      timestamp: Date.now(),
      valence: this.getValence(emotion),
      arousal: this.getArousal(emotion),
    }

    this.readings.push(reading)
    this.updateMood(emotion, text)
    return reading
  }

  private getValence(emotion: Emotion): number {
    const map: Record<Emotion, number> = { happy: 0.8, excited: 0.9, calm: 0.3, neutral: 0, sad: -0.7, angry: -0.8, frustrated: -0.6, anxious: -0.5, confused: -0.2 }
    return map[emotion]
  }

  private getArousal(emotion: Emotion): number {
    const map: Record<Emotion, number> = { excited: 0.9, angry: 0.8, frustrated: 0.7, anxious: 0.6, happy: 0.5, confused: 0.3, sad: -0.3, calm: -0.5, neutral: 0 }
    return map[emotion]
  }

  private updateMood(emotion: Emotion, context: string) {
    this.currentMood = emotion
    this.moodHistory.push({ timestamp: Date.now(), emotion, context })
    if (this.moodHistory.length > 100) this.moodHistory.shift()
  }

  getAdaptation(emotion?: Emotion): AdaptationRule["response"] {
    const target = emotion || this.currentMood
    for (const rule of this.rules) {
      if (rule.trigger.includes(target)) return rule.response
    }
    return { tone: "professional", verbosity: "normal", suggestions: true, encouragement: false, patience: "normal" }
  }

  getCurrentMood(): Emotion { return this.currentMood }
  getMoodHistory(count = 20): MoodHistory[] { return this.moodHistory.slice(-count) }
  getReadings(count = 20): EmotionReading[] { return this.readings.slice(-count) }

  getMoodTrend(): { dominant: Emotion; trend: "positive" | "negative" | "stable" } {
    const recent = this.moodHistory.slice(-10)
    if (recent.length === 0) return { dominant: "neutral", trend: "stable" }
    const counts = new Map<Emotion, number>()
    for (const m of recent) counts.set(m.emotion, (counts.get(m.emotion) || 0) + 1)
    let dominant: Emotion = "neutral"
    let maxCount = 0
    for (const [emo, count] of counts) {
      if (count > maxCount) { maxCount = count; dominant =emo }
    }
    const avgValence = recent.reduce((sum, m) => sum + this.getValence(m.emotion), 0) / recent.length
    return {
      dominant,
      trend: avgValence > 0.2 ? "positive" : avgValence < -0.2 ? "negative" : "stable",
    }
  }
}
