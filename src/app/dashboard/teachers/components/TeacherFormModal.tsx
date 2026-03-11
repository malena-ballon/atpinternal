'use client'

import { useState } from 'react'
import { Loader2, Plus, Minus } from 'lucide-react'
import Modal from '@/app/dashboard/components/Modal'
import type { TeacherRow, AvailabilityEntry } from '@/types'
import { saveTeacher, logActivity } from '@/app/actions'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: '10px',
  border: '1px solid var(--color-border)',
  backgroundColor: 'var(--color-bg)',
  color: 'var(--color-text-primary)',
  fontSize: '14px',
  outline: 'none',
}

const timeStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: '8px',
  border: '1px solid var(--color-border)',
  backgroundColor: 'var(--color-bg)',
  color: 'var(--color-text-primary)',
  fontSize: '13px',
  outline: 'none',
}

interface Props {
  teacher?: TeacherRow
  onClose: () => void
  onSaved: (teacher: TeacherRow) => void
}

export default function TeacherFormModal({ teacher, onClose, onSaved }: Props) {
  const isEdit = !!teacher

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState(teacher?.name ?? '')
  const [email, setEmail] = useState(teacher?.email ?? '')
  const [specialization, setSpecialization] = useState(teacher?.specialization ?? '')
  const [availability, setAvailability] = useState<AvailabilityEntry[]>(
    teacher?.availability ?? []
  )

  // Helpers — work on a flat array where multiple entries can share the same day
  const isDayActive = (day: string) => availability.some(e => e.day === day)
  const daySlots = (day: string) => availability.filter(e => e.day === day)

  function toggleDay(day: string) {
    setAvailability(prev =>
      prev.some(e => e.day === day)
        ? prev.filter(e => e.day !== day)
        : [...prev, { day, start: '09:00', end: '17:00' }]
    )
  }

  function addSlot(day: string) {
    setAvailability(prev => [...prev, { day, start: '09:00', end: '17:00' }])
  }

  // Remove the nth slot for a given day (by counting only entries with that day)
  function removeSlot(day: string, slotIndex: number) {
    setAvailability(prev => {
      let count = 0
      return prev.filter(e => {
        if (e.day !== day) return true
        return count++ !== slotIndex
      })
    })
  }

  // Update start or end of the nth slot for a given day
  function updateSlot(day: string, slotIndex: number, field: 'start' | 'end', value: string) {
    setAvailability(prev => {
      let count = 0
      return prev.map(e => {
        if (e.day !== day) return e
        return count++ === slotIndex ? { ...e, [field]: value } : e
      })
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim()) {
      setError('Name and email are required.')
      return
    }
    setError('')
    setLoading(true)

    const payload = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      specialization: specialization.trim() || null,
      availability: availability.length > 0 ? availability : null,
    }

    const { data, error: err } = await saveTeacher(payload, teacher?.id)

    if (err) { setLoading(false); setError(err); return }

    // Log the activity
    await logActivity(
      isEdit ? 'updated_profile' : 'added_teacher',
      'teacher',
      data!.id,
      payload.name,
      isEdit
        ? `Updated teacher profile: ${payload.name}`
        : `Added new teacher: ${payload.name}`
    )

    setLoading(false)
    onSaved(data as TeacherRow)
  }

  return (
    <Modal title={isEdit ? 'Edit Teacher' : 'Add Teacher'} onClose={onClose} width="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="text-sm p-3 rounded-lg" style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: 'var(--color-danger)' }}>
            {error}
          </div>
        )}

        {/* Basic info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              Full Name <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input style={inputStyle} type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Juan Dela Cruz" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              Email <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="teacher@example.com" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Specialization</label>
            <input style={inputStyle} type="text" value={specialization} onChange={e => setSpecialization(e.target.value)} placeholder="e.g. Mathematics, Physics" />
          </div>
        </div>

        {/* Availability */}
        <div>
          <label className="block text-sm font-medium mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            Availability
            <span className="ml-1.5 text-xs font-normal" style={{ color: 'var(--color-text-muted)' }}>
              — check a day, add multiple time slots if needed
            </span>
          </label>
          <div
            className="rounded-xl p-4 space-y-3"
            style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
          >
            {DAYS.map(day => {
              const active = isDayActive(day)
              const slots = daySlots(day)
              return (
                <div key={day}>
                  {/* Day toggle row */}
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => toggleDay(day)}
                      className="rounded"
                      style={{ accentColor: '#0BB5C7' }}
                    />
                    <span
                      className="text-sm font-medium w-28"
                      style={{ color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}
                    >
                      {day}
                    </span>
                    {!active && (
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Not available</span>
                    )}
                  </label>

                  {/* Time slots — indented under the day */}
                  {active && (
                    <div className="ml-8 mt-2 space-y-1.5">
                      {slots.map((slot, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="time"
                            value={slot.start}
                            onChange={e => updateSlot(day, idx, 'start', e.target.value)}
                            style={timeStyle}
                          />
                          <span className="text-xs shrink-0" style={{ color: 'var(--color-text-muted)' }}>to</span>
                          <input
                            type="time"
                            value={slot.end}
                            onChange={e => updateSlot(day, idx, 'end', e.target.value)}
                            style={timeStyle}
                          />

                          {/* Remove slot button (only if there's more than one slot) */}
                          {slots.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeSlot(day, idx)}
                              className="w-6 h-6 flex items-center justify-center rounded-md"
                              style={{ color: 'var(--color-danger)', border: '1px solid var(--color-border)' }}
                              title="Remove this slot"
                            >
                              <Minus size={11} />
                            </button>
                          )}

                          {/* Add slot button (only on the last slot) */}
                          {idx === slots.length - 1 && (
                            <button
                              type="button"
                              onClick={() => addSlot(day)}
                              className="flex items-center gap-1 px-2 h-6 text-xs rounded-md"
                              style={{ color: '#0BB5C7', border: '1px solid rgba(11,181,199,0.3)' }}
                              title="Add another time slot"
                            >
                              <Plus size={11} /> Add slot
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-xl"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl text-white disabled:opacity-60"
            style={{ backgroundColor: '#0BB5C7' }}>
            {loading && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? 'Save Changes' : 'Add Teacher'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
