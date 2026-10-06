import { useState } from 'react'
import { todaySummary, useWardData } from '../../lib/wardData'
import { fmtCoords, fmtTime, mapsLink, toDateInput } from '../../lib/format'
import { Avatar, Badge, Card, Empty, ErrorNote, PageLoader, inputCls } from '../../components/ui'

export default function SupervisorAttendance() {
  const { data, loading, error } = useWardData()
  const [date, setDate] = useState(toDateInput())
  const [preview, setPreview] = useState(null)

  if (loading) return <PageLoader />
  const { employees = [], attendance = [] } = data ?? {}
  const ref = new Date(`${date}T12:00:00`)

  const rows = employees.map((e) => ({ e, s: todaySummary(e.id, attendance, ref) }))
  const presentCount = rows.filter((r) => r.s.state !== 'ABSENT').length

  return (
    <div>
      <h1 className="mb-3 text-2xl font-bold">Attendance</h1>
      <ErrorNote>{error}</ErrorNote>

      <div className="mb-3 flex items-end justify-between gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">{t('sup_att.date')}</span>
          <input type="date" className={inputCls} max={toDateInput()} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <p className="pb-3 text-sm text-gray-600">
          <span className="font-bold text-green-600">{presentCount}</span> present ·{' '}
          <span className="font-bold text-red-600">{rows.length - presentCount}</span> absent
        </p>
      </div>

      {rows.length ? (
        <div className="space-y-3">
          {rows.map(({ e, s }) => (
            <Card key={e.id}>
              <div className="flex items-center gap-3">
                <button
                  disabled={!s.checkIn?.photo_url}
                  onClick={() => setPreview({ url: s.checkIn.photo_url, name: e.name })}
                  aria-label={`View ${e.name} selfie`}
                >
                  <Avatar name={e.name} src={s.checkIn?.photo_url} size="h-14 w-14" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {e.name}
                    {s.checkIn && (
                      <span className="text-xs font-normal text-gray-500 ml-1">
                        [<LocationLabel lat={s.checkIn.latitude} lng={s.checkIn.longitude} />]
                      </span>
                    )}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge value={s.state} label={s.state === 'PRESENT' ? t('sup_dash.present_badge') : s.state === 'OUT' ? t('sup_dash.out_badge') : t('sup_dash.absent_badge')} />
                    {s.flagged && <Badge value="FLAGGED" />}
                  </div>
                </div>
              </div>

              {s.checkIn ? (
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg bg-gray-50 p-3 text-sm">
                  <div>
                    <dt className="text-xs text-gray-500">{t('sup_att.check_in')}</dt>
                    <dd className="font-semibold">{fmtTime(s.checkIn.timestamp)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">{t('sup_att.check_out')}</dt>
                    <dd className="font-semibold">{s.checkOut ? fmtTime(s.checkOut.timestamp) : 'Not yet'}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs text-gray-500">{t('sup_att.location')}</dt>
                    <dd>
                      <a className="text-blue-600 underline" href={mapsLink(s.checkIn.latitude, s.checkIn.longitude)} target="_blank" rel="noreferrer">
                        <LocationLabel lat={s.checkIn.latitude} lng={s.checkIn.longitude} fallback={fmtCoords(s.checkIn.latitude, s.checkIn.longitude)} />
                      </a>
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-2 text-sm text-gray-500">{t('sup_att.no_checkin')}</p>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Empty>No employees yet.</Empty>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreview(null)} role="dialog" aria-label="Selfie">
          <div className="w-full max-w-sm rounded-2xl bg-white p-3" onClick={(e) => e.stopPropagation()}>
            <img src={preview.url} alt={`${preview.name} selfie`} className="w-full rounded-xl" />
            <p className="mt-2 text-center font-semibold">{preview.name}</p>
            <button className="mt-2 min-h-11 w-full rounded-xl border border-gray-300 font-semibold" onClick={() => setPreview(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
