'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Pin, Trash2, Loader2, Search, X, Check, BookOpen, Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered, CheckSquare, ChevronDown } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import UnderlineExt from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'

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

// ── Text/highlight color palettes ─────────────────────────────────────────────
const TEXT_COLORS = [
  { label: 'Default', value: '' },
  { label: 'Black',   value: '#111827' },
  { label: 'Gray',    value: '#6B7280' },
  { label: 'Red',     value: '#EF4444' },
  { label: 'Orange',  value: '#F97316' },
  { label: 'Yellow',  value: '#CA8A04' },
  { label: 'Green',   value: '#22C55E' },
  { label: 'Blue',    value: '#3B82F6' },
  { label: 'Purple',  value: '#8B5CF6' },
  { label: 'Pink',    value: '#EC4899' },
]

const HIGHLIGHT_COLORS = [
  { label: 'None',    value: '' },
  { label: 'Yellow',  value: '#FEF08A' },
  { label: 'Green',   value: '#BBF7D0' },
  { label: 'Blue',    value: '#BAE6FD' },
  { label: 'Purple',  value: '#E9D5FF' },
  { label: 'Pink',    value: '#FBCFE8' },
  { label: 'Orange',  value: '#FED7AA' },
]

// ── Toolbar ───────────────────────────────────────────────────────────────────

type TiptapEditor = ReturnType<typeof useEditor>

