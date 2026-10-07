import { useState, useRef } from 'react'
import { Button, ErrorNote, Spinner } from './ui'
import { resizeBlob } from '../lib/device'
import { api } from '../lib/api'
import { useLanguage } from '../context/LanguageContext'

export default function TaskPhotoModal({ task, employeeId, employeeName, onClose, onSuccess }) {
  const { t } = useLanguage()
  const fileInputRef = useRef(null)

  const [blob, setBlob] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setBlob(file)
    setPreviewUrl(URL.createObjectURL(file))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!blob) {
      setError('Please select or capture a photo first.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const resized = await resizeBlob(blob, 1200)
      await api.addTaskPhoto({
        taskId: task.id,
        blob: resized,
        caption: caption.trim(),
        employeeId,
        employeeName,
      })
      onSuccess?.()
      onClose?.()
    } catch (err) {
      setError(err.message || 'Failed to upload photo')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-gray-900">{t('tasks.add_photo_title')}</h3>
            <p className="text-xs text-gray-500 truncate max-w-[260px]">Task: {task.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />

          {previewUrl ? (
            <div className="relative aspect-4/3 w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-900 shadow-inner">
              <img src={previewUrl} alt="Work preview" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-2 right-2 rounded-lg bg-black/75 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur shadow hover:bg-black"
              >
                Retake / Change
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex aspect-4/3 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-6 text-center transition-colors hover:border-blue-500 hover:bg-blue-50/50"
            >
              <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-2xl text-blue-600">
                📸
              </div>
              <p className="text-sm font-semibold text-gray-800">Tap to Take Photo or Upload</p>
              <p className="mt-1 text-xs text-gray-500">Take a photo of ongoing or completed work</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              {t('tasks.photo_caption')}
            </label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={t('tasks.photo_caption_ph')}
              className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-hidden"
              maxLength={150}
            />
          </div>

          <ErrorNote>{error}</ErrorNote>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              loading={busy}
              disabled={!blob || busy}
            >
              {t('tasks.upload_btn')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
