'use client'

import { useState, useEffect, useRef } from 'react'
import { Paperclip, Save, Trash2, ChevronDown, X, Mail } from 'lucide-react'

const TEMPLATES_KEY = 'atp_email_templates'
const SIGNATURES_KEY = 'atp_email_signatures'

interface SavedTemplate {
  id: string
  name: string
  subject: string
  body: string
}

interface SavedSignature {
  id: string
  name: string
  content: string
}

export interface EmailRecipient {
  id: string
  name: string
  email: string | null
  enabled: boolean
}

interface Props {
  recipients: EmailRecipient[]
  onRecipientsChange: (recipients: EmailRecipient[]) => void
  pdfSummary: string
  onSend: (subject: string, body: string, signature: string, extraFiles: File[]) => Promise<void>
  onDownloadOnly: () => void
  onBack: () => void
  isSending: boolean
}

export default function EmailComposeStep({
  recipients,
  onRecipientsChange,
  pdfSummary,
  onSend,
  onDownloadOnly,
  onBack,
  isSending,
}: Props) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [signature, setSignature] = useState('')
  const [extraFiles, setExtraFiles] = useState<File[]>([])
  const [templates, setTemplates] = useState<SavedTemplate[]>([])
  const [signatures, setSignatures] = useState<SavedSignature[]>([])
  const [showTemplates, setShowTemplates] = useState(false)
  const [showSignatures, setShowSignatures] = useState(false)
  const [saveTemplateName, setSaveTemplateName] = useState('')
  const [saveSignatureName, setSaveSignatureName] = useState('')
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [showSaveSignature, setShowSaveSignature] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const t = localStorage.getItem(TEMPLATES_KEY)
      if (t) setTemplates(JSON.parse(t))
      const s = localStorage.getItem(SIGNATURES_KEY)
      if (s) setSignatures(JSON.parse(s))
    } catch {}
  }, [])

  function saveTemplate() {
    if (!saveTemplateName.trim()) return
    const t: SavedTemplate = { id: Date.now().toString(), name: saveTemplateName.trim(), subject, body }
    const updated = [...templates, t]
    setTemplates(updated)
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(updated))
    setSaveTemplateName('')
    setShowSaveTemplate(false)
  }

  function deleteTemplate(id: string) {
    const updated = templates.filter(t => t.id !== id)
    setTemplates(updated)
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(updated))
  }

  function saveSignature() {
    if (!saveSignatureName.trim()) return
    const s: SavedSignature = { id: Date.now().toString(), name: saveSignatureName.trim(), content: signature }
    const updated = [...signatures, s]
    setSignatures(updated)
    localStorage.setItem(SIGNATURES_KEY, JSON.stringify(updated))
    setSaveSignatureName('')
    setShowSaveSignature(false)
  }

  function deleteSignature(id: string) {
    const updated = signatures.filter(s => s.id !== id)
    setSignatures(updated)
    localStorage.setItem(SIGNATURES_KEY, JSON.stringify(updated))
  }

  const enabledCount = recipients.filter(r => r.enabled && r.email).length
  const hasEmail = recipients.filter(r => r.email).length

  return (
    <div className="flex flex-col gap-4 overflow-y-auto flex-1 pr-1">

      {/* Recipients */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
            Recipients
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => onRecipientsChange(recipients.map(r => ({ ...r, enabled: !!r.email })))}
              className="text-xs px-2 py-0.5 rounded"
              style={{ border: '1px solid var(--color-border)', color: '#0BB5C7' }}
            >
              Select All
            </button>
            <button
              onClick={() => onRecipientsChange(recipients.map(r => ({ ...r, enabled: false })))}
              className="text-xs px-2 py-0.5 rounded"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
            >
              Deselect All
            </button>
          </div>
        </div>
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)', maxHeight: 180, overflowY: 'auto' }}>
          {recipients.map((r, i) => (
            <label
              key={r.id}
              className="flex items-center gap-3 px-3 py-2 cursor-pointer"
              style={{
                borderBottom: i < recipients.length - 1 ? '1px solid var(--color-border)' : 'none',
              }}
            >
              <input
                type="checkbox"
                checked={r.enabled && !!r.email}
                disabled={!r.email}
                onChange={e => onRecipientsChange(recipients.map(x => x.id === r.id ? { ...x, enabled: e.target.checked } : x))}
                className="w-4 h-4 accent-[#0BB5C7] shrink-0"
              />
              <span className="flex-1 text-sm truncate" style={{ color: r.email ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
                {r.name}
              </span>
              <span className="text-xs shrink-0" style={{ color: r.email ? 'var(--color-text-muted)' : '#ef4444' }}>
                {r.email ?? 'No email'}
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
          {enabledCount} of {hasEmail} recipients selected · {pdfSummary}
        </p>
      </div>

      {/* Compose */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
            Compose
          </p>
          <div className="flex gap-1.5 ml-auto relative">
            {/* Templates picker */}
            <div className="relative">
              <button
                onClick={() => { setShowTemplates(p => !p); setShowSignatures(false) }}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg"
                style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-bg)' }}
              >
                Templates <ChevronDown size={10} />
              </button>
              {showTemplates && (
                <div className="absolute right-0 top-7 z-20 w-60 rounded-xl shadow-xl overflow-hidden"
                  style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                  {templates.length === 0 && (
                    <p className="text-xs px-3 py-2.5" style={{ color: 'var(--color-text-muted)' }}>No saved templates</p>
                  )}
                  {templates.map(t => (
                    <div key={t.id} className="flex items-center gap-1 px-3 py-2 hover:bg-white/5">
                      <button className="flex-1 text-left text-xs truncate" style={{ color: 'var(--color-text-primary)' }}
                        onClick={() => { setSubject(t.subject); setBody(t.body); setShowTemplates(false) }}>
                        {t.name}
                      </button>
                      <button onClick={() => deleteTemplate(t.id)} className="p-1 rounded shrink-0" style={{ color: '#ef4444' }}>
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}
                  <div className="border-t px-3 py-2" style={{ borderColor: 'var(--color-border)' }}>
                    {showSaveTemplate ? (
                      <div className="flex gap-1.5">
                        <input value={saveTemplateName} onChange={e => setSaveTemplateName(e.target.value)}
                          placeholder="Template name" onKeyDown={e => e.key === 'Enter' && saveTemplate()}
                          className="flex-1 text-xs px-2 py-1 rounded-lg"
                          style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text-primary)', outline: 'none' }} />
                        <button onClick={saveTemplate} className="text-xs px-2 py-1 rounded-lg bg-[#0BB5C7] text-white shrink-0">Save</button>
                      </div>
                    ) : (
                      <button onClick={() => setShowSaveTemplate(true)} className="flex items-center gap-1.5 text-xs" style={{ color: '#0BB5C7' }}>
                        <Save size={10} /> Save current as template
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Signatures picker */}
            <div className="relative">
              <button
                onClick={() => { setShowSignatures(p => !p); setShowTemplates(false) }}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg"
                style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-bg)' }}
              >
                Signatures <ChevronDown size={10} />
              </button>
              {showSignatures && (
                <div className="absolute right-0 top-7 z-20 w-60 rounded-xl shadow-xl overflow-hidden"
                  style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                  {signatures.length === 0 && (
                    <p className="text-xs px-3 py-2.5" style={{ color: 'var(--color-text-muted)' }}>No saved signatures</p>
                  )}
                  {signatures.map(s => (
                    <div key={s.id} className="flex items-center gap-1 px-3 py-2 hover:bg-white/5">
                      <button className="flex-1 text-left text-xs truncate" style={{ color: 'var(--color-text-primary)' }}
                        onClick={() => { setSignature(s.content); setShowSignatures(false) }}>
                        {s.name}
                      </button>
                      <button onClick={() => deleteSignature(s.id)} className="p-1 rounded shrink-0" style={{ color: '#ef4444' }}>
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}
                  <div className="border-t px-3 py-2" style={{ borderColor: 'var(--color-border)' }}>
                    {showSaveSignature ? (
                      <div className="flex gap-1.5">
                        <input value={saveSignatureName} onChange={e => setSaveSignatureName(e.target.value)}
                          placeholder="Signature name" onKeyDown={e => e.key === 'Enter' && saveSignature()}
                          className="flex-1 text-xs px-2 py-1 rounded-lg"
                          style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text-primary)', outline: 'none' }} />
                        <button onClick={saveSignature} className="text-xs px-2 py-1 rounded-lg bg-[#0BB5C7] text-white shrink-0">Save</button>
                      </div>
                    ) : (
                      <button onClick={() => setShowSaveSignature(true)} className="flex items-center gap-1.5 text-xs" style={{ color: '#0BB5C7' }}>
                        <Save size={10} /> Save current signature
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <input
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder="Subject"
          className="w-full px-3 py-2 text-sm rounded-xl mb-2"
          style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text-primary)', outline: 'none' }}
        />
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Message body..."
          rows={4}
          className="w-full px-3 py-2 text-sm rounded-xl resize-none mb-2"
          style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text-primary)', outline: 'none' }}
        />
        <textarea
          value={signature}
          onChange={e => setSignature(e.target.value)}
          placeholder="Signature (optional)..."
          rows={2}
          className="w-full px-3 py-2 rounded-xl resize-none"
          style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text-muted)', outline: 'none', fontSize: 12 }}
        />
      </div>

      {/* Extra attachments */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
          Extra Attachments
        </p>
        <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
          Report PDFs are automatically attached. Add extra files here.
        </p>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => {
            if (e.target.files) setExtraFiles(prev => [...prev, ...Array.from(e.target.files!)])
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl"
          style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-bg)' }}
        >
          <Paperclip size={12} /> Attach files
        </button>
        {extraFiles.length > 0 && (
          <div className="mt-2 space-y-1">
            {extraFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-xs px-2 py-1 rounded-lg"
                style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                <Paperclip size={10} className="shrink-0" />
                <span className="flex-1 truncate">{f.name}</span>
                <button onClick={() => setExtraFiles(prev => prev.filter((_, j) => j !== i))} style={{ color: '#ef4444' }}>
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center gap-3 pt-4 mt-auto shrink-0" style={{ borderTop: '1px solid var(--color-border)' }}>
        <button
          onClick={onBack}
          disabled={isSending}
          className="px-4 py-2 text-sm font-medium rounded-xl disabled:opacity-50"
          style={{ color: 'var(--color-text-muted)' }}
        >
          ← Back
        </button>
        <div className="flex gap-2">
          <button
            onClick={onDownloadOnly}
            disabled={isSending}
            className="px-4 py-2 text-sm font-medium rounded-xl disabled:opacity-50"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-bg)' }}
          >
            Download Only
          </button>
          <button
            onClick={() => onSend(subject, body, signature, extraFiles)}
            disabled={isSending || enabledCount === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-[#0BB5C7] text-white disabled:opacity-50"
          >
            <Mail size={13} />
            {isSending ? 'Sending...' : `Send to ${enabledCount}`}
          </button>
        </div>
      </div>
    </div>
  )
}
