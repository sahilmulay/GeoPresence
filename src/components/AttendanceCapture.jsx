import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { getPosition, resizeBlob } from '../lib/device'
import { getDistance, GEOFENCE_RADIUS_M } from "../lib/geo"
import { Button, ErrorNote, Spinner } from './ui'
import { useLanguage } from '../context/LanguageContext'

// GPS accuracy worse than this (metres) is saved as FLAGGED for the supervisor to review.
const MAX_ACCURACY_M = 100

/**
 * Full-screen attendance flow: live selfie -> GPS -> upload -> save.
 * type: 'CHECKIN' | 'CHECKOUT'
 */
export default function AttendanceCapture({ type, employeeId, tasks = [], onClose, onDone }) {
  const { t } = useLanguage()
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const fileRef = useRef(null)
  const posRef = useRef(null)

  const [step, setStep] = useState('camera') // camera | preview | saving | success
  const [camError, setCamError] = useState('')
  const [photo, setPhoto] = useState(null) // { blob, url }
  const [error, setError] = useState('')
  const [locState, setLocState] = useState('loading') // loading | ok | error

  const label = type === 'CHECKIN' ? t('cap.check_in') : t('cap.check_out')

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
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

  const takePhotoFromBlob = (blob) => {
    stopCamera()
    setPhoto({ blob, url: URL.createObjectURL(blob) })
    setStep('preview')
  }

  const capture = () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const c = document.createElement('canvas')
    c.width = v.videoWidth
    c.height = v.videoHeight
    c.getContext('2d').drawImage(v, 0, 0)
    c.toBlob((b) => b && takePhotoFromBlob(b), 'image/jpeg', 0.9)
  }

  const retake = () => {
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
      
      if (type === 'CHECKIN') {
        const geofencedTasks = tasks.filter(t => t.target_lat && t.target_lng && t.status !== 'COMPLETED')
        if (geofencedTasks.length > 0) {
          const isWithinAny = geofencedTasks.some(t => {
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
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white" role="dialog" aria-modal="true" aria-label={label}>
      <div className="flex h-14 items-center justify-between border-b border-gray-200 px-4">
        <h2 className="text-lg font-bold">{label}</h2>
        {step !== 'saving' && (
          <button onClick={close} className="min-h-10 px-2 text-sm font-semibold text-gray-600">
            {step === 'success' ? 'Close' : 'Cancel'}
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
            <Button variant="success" className="w-full" onClick={close}>
              Done
            </Button>
          </div>
        ) : (
          <>
            <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-gray-200 bg-gray-900">
              {step === 'camera' && !camError && (
                <video ref={attachVideo} autoPlay playsInline muted className="h-full w-full object-cover" />
              )}
              {step !== 'camera' && photo && <img src={photo.url} alt="Your selfie" className="h-full w-full object-cover" />}
              {step === 'camera' && camError && (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-white">
                  <p className="text-sm">{camError}</p>
                </div>
              )}
              {step === 'saving' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/80">
                  <Spinner />
                  <p className="font-semibold">{t('cap.saving')}</p>
                </div>
              )}
            </div>

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
                  Retry
                </button>
              )}
            </div>

            <ErrorNote>{error}</ErrorNote>

            <div className="mt-auto space-y-3 pb-[env(safe-area-inset-bottom)]">
              {step === 'camera' && (
                <>
                  {!camError && (
                    <Button className="w-full" onClick={capture}>
                      Take Selfie
                    </Button>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    capture="user"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && takePhotoFromBlob(e.target.files[0])}
                  />
                  <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
                    {camError ? t('cap.open_cam') : t('cap.use_app')}
                  </Button>
                </>
              )}
              {(step === 'preview' || step === 'saving') && (
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" onClick={retake} disabled={step === 'saving'}>
                    Retake
                  </Button>
                  <Button variant={type === 'CHECKIN' ? 'success' : 'danger'} onClick={submit} loading={step === 'saving'}>
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
