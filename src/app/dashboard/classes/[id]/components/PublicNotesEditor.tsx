'use client'

import { useRef, useState, useEffect, useTransition } from 'react'
import { Bold, Italic, Underline, Save, Check, ArrowUp, ArrowDown } from 'lucide-react'
import { savePublicNotes } from '@/app/actions'

const COLORS = [
  { label: 'Default', value: '' },
  { label: 'Red', value: '#dc2626' },
  { label: 'Orange', value: '#ea580c' },
  { label: 'Yellow', value: '#ca8a04' },
  { label: 'Green', value: '#16a34a' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Purple', value: '#9333ea' },
  { label: 'Gray', value: '#6b7280' },
]

interface Props {
  classId: string
  initialNotes: string | null
  initialPosition: 'above' | 'below' | null
}

export default function PublicNotesEditor({ classId, initialNotes, initialPosition }: Props) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [activeColor, setActiveColor] = useState('')
  const [position, setPosition] = useState<'above' | 'below'>(initialPosition ?? 'below')

  useEffect(() => {
    if (editorRef.current && initialNotes) {
      editorRef.current.innerHTML = initialNotes
    }
  }, [initialNotes])

  function exec(command: string, value?: string) {
    editorRef.current?.focus()
    document.execCommand(command, false, value)
  }

  function handleColorChange(color: string) {
    setActiveColor(color)
    if (color) {
      exec('foreColor', color)
    } else {
      exec('removeFormat')
    }
    editorRef.current?.focus()
  }

  function handleSave() {
    const html = editorRef.current?.innerHTML ?? ''
    startTransition(async () => {
      await savePublicNotes(classId, html, position)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  return (
    <div className="space-y-3">
      {/* Position toggle */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Show notes:</span>
        <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--color-border)' }}>
          <button
            onClick={() => setPosition('above')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              backgroundColor: position === 'above' ? '#0BB5C7' : 'var(--color-bg)',
              color: position === 'above' ? '#fff' : 'var(--color-text-secondary)',
            }}
          >
            <ArrowUp size={11} />
            Above schedule
          </button>
          <button
            onClick={() => setPosition('below')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              backgroundColor: position === 'below' ? '#0BB5C7' : 'var(--color-bg)',
              color: position === 'below' ? '#fff' : 'var(--color-text-secondary)',
              borderLeft: '1px solid var(--color-border)',
            }}
          >
            <ArrowDown size={11} />
            Below schedule
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 flex-wrap p-2 rounded-xl border"
        style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>

        {/* Format buttons */}
        <button
          onMouseDown={e => { e.preventDefault(); exec('bold') }}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors"
          title="Bold"
        >
          <Bold size={14} style={{ color: 'var(--color-text-primary)' }} />
        </button>
        <button
          onMouseDown={e => { e.preventDefault(); exec('italic') }}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors"
          title="Italic"
        >
          <Italic size={14} style={{ color: 'var(--color-text-primary)' }} />
        </button>
        <button
          onMouseDown={e => { e.preventDefault(); exec('underline') }}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors"
          title="Underline"
        >
          <Underline size={14} style={{ color: 'var(--color-text-primary)' }} />
        </button>

        {/* Divider */}
        <div className="w-px h-5 mx-1" style={{ backgroundColor: 'var(--color-border)' }} />

        {/* Color swatches */}
        {COLORS.map(c => (
          <button
            key={c.value}
            onMouseDown={e => { e.preventDefault(); handleColorChange(c.value) }}
            className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
            style={{
              backgroundColor: c.value || 'var(--color-text-primary)',
              borderColor: activeColor === c.value ? '#0BB5C7' : 'transparent',
            }}
            title={c.label}
          />
        ))}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={isPending}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{
            backgroundColor: saved ? '#16a34a' : '#0BB5C7',
            color: '#fff',
            opacity: isPending ? 0.7 : 1,
          }}
        >
          {saved ? <Check size={13} /> : <Save size={13} />}
          {saved ? 'Saved!' : isPending ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Add notes for students here... These will appear on the public schedule link."
        className="min-h-[120px] p-4 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[#0BB5C7]/30 public-notes-editor"
        style={{
          backgroundColor: 'var(--color-bg)',
          borderColor: 'var(--color-border)',
          color: 'var(--color-text-primary)',
          lineHeight: '1.6',
        }}
      />

      <style>{`
        .public-notes-editor:empty:before {
          content: attr(data-placeholder);
          color: var(--color-text-muted);
          pointer-events: none;
        }
      `}</style>

      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        These notes appear on the public schedule link visible to students.
      </p>
    </div>
  )
}
