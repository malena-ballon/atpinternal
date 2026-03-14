'use client'

import React, { useState, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { Slice, Fragment } from '@tiptap/pm/model'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Palette } from 'lucide-react'

const COLORS = [
  { label: 'Default', value: '' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Amber', value: '#d97706' },
  { label: 'Green', value: '#16a34a' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Purple', value: '#7c3aed' },
  { label: 'Pink', value: '#db2777' },
  { label: 'Cyan', value: '#0891b2' },
]

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

export default function RichTextEditor({ value, onChange, placeholder = 'Enter details…' }: Props) {
  const [showColorPicker, setShowColorPicker] = useState(false)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, Underline, TextStyle, Color],
    content: value || '',
    editorProps: {
      attributes: { class: 'rich-editor-content', 'data-placeholder': placeholder },
      handlePaste: (view, event) => {
        const plain = event.clipboardData?.getData('text/plain')
        const html = event.clipboardData?.getData('text/html')

        // Detect if the pasted HTML contains a table
        const isTable = html && (html.toLowerCase().includes('<table') || html.toLowerCase().includes('<tr'));

        // If there's HTML AND it's not a table, let Tiptap handle it natively
        if (html && html.trim() && !isTable) return false

        // Intercept plain-text (or plain-text fallback for tables)
        if (!plain || !plain.includes('\n')) return false
        
        event.preventDefault()
        
        const { schema } = view.state
        const lines = plain.split('\n')
        const nodes = lines.map(line => {
          // Replace tabs (columns) with spaces so they don't merge
          const text = line.replace(/\t/g, '    ')
          if (!text.trim()) return schema.nodes.paragraph.create()
          return schema.nodes.paragraph.create(null, [schema.text(text)])
        })
        
        view.dispatch(view.state.tr.replaceSelection(new Slice(Fragment.fromArray(nodes), 0, 0)).scrollIntoView())
        return true
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      onChange(html === '<p></p>' ? '' : html)
    },
  })

  useEffect(() => {
    if (!editor) return
    const incoming = value || ''
    const current = editor.getHTML()
    const normalised = current === '<p></p>' ? '' : current
    if (normalised !== incoming) {
      editor.commands.setContent(incoming || '', { emitUpdate: false })
    }
  }, [value, editor])

  if (!editor) return null

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'var(--color-surface)' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '4px 6px', borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', flexWrap: 'wrap' }}>
        <Btn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
          <Bold size={13} />
        </Btn>
        <Btn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
          <Italic size={13} />
        </Btn>
        <Btn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline">
          <UnderlineIcon size={13} />
        </Btn>

        <Sep />

        <Btn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list">
          <List size={13} />
        </Btn>
        <Btn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list">
          <ListOrdered size={13} />
        </Btn>

        <Sep />

        {/* Color picker */}
        <div style={{ position: 'relative' }}>
          <Btn active={showColorPicker} onClick={() => setShowColorPicker(p => !p)} title="Text color">
            <Palette size={13} />
          </Btn>
          {showColorPicker && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setShowColorPicker(false)} />
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200,
                padding: '8px', backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)', borderRadius: '8px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                display: 'flex', gap: '6px', flexWrap: 'wrap', width: '148px',
              }}>
                {COLORS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    onClick={() => {
                      if (c.value) editor.chain().focus().setColor(c.value).run()
                      else editor.chain().focus().unsetColor().run()
                      setShowColorPicker(false)
                    }}
                    style={{
                      width: '22px', height: '22px', borderRadius: '50%', cursor: 'pointer',
                      backgroundColor: c.value || 'var(--color-text-primary)',
                      border: '2px solid var(--color-border)',
                      outline: editor.isActive('textStyle', { color: c.value }) ? '2px solid #0BB5C7' : 'none',
                      outlineOffset: '1px',
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Resizable editor area */}
      <div style={{ resize: 'vertical', overflow: 'auto', minHeight: '90px', padding: '8px 10px', color: '#1a1f36' }}>
        <EditorContent editor={editor} style={{ outline: 'none' }} />
      </div>
    </div>
  )
}

function Btn({ children, active, onClick, title }: { children: React.ReactNode; active: boolean; onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={e => { e.preventDefault(); onClick() }}
      style={{
        width: '26px', height: '26px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: '4px', border: 'none', cursor: 'pointer',
        backgroundColor: active ? 'rgba(11,181,199,0.15)' : 'transparent',
        color: active ? '#0BB5C7' : 'var(--color-text-secondary)',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--color-border)', margin: '0 2px', flexShrink: 0 }} />
}
