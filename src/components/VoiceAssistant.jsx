import { useState, useRef, useEffect } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { Button } from './ui'

const AUDIO_MAP = {
  en: {
    NEED_CHECKIN: '/audio/checkin_en.mp3',
    NEED_WORK: '/audio/startwork_en.mp3',
    ALL_DONE: '/audio/done_en.mp3'
  },
  mr: {
    NEED_CHECKIN: '/audio/checkin_mr.mp3',
    NEED_WORK: '/audio/startwork_mr.mp3',
    ALL_DONE: '/audio/done_mr.mp3'
  }
}

const FALLBACK_TEXT = {
  en: {
    NEED_CHECKIN: 'Please press the Check In button to mark your attendance.',
    NEED_WORK: 'You have pending tasks. Press Start Work to begin.',
    ALL_DONE: 'All tasks for today are completed.'
  },
  mr: {
    NEED_CHECKIN: "उपस्थिती नोंदवण्यासाठी 'चेक इन' बटणावर दाबा.",
    NEED_WORK: "तुमची कामे प्रलंबित आहेत. काम सुरू करण्यासाठी 'काम सुरू करा' वर दाबा.",
    ALL_DONE: 'आजसाठी सर्व कामे पूर्ण झाली आहेत.'
  }
}

export default function VoiceAssistant({ status }) {
  const { lang, t } = useLanguage()
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef(null)

  useEffect(() => {
    // Cleanup audio on unmount
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const playFallbackTTS = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const text = FALLBACK_TEXT[lang]?.[status] || FALLBACK_TEXT.en[status] || ''
      const utter = new SpeechSynthesisUtterance(text)
      utter.lang = lang === 'mr' ? 'mr-IN' : 'en-IN'
      utter.rate = 0.95
      utter.onend = () => setIsPlaying(false)
      utter.onerror = () => setIsPlaying(false)
      setIsPlaying(true)
      window.speechSynthesis.speak(utter)
    } else {
      setIsPlaying(false)
    }
  }

  const playAudio = () => {
    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
      setIsPlaying(false)
      return
    }

    const src = AUDIO_MAP[lang]?.[status]
    if (!src) {
      playFallbackTTS()
      return
    }

    const audio = new Audio(src)
    audioRef.current = audio
    
    audio.onended = () => setIsPlaying(false)
    audio.onerror = () => {
      console.warn("Audio file missing, falling back to speech synthesis:", src)
      playFallbackTTS()
    }

    setIsPlaying(true)
    audio.play().catch(e => {
      console.warn("Audio play blocked or failed, falling back to speech synthesis", e)
      playFallbackTTS()
    })
  }

  if (!status) return null

  return (
    <div className="mb-4 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xl">
          {isPlaying ? '🔊' : '🔈'}
        </div>
        <div>
          <p className="font-semibold text-blue-900">
            {lang === 'mr' ? 'मार्गदर्शन ऐका' : 'Listen to Instructions'}
          </p>
          <p className="text-xs text-blue-700">
            {lang === 'mr' ? 'काय करायचे ते ऐकण्यासाठी येथे दाबा' : 'Tap to hear what to do next'}
          </p>
        </div>
      </div>
      <Button variant="primary" className="min-h-10 px-4 text-sm" onClick={playAudio}>
        {isPlaying ? (lang === 'mr' ? 'थांबवा' : 'Stop') : (lang === 'mr' ? 'ऐका' : 'Listen')}
      </Button>
    </div>
  )
}