function ToolbarBtn({
  active, onClick, title, children,
}: { active?: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onMouseDown={e => { e.preventDefault(); onClick() }}
      title={title}
      className="p-1.5 rounded-md transition-colors"
      style={{
        backgroundColor: active ? 'rgba(11,181,199,0.12)' : 'transparent',
        color: active ? '#0BB5C7' : 'var(--color-text-muted)',
      }}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div style={{ width: 1, height: 20, backgroundColor: 'var(--color-border)', margin: '0 4px', flexShrink: 0 }} />
}

function ColorPicker({
  colors, onSelect, current, label,
}: { colors: typeof TEXT_COLORS; onSelect: (v: string) => void; current: string; label: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  return (
    <div ref={ref} className="relative">
      <button
        onMouseDown={e => { e.preventDefault(); setOpen(o => !o) }}
        className="flex items-center gap-0.5 p-1.5 rounded-md transition-colors"
        style={{ color: 'var(--color-text-muted)' }}
        title={typeof label === 'string' ? label : 'Color'}
      >
        {label}
        <ChevronDown size={10} />
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 p-2 rounded-xl shadow-lg z-50 grid gap-1"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            gridTemplateColumns: 'repeat(5, 1fr)',
            minWidth: 130,
          }}
        >
          {colors.map(c => (
            <button
              key={c.value}
              onMouseDown={e => { e.preventDefault(); onSelect(c.value); setOpen(false) }}
              title={c.label}
              className="w-6 h-6 rounded-md border-2 transition-transform hover:scale-110"
              style={{
                backgroundColor: c.value || 'transparent',
                borderColor: current === c.value ? '#0BB5C7' : c.value ? 'transparent' : 'var(--color-border)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Toolbar({ editor }: { editor: TiptapEditor | null }) {
  const [blockOpen, setBlockOpen] = useState(false)
  const blockRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (blockRef.current && !blockRef.current.contains(e.target as Node)) setBlockOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!editor) return null

  const blockType = editor.isActive('heading', { level: 1 }) ? 'H1'
    : editor.isActive('heading', { level: 2 }) ? 'H2'
    : editor.isActive('heading', { level: 3 }) ? 'H3'
    : 'Normal'

  const currentTextColor = editor.getAttributes('textStyle').color ?? ''
  const currentHighlight = editor.getAttributes('highlight').color ?? ''

  return (
    <div className="flex items-center gap-0.5 px-4 py-2 flex-wrap shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
      {/* Block type */}
      <div ref={blockRef} className="relative mr-1">
        <button
          onMouseDown={e => { e.preventDefault(); setBlockOpen(o => !o) }}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
          style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', minWidth: 76 }}
        >
          {blockType} <ChevronDown size={11} />
        </button>
        {blockOpen && (
          <div className="absolute top-full left-0 mt-1 rounded-xl shadow-lg z-50 overflow-hidden"
            style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', minWidth: 120 }}>
            {[
              { label: 'Normal', action: () => editor.chain().focus().setParagraph().run() },
              { label: 'Heading 1', action: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
              { label: 'Heading 2', action: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
              { label: 'Heading 3', action: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
            ].map(item => (
              <button
                key={item.label}
                onMouseDown={e => { e.preventDefault(); item.action(); setBlockOpen(false) }}
                className="w-full text-left px-3 py-2 text-xs transition-colors hover:bg-black/5"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <Divider />

      {/* Inline marks */}
      <ToolbarBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold (⌘B)">
        <Bold size={14} />
      </ToolbarBtn>
      <ToolbarBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic (⌘I)">
        <Italic size={14} />
      </ToolbarBtn>
      <ToolbarBtn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline (⌘U)">
        <UnderlineIcon size={14} />
      </ToolbarBtn>
      <ToolbarBtn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
        <Strikethrough size={14} />
      </ToolbarBtn>

      <Divider />

      {/* Lists */}
      <ToolbarBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list">
        <List size={14} />
      </ToolbarBtn>
      <ToolbarBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list">
        <ListOrdered size={14} />
      </ToolbarBtn>
      <ToolbarBtn active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()} title="Checkbox list">
        <CheckSquare size={14} />
      </ToolbarBtn>

      <Divider />

      {/* Text color */}
      <ColorPicker
        colors={TEXT_COLORS}
        current={currentTextColor}
        onSelect={v => v
          ? editor.chain().focus().setColor(v).run()
          : editor.chain().focus().unsetColor().run()
        }
        label={
          <span className="relative">
            <span className="text-xs font-bold" style={{ color: currentTextColor || 'var(--color-text-primary)' }}>A</span>
            <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ backgroundColor: currentTextColor || 'var(--color-text-muted)' }} />
          </span>
        }
      />

      {/* Highlight */}
      <ColorPicker
        colors={HIGHLIGHT_COLORS}
        current={currentHighlight}
        onSelect={v => v
          ? editor.chain().focus().setHighlight({ color: v }).run()
          : editor.chain().focus().unsetHighlight().run()
        }
        label={
          <span className="px-0.5 text-xs font-bold rounded-sm" style={{ backgroundColor: currentHighlight || 'transparent', color: 'var(--color-text-primary)', outline: currentHighlight ? 'none' : '1px solid var(--color-border)' }}>
            ab
          </span>
        }
      />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

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
  const [editTitle, setEditTitle] = useState(initialNotes[0]?.title ?? '')
  const [editCategory, setEditCategory] = useState(initialNotes[0]?.category ?? 'General')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [creating, setCreating] = useState(false)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const isSwitchingRef = useRef(false)

  // Refs so Tiptap's onUpdate callback always sees current values
  const titleRef = useRef(editTitle)
  const categoryRef = useRef(editCategory)
  const selectedIdRef = useRef(selectedId)
  titleRef.current = editTitle
  categoryRef.current = editCategory
  selectedIdRef.current = selectedId

  const selectedNote = notes.find(n => n.id === selectedId) ?? null

  // Stable save function ref
  const doSaveRef = useRef((noteId: string, title: string, content: string, category: string) => {
    clearTimeout(saveTimerRef.current)
    setSaveStatus('saving')
    saveTimerRef.current = setTimeout(async () => {
      const supabase = createClient()
      const now = new Date().toISOString()
      await supabase.from('notes').update({ title, content, category, updated_at: now }).eq('id', noteId)
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, title, content, category } : n))
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(s => s === 'saved' ? 'idle' : s), 2000)
    }, 900)
  })

  useEffect(() => {
    setCustomCats(loadCustomCats())
  }, [])

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      UnderlineExt,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: initialNotes[0]?.content || '',
    onUpdate: ({ editor }) => {
      if (isSwitchingRef.current) return
      const id = selectedIdRef.current
      if (!id) return
      doSaveRef.current(id, titleRef.current, editor.getHTML(), categoryRef.current)
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none notebook-editor',
      },
    },
  })

  // Sync editor + form state when note selection changes
  useEffect(() => {
    if (!selectedNote) return
    isSwitchingRef.current = true
    if (editor) {
      editor.commands.setContent(selectedNote.content || '')
    }
    setEditTitle(selectedNote.title)
    setEditCategory(selectedNote.category)
    setDeleteConfirm(false)
    setSaveStatus('idle')
    requestAnimationFrame(() => { isSwitchingRef.current = false })
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  const noteCats = Array.from(new Set(notes.map(n => n.category)))
  const allCategories = Array.from(new Set([...DEFAULT_CATEGORIES, ...customCats, ...noteCats]))

  const filteredNotes = notes
    .filter(n => activeCategory === 'All' || n.category === activeCategory)
    .filter(n => !searchQ || n.title.toLowerCase().includes(searchQ.toLowerCase()) || n.content.toLowerCase().includes(searchQ.toLowerCase()))
    .sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })

  function handleTitleChange(val: string) {
    setEditTitle(val)
    if (selectedId) doSaveRef.current(selectedId, val, editor?.getHTML() ?? '', editCategory)
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

  function handleRemoveCategory(cat: string) {
    const updated = customCats.filter(c => c !== cat)
    setCustomCats(updated)
    saveCustomCats(updated)
    if (activeCategory === cat) setActiveCategory('All')
  }

  function selectNote(note: NoteRow) {
    clearTimeout(saveTimerRef.current)
    if (selectedId && selectedNote) {
      const content = editor?.getHTML() ?? ''
      const changed = editTitle !== selectedNote.title || content !== selectedNote.content || editCategory !== selectedNote.category
      if (changed) {
        const supabase = createClient()
        const now = new Date().toISOString()
        supabase.from('notes').update({ title: editTitle, content, category: editCategory, updated_at: now }).eq('id', selectedId)
        setNotes(prev => prev.map(n => n.id === selectedId ? { ...n, title: editTitle, content, category: editCategory } : n))
      }
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
    <>
      {/* Tiptap + task list styles */}
      <style>{`
        .notebook-editor { min-height: 100%; font-size: 14px; line-height: 1.75; color: var(--color-text-secondary); }
        .notebook-editor p { margin: 0 0 0.5em; }
        .notebook-editor h1 { font-size: 1.6em; font-weight: 700; color: var(--color-text-primary); margin: 0.5em 0; }
        .notebook-editor h2 { font-size: 1.3em; font-weight: 700; color: var(--color-text-primary); margin: 0.5em 0; }
        .notebook-editor h3 { font-size: 1.1em; font-weight: 600; color: var(--color-text-primary); margin: 0.5em 0; }
        .notebook-editor ul { list-style: disc; padding-left: 1.4em; margin: 0.25em 0; }
        .notebook-editor ol { list-style: decimal; padding-left: 1.4em; margin: 0.25em 0; }
        .notebook-editor li { margin: 0.1em 0; }
        .notebook-editor ul[data-type="taskList"] { list-style: none; padding-left: 0.2em; }
        .notebook-editor ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 0.5em; }
        .notebook-editor ul[data-type="taskList"] li > label { margin-top: 3px; flex-shrink: 0; }
        .notebook-editor ul[data-type="taskList"] li > label input[type="checkbox"] { accent-color: #0BB5C7; width: 14px; height: 14px; cursor: pointer; }
        .notebook-editor ul[data-type="taskList"] li > div { flex: 1; min-width: 0; }
        .notebook-editor ul[data-type="taskList"] li[data-checked="true"] > div { opacity: 0.55; text-decoration: line-through; }
        .notebook-editor blockquote { border-left: 3px solid var(--color-border); padding-left: 1em; color: var(--color-text-muted); margin: 0.5em 0; }
        .notebook-editor mark { border-radius: 2px; padding: 0 2px; }
        .notebook-editor strong { color: var(--color-text-primary); }
        .notebook-editor p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: var(--color-text-muted); opacity: 0.5; float: left; height: 0; pointer-events: none; }
      `}</style>

      <div className="flex gap-0" style={{ height: 'calc(100vh - 64px - 64px)', minHeight: 0 }}>

        {/* ── Left: Category sidebar ─────────────────────────────────────── */}
        <div className="flex flex-col shrink-0" style={{ width: '185px', paddingRight: '16px' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>
            Notebooks
          </p>
          <nav className="space-y-0.5 flex-1 overflow-y-auto">
            {['All', ...allCategories].map(cat => {
              const isActive = activeCategory === cat
              const isCustom = customCats.includes(cat)
              const count = cat === 'All' ? notes.length : notes.filter(n => n.category === cat).length
              return (
                <div key={cat} className="group relative flex items-center">
                  <button
                    onClick={() => setActiveCategory(cat)}
                    className="flex-1 text-left flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all pr-7"
                    style={{
                      backgroundColor: isActive ? 'rgba(61,212,230,0.1)' : 'transparent',
                      color: isActive ? '#0BB5C7' : 'var(--color-text-secondary)',
                      fontWeight: isActive ? 600 : 400,
                    }}
                  >
                    <span className="truncate">{cat}</span>
                    <span className="text-xs ml-1 shrink-0" style={{ color: 'var(--color-text-muted)' }}>{count}</span>
                  </button>
                  {isCustom && (
                    <button
                      onClick={() => handleRemoveCategory(cat)}
                      className="absolute right-1.5 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove category"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
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
              const plainPreview = note.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100)
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
                  {plainPreview && (
                    <p className="text-xs mb-2 line-clamp-2" style={{ color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                      {plainPreview}
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                      style={{ backgroundColor: catStyle.bg, color: catStyle.text }}>
                      {note.category}
                    </span>
                    <span suppressHydrationWarning className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
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

            {/* Editor meta toolbar */}
            <div className="flex items-center justify-between px-6 py-3 shrink-0"
              style={{ borderBottom: '1px solid var(--color-border)' }}>
              <div className="flex items-center gap-3">
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
                {saveStatus === 'saving' && (
                  <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    <Loader2 size={11} className="animate-spin" /> Saving…
                  </span>
                )}
                {saveStatus === 'saved' && (
                  <span className="flex items-center gap-1 text-xs" style={{ color: '#16A34A' }}>
                    <Check size={11} /> Saved
                  </span>
                )}

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

                {!deleteConfirm ? (
                  <button onClick={() => setDeleteConfirm(true)} className="p-1.5 rounded-lg" style={{ color: 'var(--color-danger)' }}>
                    <Trash2 size={15} />
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs" style={{ color: 'var(--color-danger)' }}>Delete?</span>
                    <button onClick={handleDelete} className="text-xs px-2.5 py-1 rounded-lg text-white font-medium" style={{ backgroundColor: 'var(--color-danger)' }}>Yes</button>
                    <button onClick={() => setDeleteConfirm(false)} className="text-xs px-2.5 py-1 rounded-lg" style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>No</button>
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

            {/* Formatting toolbar */}
            <Toolbar editor={editor} />

            {/* Rich text editor */}
            <div className="flex-1 overflow-y-auto px-6 py-4" onClick={() => editor?.commands.focus()}>
              <EditorContent editor={editor} />
            </div>

            {/* Footer */}
            <div className="px-6 py-2.5 shrink-0 flex items-center justify-between" style={{ borderTop: '1px solid var(--color-border)' }}>
              <p suppressHydrationWarning className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Last updated {formatDistanceToNow(new Date(selectedNote.updated_at), { addSuffix: true })}
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {editor?.getText().length ?? 0} characters
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center rounded-2xl"
            style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto" style={{ backgroundColor: 'rgba(61,212,230,0.1)' }}>
                <BookOpen size={26} style={{ color: '#3DD4E6' }} />
              </div>
              <div>
                <p className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Your Notebook</p>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Select a note or create a new one</p>
              </div>
              <button onClick={handleNewNote} disabled={creating} className="text-sm px-5 py-2 rounded-xl text-white font-semibold disabled:opacity-60" style={{ backgroundColor: '#0BB5C7' }}>
                {creating ? 'Creating…' : '+ New Note'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
