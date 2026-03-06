'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Pin, Trash2, Loader2, Search, X, Check, BookOpen } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { formatDistanceToNow } from 'date-fns'

export interface NoteRow {
  id: string
  user_id: string
  title: string
  content: string
  category: string
  is_pinned: boolean
  created_at: string
  updated_at: string
}

const DEFAULT_CATEGORIES = ['Ideas', 'To-Do', 'Class Notes', 'General']

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  'Ideas':       { bg: 'rgba(139,92,246,0.12)', text: '#7C3AED' },
  'To-Do':       { bg: 'rgba(245,158,11,0.12)',  text: '#D97706' },
  'Class Notes': { bg: 'rgba(11,181,199,0.12)',   text: '#0BB5C7' },
  'General':     { bg: 'rgba(107,114,128,0.12)',  text: '#6B7280' },
}

function getCatStyle(cat: string) {
  return CATEGORY_COLORS[cat] ?? { bg: 'rgba(61,212,230,0.12)', text: '#0BB5C7' }
}

const STORAGE_KEY = 'notebook_custom_categories'
function loadCustomCats(): string[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}
function saveCustomCats(cats: string[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cats)) } catch {}
}

interface Props {
  initialNotes: NoteRow[]
  userId: string
}

export default function NotebookClient({ initialNotes, userId }: Props) {
  const [notes, setNotes] = useState<NoteRow[]>(initialNotes)
  const [selectedId, setSelectedId] = useState<string | null>(initialNotes[0]?.id ?? null)
  const [activeCategory, setActiveCategory] = useState('All')
  const [customCats, setCustomCats] = useState<string[]>([])
  const [showAddCat, setShowAddCat] = useState(false)
  const [newCatInput, setNewCatInput] = useState('')
  const [searchQ, setSearchQ] = useState('')

  // Editor state
  const [editTitle, setEditTitle] = useState(initialNotes[0]?.title ?? '')
  const [editContent, setEditContent] = useState(initialNotes[0]?.content ?? '')
  const [editCategory, setEditCategory] = useState(initialNotes[0]?.category ?? 'General')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [creating, setCreating] = useState(false)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const selectedNote = notes.find(n => n.id === selectedId) ?? null

  useEffect(() => {
    setCustomCats(loadCustomCats())
  }, [])

  // Sync editor when note selection changes
  useEffect(() => {
    if (selectedNote) {
      setEditTitle(selectedNote.title)
      setEditContent(selectedNote.content)
      setEditCategory(selectedNote.category)
      setDeleteConfirm(false)
      setSaveStatus('idle')
    }
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  // All categories: defaults + custom + any from existing notes
  const noteCats = Array.from(new Set(notes.map(n => n.category)))
  const allCategories = Array.from(new Set([...DEFAULT_CATEGORIES, ...customCats, ...noteCats]))

  const filteredNotes = notes
    .filter(n => activeCategory === 'All' || n.category === activeCategory)
    .filter(n => !searchQ || n.title.toLowerCase().includes(searchQ.toLowerCase()) || n.content.toLowerCase().includes(searchQ.toLowerCase()))
    .sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })

  function triggerSave(noteId: string, title: string, content: string, category: string) {
    clearTimeout(saveTimerRef.current)
    setSaveStatus('saving')
    saveTimerRef.current = setTimeout(async () => {
      const supabase = createClient()
      const now = new Date().toISOString()
      await supabase.from('notes').update({ title, content, category, updated_at: now }).eq('id', noteId)
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, title, content, category, updated_at: now } : n))
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(s => s === 'saved' ? 'idle' : s), 2000)
    }, 1000)
  }

  function handleTitleChange(val: string) {
    setEditTitle(val)
    if (selectedId) triggerSave(selectedId, val, editContent, editCategory)
  }

  function handleContentChange(val: string) {
    setEditContent(val)
    if (selectedId) triggerSave(selectedId, editTitle, val, editCategory)
  }

  async function handleCategoryChange(val: string) {
    setEditCategory(val)
    if (!selectedId) return
    clearTimeout(saveTimerRef.current)
    const supabase = createClient()
    await supabase.from('notes').update({ category: val }).eq('id', selectedId)
    setNotes(prev => prev.map(n => n.id === selectedId ? { ...n, category: val } : n))
  }

  async function handleNewNote() {
    setCreating(true)
    const supabase = createClient()
    const { data } = await supabase.from('notes').insert({
      user_id: userId,
      title: 'Untitled',
      content: '',
      category: activeCategory === 'All' ? 'General' : activeCategory,
      is_pinned: false,
    }).select().single()
    if (data) {
      const note = data as NoteRow
      setNotes(prev => [note, ...prev])
      setSelectedId(note.id)
    }
    setCreating(false)
  }

  async function handleTogglePin() {
    if (!selectedNote) return
    const newPinned = !selectedNote.is_pinned
    const supabase = createClient()
    await supabase.from('notes').update({ is_pinned: newPinned }).eq('id', selectedNote.id)
    setNotes(prev => prev.map(n => n.id === selectedNote.id ? { ...n, is_pinned: newPinned } : n))
  }

  async function handleDelete() {
    if (!selectedNote) return
    const supabase = createClient()
    await supabase.from('notes').delete().eq('id', selectedNote.id)
    const remaining = notes.filter(n => n.id !== selectedNote.id)
    setNotes(remaining)
    setSelectedId(remaining[0]?.id ?? null)
    setDeleteConfirm(false)
  }

  function handleAddCategory() {
    const cat = newCatInput.trim()
    if (!cat || allCategories.includes(cat)) return
    const updated = [...customCats, cat]
    setCustomCats(updated)
    saveCustomCats(updated)
    setNewCatInput('')
    setShowAddCat(false)
    setActiveCategory(cat)
  }

  function selectNote(note: NoteRow) {
    clearTimeout(saveTimerRef.current)
    if (selectedId && selectedNote) {
      // Flush any unsaved changes immediately before switching
      const supabase = createClient()
      const now = new Date().toISOString()
      supabase.from('notes').update({ title: editTitle, content: editContent, category: editCategory, updated_at: now }).eq('id', selectedId)
      setNotes(prev => prev.map(n => n.id === selectedId ? { ...n, title: editTitle, content: editContent, category: editCategory, updated_at: now } : n))
    }
    setSelectedId(note.id)
  }

  const inputStyle: React.CSSProperties = {
    padding: '6px 10px',
    borderRadius: '10px',
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-text-primary)',
    fontSize: '13px',
    outline: 'none',
  }

  return (
    <div className="flex gap-0" style={{ height: 'calc(100vh - 64px - 64px)', minHeight: 0 }}>

      {/* ── Left: Category sidebar ─────────────────────────────────────── */}
      <div className="flex flex-col shrink-0" style={{ width: '185px', paddingRight: '16px' }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>
          Notebooks
        </p>
        <nav className="space-y-0.5 flex-1 overflow-y-auto">
          {['All', ...allCategories].map(cat => {
            const isActive = activeCategory === cat
            const count = cat === 'All' ? notes.length : notes.filter(n => n.category === cat).length
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="w-full text-left flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all"
                style={{
                  backgroundColor: isActive ? 'rgba(61,212,230,0.1)' : 'transparent',
                  color: isActive ? '#0BB5C7' : 'var(--color-text-secondary)',
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                <span className="truncate">{cat}</span>
                <span className="text-xs ml-1 shrink-0" style={{ color: 'var(--color-text-muted)' }}>{count}</span>
              </button>
            )
          })}
        </nav>

        {/* Add category */}
        <div className="mt-3">
          {showAddCat ? (
            <div className="space-y-1.5">
              <input
                autoFocus
                value={newCatInput}
                onChange={e => setNewCatInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAddCategory()
                  if (e.key === 'Escape') { setShowAddCat(false); setNewCatInput('') }
                }}
                placeholder="Category name"
                style={{ ...inputStyle, width: '100%', fontSize: '12px', padding: '5px 8px' }}
              />
              <div className="flex gap-1">
                <button onClick={handleAddCategory}
                  className="flex-1 py-1 text-xs rounded-lg text-white font-medium"
                  style={{ backgroundColor: '#0BB5C7' }}>
                  Add
                </button>
                <button onClick={() => { setShowAddCat(false); setNewCatInput('') }}
                  className="px-2 py-1 text-xs rounded-lg"
                  style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                  <X size={11} />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddCat(true)}
              className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg w-full transition-colors"
              style={{ color: 'var(--color-text-muted)', border: '1px dashed var(--color-border)' }}
            >
              <Plus size={11} /> Add Category
            </button>
          )}
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: '1px', backgroundColor: 'var(--color-border)', marginRight: '20px', flexShrink: 0 }} />

      {/* ── Middle: Notes list ─────────────────────────────────────────── */}
      <div className="flex flex-col shrink-0 overflow-hidden" style={{ width: '275px', marginRight: '20px' }}>
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {activeCategory === 'All' ? 'All Notes' : activeCategory}
          </h2>
          <button
            onClick={handleNewNote}
            disabled={creating}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg text-white disabled:opacity-60"
            style={{ backgroundColor: '#0BB5C7' }}
          >
            {creating ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
            New
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            placeholder="Search notes…"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            style={{ ...inputStyle, width: '100%', paddingLeft: '28px' }}
          />
        </div>

        {/* Note cards */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
          {filteredNotes.length === 0 && (
            <div className="py-12 text-center space-y-3">
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {searchQ ? 'No notes match.' : 'No notes yet.'}
              </p>
              {!searchQ && (
                <button onClick={handleNewNote}
                  className="text-xs px-3 py-1.5 rounded-lg text-white"
                  style={{ backgroundColor: '#0BB5C7' }}>
                  + New Note
                </button>
              )}
            </div>
          )}
          {filteredNotes.map(note => {
            const isSelected = note.id === selectedId
            const preview = note.content.replace(/\n+/g, ' ').trim().slice(0, 100)
            const catStyle = getCatStyle(note.category)
            return (
              <button
                key={note.id}
                onClick={() => selectNote(note)}
                className="w-full text-left p-3 rounded-xl transition-all"
                style={{
                  backgroundColor: isSelected ? 'rgba(61,212,230,0.07)' : 'var(--color-surface)',
                  border: `1px solid ${isSelected ? 'rgba(61,212,230,0.35)' : 'var(--color-border)'}`,
                  boxShadow: isSelected ? '0 0 0 2px rgba(61,212,230,0.08)' : '0 1px 2px rgba(0,0,0,0.04)',
                }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  {note.is_pinned && <Pin size={10} style={{ color: '#F59E0B', flexShrink: 0 }} />}
                  <span className="text-sm font-semibold truncate flex-1" style={{ color: 'var(--color-text-primary)' }}>
                    {note.title || 'Untitled'}
                  </span>
                </div>
                {preview && (
                  <p className="text-xs mb-2 line-clamp-2" style={{ color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                    {preview}
                  </p>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                    style={{ backgroundColor: catStyle.bg, color: catStyle.text }}>
                    {note.category}
                  </span>
                  <span className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                    {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: '1px', backgroundColor: 'var(--color-border)', marginRight: '20px', flexShrink: 0 }} />

      {/* ── Right: Editor ──────────────────────────────────────────────── */}
      {selectedNote ? (
        <div className="flex-1 flex flex-col min-w-0 rounded-2xl overflow-hidden"
          style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>

          {/* Editor toolbar */}
          <div className="flex items-center justify-between px-6 py-3 shrink-0"
            style={{ borderBottom: '1px solid var(--color-border)' }}>
            <div className="flex items-center gap-3">
              {/* Category selector */}
              <select
                value={editCategory}
                onChange={e => handleCategoryChange(e.target.value)}
                className="text-xs font-semibold rounded-full px-3 py-1 outline-none cursor-pointer"
                style={{
                  border: 'none',
                  backgroundColor: getCatStyle(editCategory).bg,
                  color: getCatStyle(editCategory).text,
                }}
              >
                {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2">
              {/* Save status */}
              {saveStatus === 'saving' && (
                <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  <Loader2 size={11} className="animate-spin" /> Saving…
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-success, #16A34A)' }}>
                  <Check size={11} /> Saved
                </span>
              )}

              {/* Pin */}
              <button
                onClick={handleTogglePin}
                className="p-1.5 rounded-lg transition-colors"
                title={selectedNote.is_pinned ? 'Unpin note' : 'Pin note'}
                style={{
                  color: selectedNote.is_pinned ? '#F59E0B' : 'var(--color-text-muted)',
                  backgroundColor: selectedNote.is_pinned ? 'rgba(245,158,11,0.1)' : 'transparent',
                }}
              >
                <Pin size={15} />
              </button>

              {/* Delete */}
              {!deleteConfirm ? (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="p-1.5 rounded-lg"
                  title="Delete note"
                  style={{ color: 'var(--color-danger)' }}
                >
                  <Trash2 size={15} />
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs" style={{ color: 'var(--color-danger)' }}>Delete?</span>
                  <button onClick={handleDelete}
                    className="text-xs px-2.5 py-1 rounded-lg text-white font-medium"
                    style={{ backgroundColor: 'var(--color-danger)' }}>
                    Yes
                  </button>
                  <button onClick={() => setDeleteConfirm(false)}
                    className="text-xs px-2.5 py-1 rounded-lg"
                    style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                    No
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Title */}
          <input
            type="text"
            value={editTitle}
            onChange={e => handleTitleChange(e.target.value)}
            placeholder="Note title…"
            className="px-6 pt-5 pb-2 text-2xl font-bold outline-none w-full shrink-0"
            style={{ backgroundColor: 'transparent', color: 'var(--color-text-primary)', border: 'none' }}
          />

          {/* Content */}
          <textarea
            value={editContent}
            onChange={e => handleContentChange(e.target.value)}
            placeholder="Start writing…"
            className="flex-1 px-6 py-2 text-sm resize-none outline-none"
            style={{
              backgroundColor: 'transparent',
              color: 'var(--color-text-secondary)',
              border: 'none',
              lineHeight: 1.75,
              fontFamily: 'inherit',
            }}
          />

          {/* Footer */}
          <div className="px-6 py-2.5 shrink-0 flex items-center justify-between"
            style={{ borderTop: '1px solid var(--color-border)' }}>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Last updated {formatDistanceToNow(new Date(selectedNote.updated_at), { addSuffix: true })}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {editContent.length} characters
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center rounded-2xl"
          style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div className="text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
              style={{ backgroundColor: 'rgba(61,212,230,0.1)' }}>
              <BookOpen size={26} style={{ color: '#3DD4E6' }} />
            </div>
            <div>
              <p className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                Your Notebook
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                Select a note or create a new one
              </p>
            </div>
            <button
              onClick={handleNewNote}
              disabled={creating}
              className="text-sm px-5 py-2 rounded-xl text-white font-semibold disabled:opacity-60"
              style={{ backgroundColor: '#0BB5C7' }}
            >
              {creating ? 'Creating…' : '+ New Note'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
