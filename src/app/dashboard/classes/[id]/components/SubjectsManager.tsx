'use client'

import { useState, useRef } from 'react'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import type { SubjectRow } from '@/types'

interface Props {
  classId: string
  initialSubjects: SubjectRow[]
}

export default function SubjectsManager({ classId, initialSubjects }: Props) {
  const [subjects, setSubjects] = useState<SubjectRow[]>(initialSubjects)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  async function handleAdd() {
    const name = newName.trim()
    if (!name) return
    setAdding(true)
    setSuggestions([])
    setShowSuggestions(false)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('subjects')
      .insert({ class_id: classId, name })
      .select()
      .single()
    setAdding(false)
    if (!error && data) {
      setSubjects(prev => [...prev, data as SubjectRow])
      setNewName('')
    }
  }

  async function handleRemove(id: string) {
    setRemovingId(id)
    const supabase = createClient()
    await supabase.from('subjects').delete().eq('id', id)
    setSubjects(prev => prev.filter(s => s.id !== id))
    setRemovingId(null)
  }

  function handleInputChange(val: string) {
    setNewName(val)
    clearTimeout(debounceRef.current)
    if (!val.trim()) { setSuggestions([]); setShowSuggestions(false); return }
    debounceRef.current = setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('subjects')
        .select('name')
        .ilike('name', `%${val.trim()}%`)
        .limit(10)
      if (!data) return
      const existing = new Set(subjects.map(s => s.name.toLowerCase()))
      const deduped = [...new Set(data.map((r: { name: string }) => r.name))]
        .filter(n => !existing.has(n.toLowerCase()))
        .slice(0, 6)
      setSuggestions(deduped)
      setShowSuggestions(deduped.length > 0)
    }, 300)
  }

  function pickSuggestion(name: string) {
    setNewName(name)
    setSuggestions([])
    setShowSuggestions(false)
  }

  return (
    <div>
      {/* Subject list */}
      <div className="space-y-2 mb-4">
        {subjects.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No subjects added yet.</p>
        ) : (
          subjects.map(s => (
            <div
              key={s.id}
              className="flex items-center justify-between px-4 py-2.5 rounded-xl"
              style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
            >
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{s.name}</span>
              <button
                onClick={() => handleRemove(s.id)}
                disabled={removingId === s.id}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors disabled:opacity-40"
                style={{ color: 'var(--color-danger)' }}
              >
                {removingId === s.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              </button>
            </div>
          ))
        )}
      </div>

      {/* Add input + autocomplete */}
      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={newName}
            onChange={e => handleInputChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); handleAdd() }
              if (e.key === 'Escape') { setSuggestions([]); setShowSuggestions(false) }
            }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Add a subject..."
            className="w-full px-3 py-2 text-sm rounded-xl outline-none"
            style={{
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg)',
              color: 'var(--color-text-primary)',
            }}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div
              className="absolute left-0 right-0 top-full mt-1 rounded-xl overflow-hidden z-20"
              style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
            >
              <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
                Existing subjects
              </div>
              {suggestions.map(name => (
                <button
                  key={name}
                  type="button"
                  onMouseDown={() => pickSuggestion(name)}
                  className="w-full text-left px-3 py-2 text-sm transition-colors"
                  style={{ color: 'var(--color-text-primary)' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(11,181,199,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={handleAdd}
          disabled={adding || !newName.trim()}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl text-white disabled:opacity-50"
          style={{ backgroundColor: '#0BB5C7' }}
        >
          {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Add
        </button>
      </div>
    </div>
  )
}
