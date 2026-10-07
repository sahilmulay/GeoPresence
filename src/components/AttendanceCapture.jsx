import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { getPosition, resizeBlob } from '../lib/device'
import { getDistance, GEOFENCE_RADIUS_M } from "../lib/geo"
import { Button, ErrorNote, Spinner } from './ui'
import { useLanguage } from '../context/LanguageContext'

// GPS accuracy worse than this (metres) is saved as FLAGGED for the supervisor to review.
const MAX_ACCURACY_M = 100

function playBlinkChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    const ctx = new AudioContext()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(587.33, now) // D5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.14) // A5
    gain.gain.setValueAtTime(0.18, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.32)
  } catch {
    // Autoplay or audio disabled
  }
}

/**
 * Full-screen attendance flow: live selfie -> liveness check (blink) -> GPS -> upload -> save.
 * type: 'CHECKIN' | 'CHECKOUT'
 */
export default function AttendanceCapture({ type, employeeId, tasks = [], onClose, onDone }) {
  const { t } = useLanguage()
  const isCheckin = type === 'CHECKIN'

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const fileRef = useRef(null)
  const posRef = useRef(null)
  const livenessHandledRef = useRef(false)

  const [step, setStep] = useState('camera') // camera | preview | saving | success
  const [camError, setCamError] = useState('')
  const [photo, setPhoto] = useState(null) // { blob, url }
  const [error, setError] = useState('')
  const [locState, setLocState] = useState('loading') // loading | ok | error

  // Liveness state: 'waiting' | 'detected'
  const [livenessState, setLivenessState] = useState('waiting')
  const [blinkVerified, setBlinkVerified] = useState(false)

  const label = isCheckin ? t('cap.check_in') : t('cap.check_out')

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  // Attach the live stream whenever the <video> element (re)mounts, e.g. after "Retake".
  const attachVideo = useCallback((el) => {
    videoRef.current = el
    if (el && streamRef.current && el.srcObject !== streamRef.current) el.srcObject = streamRef.current
  }, [])

  const fetchLocation = useCallback(() => {
    setLocState('loading')
    posRef.current = getPosition()
    posRef.current.then(
      () => setLocState('ok'),
      () => setLocState('error'),
    )
    posRef.current.catch(() => {}) // avoid unhandled rejection; handled on submit
  }, [])

  const startCamera = useCallback(async () => {
    setCamError('')
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera not available')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 960 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch {
      setCamError('Camera could not be opened. You can take a photo with your phone camera instead.')
    }
  }, [])

  useEffect(() => {
    fetchLocation()
    startCamera()
    return () => {
      stopCamera()
    }
  }, [fetchLocation, startCamera, stopCamera])

  useEffect(() => () => photo && URL.revokeObjectURL(photo.url), [photo])

  const takePhotoFromBlob = useCallback((blob) => {
    stopCamera()
    setPhoto({ blob, url: URL.createObjectURL(blob) })
    setStep('preview')
  }, [stopCamera])

  const capture = useCallback(() => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const c = document.createElement('canvas')
    c.width = v.videoWidth
    c.height = v.videoHeight
    c.getContext('2d').drawImage(v, 0, 0)
    c.toBlob((b) => b && takePhotoFromBlob(b), 'image/jpeg', 0.9)
  }, [takePhotoFromBlob])

  const handleBlinkVerified = useCallback(() => {
    if (livenessHandledRef.current) return
    livenessHandledRef.current = true
    setLivenessState('detected')
    setBlinkVerified(true)
    playBlinkChime()
    // Auto-capture selfie shortly after blink so eyes are open
    setTimeout(() => {
      capture()
    }, 450)
  }, [capture])

  // Liveness blink detection loop
  useEffect(() => {
    if (!isCheckin || step !== 'camera' || camError || livenessState === 'detected') return

    let animId
    let lastTime = 0
    const sampleInterval = 85 // ~12 fps
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    let prevEyeLuma = null
    let prevFhLuma = null
    let blinkCandidateTime = null

    const checkFrame = (timestamp) => {
      if (timestamp - lastTime >= sampleInterval) {
        lastTime = timestamp
        const v = videoRef.current
        if (v && v.readyState >= 2 && v.videoWidth > 0 && !livenessHandledRef.current) {
          try {
            ctx.drawImage(v, 0, 0, 64, 64)
            // Eye zone: y: 20 to 36 (16px), x: 16 to 48 (32px)
            const eyeData = ctx.getImageData(16, 20, 32, 16).data
            let eyeSum = 0
            for (let i = 0; i < eyeData.length; i += 4) {
              eyeSum += 0.299 * eyeData[i] + 0.587 * eyeData[i + 1] + 0.114 * eyeData[i + 2]
            }
            const eyeLuma = eyeSum / (32 * 16)

            // Forehead zone for baseline motion: y: 8 to 16 (8px), x: 20 to 44 (24px)
            const fhData = ctx.getImageData(20, 8, 24, 8).data
            let fhSum = 0
            for (let i = 0; i < fhData.length; i += 4) {
              fhSum += 0.299 * fhData[i] + 0.587 * fhData[i + 1] + 0.114 * fhData[i + 2]
            }
            const fhLuma = fhSum / (24 * 8)

            if (prevEyeLuma !== null && prevFhLuma !== null) {
              const eyeDelta = Math.abs(eyeLuma - prevEyeLuma)
              const fhDelta = Math.abs(fhLuma - prevFhLuma)

              // Localized eyelid difference spike while head motion remains calm
              const isEyeMotion = eyeDelta > 3.6 && (eyeDelta > fhDelta * 1.25 || fhDelta < 2.5)

              if (!blinkCandidateTime) {
                if (isEyeMotion) {
                  blinkCandidateTime = timestamp
                }
              } else {
                const diffMs = timestamp - blinkCandidateTime
                if (diffMs >= 100 && diffMs <= 650) {
                  // Reopening completed within normal blink range
                  handleBlinkVerified()
                  return
                } else if (diffMs > 650) {
                  blinkCandidateTime = null
                }
              }
            }

            prevEyeLuma = eyeLuma
            prevFhLuma = fhLuma
          } catch {
            // ignore canvas frame issues
          }
        }
      }
      animId = requestAnimationFrame(checkFrame)
    }

    animId = requestAnimationFrame(checkFrame)
    return () => cancelAnimationFrame(animId)
  }, [isCheckin, step, camError, livenessState, handleBlinkVerified])

  const retake = () => {
    livenessHandledRef.current = false
    setLivenessState('waiting')
    setBlinkVerified(false)
    setPhoto(null)
    setError('')
    setStep('camera')
    startCamera()
  }

  const submit = async () => {
    setError('')
    setStep('saving')
    try {
      const pos = await (locState === 'error' ? getPosition() : posRef.current)

      if (isCheckin) {
        const geofencedTasks = tasks.filter((t) => t.target_lat && t.target_lng && t.status !== 'COMPLETED')
        if (geofencedTasks.length > 0) {
          const isWithinAny = geofencedTasks.some((t) => {
            const dist = getDistance(pos.latitude, pos.longitude, t.target_lat, t.target_lng)
            return dist <= GEOFENCE_RADIUS_M
          })
          if (!isWithinAny) {
            throw new Error(`Geofence Error: You must be within ${GEOFENCE_RADIUS_M}m of an assigned task location.`)
          }
        }
      }

      const blob = await resizeBlob(photo.blob)
      await api.addAttendance({
        employee_id: employeeId,
        blob,
        latitude: pos.latitude,
        longitude: pos.longitude,
        check_type: type,
        status: pos.accuracy > MAX_ACCURACY_M ? 'FLAGGED' : 'PRESENT',
        is_live: isCheckin ? (blinkVerified || livenessState === 'detected') : true,
      })
      setStep('success')
      onDone?.()
    } catch (e) {
      setError(e.message)
      if (locState !== 'ok') fetchLocation()
      setStep('preview')
    }
  }

  const close = () => {
    stopCamera()
    livenessHandledRef.current = false
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white" role="dialog" aria-modal="true" aria-label={label}>
      <div className="flex h-14 items-center justify-between border-b border-gray-200 px-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold">{label}</h2>
          {isCheckin && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
              Liveness Check
            </span>
          )}
        </div>
        {step !== 'saving' && (
          <button onClick={close} className="min-h-10 px-2 text-sm font-semibold text-gray-600">
            {step === 'success' ? t('cap.close') : t('cap.cancel')}
          </button>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 overflow-y-auto p-4">
        {step === 'success' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
              <svg viewBox="0 0 24 24" className="h-10 w-10 text-green-600" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-green-700">{t('cap.success')}</h3>
            <p className="text-gray-600">{label} {t('cap.saved_msg')}</p>
            {isCheckin && blinkVerified && (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                <span>🛡️</span>
                <span>{t('cap.liveness_verified')}</span>
              </div>
            )}
            <Button variant="success" className="w-full" onClick={close}>
              {t('cap.done')}
            </Button>
          </div>
        ) : (
          <>
            <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-gray-200 bg-gray-900 shadow-inner">
              {step === 'camera' && !camError && (
                <>
                  <video ref={attachVideo} autoPlay playsInline muted className="h-full w-full object-cover" />

                  {/* Top floating liveness guidance banner */}
                  {isCheckin && (
                    <div className="pointer-events-none absolute top-3 left-3 right-3 z-20 flex justify-center">
                      <div
                        className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur transition-all duration-300 ${
                          livenessState === 'detected'
                            ? 'border border-emerald-400 bg-emerald-600/95 scale-105'
                            : 'border border-amber-300/40 bg-black/75 animate-pulse'
                        }`}
                      >
                        <span className="text-sm">{livenessState === 'detected' ? '✅' : '👁️'}</span>
                        <span className="tracking-wide">
                          {livenessState === 'detected' ? t('cap.liveness_verified') : t('cap.liveness_prompt')}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Centered face oval guide */}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div
                      className={`h-56 w-44 rounded-full border-2 transition-all duration-300 ${
                        livenessState === 'detected'
                          ? 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_24px_rgba(52,211,153,0.35)]'
                          : 'border-white/50 border-dashed'
                      }`}
                    />
                  </div>
                </>
              )}

              {step !== 'camera' && photo && (
                <>
                  <img src={photo.url} alt="Your selfie" className="h-full w-full object-cover" />
                  {isCheckin && blinkVerified && (
                    <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-emerald-600/95 px-3 py-1.5 text-xs font-bold text-white shadow-md backdrop-blur border border-emerald-300/50">
                      <span>✅</span>
                      <span>{t('cap.liveness_verified')}</span>
                    </div>
                  )}
                </>
              )}

              {step === 'camera' && camError && (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-white">
                  <p className="text-sm">{camError}</p>
                </div>
              )}

              {step === 'saving' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/85 backdrop-blur-sm">
                  <Spinner />
                  <p className="font-semibold text-gray-800">{t('cap.saving')}</p>
                </div>
              )}
            </div>

            {/* In-camera Liveness Action Bar (shows prompt and manual "I Blinked" fallback) */}
            {isCheckin && step === 'camera' && !camError && (
              <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-950 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-200/90 text-base shrink-0">
                    👁️
                  </div>
                  <div>
                    <div className="font-bold text-amber-900">{t('cap.liveness_title')}</div>
                    <div className="text-amber-800/90 leading-tight">{t('cap.liveness_prompt')}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleBlinkVerified}
                  className="ml-2 shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 font-bold text-white shadow hover:bg-amber-700 active:scale-95 transition-all"
                >
                  {t('cap.blink_btn')}
                </button>
              </div>
            )}

            <div
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                locState === 'ok'
                  ? 'border-green-200 bg-green-50 text-green-800'
                  : locState === 'error'
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : 'border-gray-200 bg-gray-50 text-gray-700'
              }`}
            >
              {locState === 'loading' && <Spinner small />}
              <span>
                {locState === 'ok' && t('cap.loc_ready')}
                {locState === 'loading' && t('cap.loc_loading')}
                {locState === 'error' && t('cap.loc_error')}
              </span>
              {locState === 'error' && (
                <button className="ml-auto font-semibold underline" onClick={fetchLocation}>
                  {t('cap.retry')}
                </button>
              )}
            </div>

            <ErrorNote>{error}</ErrorNote>

            <div className="mt-auto space-y-3 pb-[env(safe-area-inset-bottom)]">
              {step === 'camera' && (
                <>
                  {!camError && (
                    <Button className="w-full" onClick={capture}>
                      {t('cap.take_selfie')}
                    </Button>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    capture="user"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        setBlinkVerified(true)
                        takePhotoFromBlob(file)
                      }
                    }}
                  />
                  <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
                    {camError ? t('cap.open_cam') : t('cap.use_app')}
                  </Button>
                </>
              )}
              {(step === 'preview' || step === 'saving') && (
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" onClick={retake} disabled={step === 'saving'}>
                    {t('cap.retake')}
                  </Button>
                  <Button variant={isCheckin ? 'success' : 'danger'} onClick={submit} loading={step === 'saving'}>
                    {t('cap.confirm')} {label}
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
