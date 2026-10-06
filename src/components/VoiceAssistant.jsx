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
    }
  }, [])

  const playAudio = () => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause()
      setIsPlaying(false)
      return
    }

    const src = AUDIO_MAP[lang]?.[status]
    if (!src) return

    const audio = new Audio(src)
    audioRef.current = audio
    
    audio.onended = () => setIsPlaying(false)
    audio.onerror = () => {
      console.error("Audio file not found:", src)
      setIsPlaying(false)
      alert(lang === 'mr' ? 'ऑडिओ फाईल सापडली नाही. (Audio file missing)' : 'Audio file is missing. Please add it to public/audio/')
    }

    setIsPlaying(true)
    audio.play().catch(e => {
      console.error("Autoplay blocked or file error", e)
      setIsPlaying(false)
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
