import { useState } from 'react'
import { fmtTime, fmtDate } from '../lib/format'

export default function TaskPhotoViewer({ photos = [], title = 'Work Photos', canAdd = false, onAddClick }) {
  const [activePhoto, setActivePhoto] = useState(null)

  if ((!photos || photos.length === 0) && !canAdd) {
    return null
  }

  return (
    <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50/75 p-2.5">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">📸</span>
          <span className="text-xs font-bold text-gray-800">{title}</span>
          {photos.length > 0 && (
            <span className="rounded-full bg-blue-100 px-2 py-0.2 text-[10px] font-bold text-blue-700">
              {photos.length}
            </span>
          )}
        </div>
        {canAdd && (
          <button
            type="button"
            onClick={onAddClick}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 active:scale-95 transition-all"
          >
            <span>+</span>
            <span>Add Photo</span>
          </button>
        )}
      </div>

      {photos.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
          {photos.map((photo, idx) => (
            <button
              type="button"
              key={photo.id || idx}
              onClick={() => setActivePhoto(photo)}
              className="group relative h-20 w-24 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-900 shadow-2xs hover:ring-2 hover:ring-blue-500 focus:outline-hidden"
            >
              <img
                src={photo.url}
                alt={photo.caption || 'Work photo'}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
              {photo.timestamp && (
                <div className="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-[9px] font-semibold text-white truncate text-center">
                  {fmtTime(photo.timestamp)}
                </div>
              )}
            </button>
          ))}
        </div>
      ) : (
        <p className="py-1 text-xs text-gray-500 italic">No photos uploaded yet for this task.</p>
      )}

      {/* Lightbox Modal */}
      {activePhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs"
          onClick={() => setActivePhoto(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative max-h-[90vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-4/3 w-full bg-black">
              <img
                src={activePhoto.url}
                alt={activePhoto.caption || 'Work photo'}
                className="h-full w-full object-contain"
              />
              <button
                type="button"
                onClick={() => setActivePhoto(null)}
                className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="font-semibold text-gray-800">
                  {activePhoto.employee_name ? `Uploaded by ${activePhoto.employee_name}` : 'Field Worker Photo'}
                </span>
                <span>
                  {activePhoto.timestamp ? `${fmtDate(activePhoto.timestamp)} · ${fmtTime(activePhoto.timestamp)}` : ''}
                </span>
              </div>
              {activePhoto.caption && (
                <p className="mt-2 text-sm text-gray-800 font-medium bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                  "{activePhoto.caption}"
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
