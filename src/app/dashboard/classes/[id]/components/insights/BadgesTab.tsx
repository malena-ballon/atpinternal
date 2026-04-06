'use client'

import { useState, useMemo } from 'react'
import { Loader2, Mail } from 'lucide-react'
import type { StudentStats, ExamStats } from '../PerformanceInsights'
import EmailComposeStep, { type EmailRecipient } from './EmailComposeStep'
import { sendReportEmails, logActivity } from '@/app/actions'

// ── Badge catalog ─────────────────────────────────────────────────────────────
const BADGES = {
  perfect:    { name: 'Perfect Score',       emoji: '🏆', color: '#F59E0B', bg1: '#1C0F00', bg2: '#090400', desc: 'Awarded to students who scored 100% on the exam. A rare and remarkable achievement.' },
  rank1:      { name: '1st Place',           emoji: '🥇', color: '#FBBF24', bg1: '#1A0E00', bg2: '#090400', desc: 'Highest score in the class for this exam or overall average. Only one student earns this per category.' },
  rank2:      { name: '2nd Place',           emoji: '🥈', color: '#94A3B8', bg1: '#0F172A', bg2: '#060C17', desc: '2nd highest score in the class for this exam or overall average.' },
  rank3:      { name: '3rd Place',           emoji: '🥉', color: '#D97706', bg1: '#1C1000', bg2: '#090600', desc: '3rd highest score in the class for this exam or overall average.' },
  excellence: { name: 'Academic Excellence', emoji: '🎓', color: '#A855F7', bg1: '#1A0535', bg2: '#0A021C', desc: 'Awarded to students who scored 90% or above. Multiple students can earn this badge.' },
} as const

type BadgeId = keyof typeof BADGES

// ── Types ─────────────────────────────────────────────────────────────────────
interface AwardedBadge {
  key: string          // `${badgeId}::${studentId}`
  badgeId: BadgeId
  studentId: string
  studentName: string
  studentEmail: string | null
  examName?: string
  detail: string
}

interface GeneratedImage {
  blob: Blob
  filename: string
  studentId: string
  studentName: string
  studentEmail: string | null
}

interface Props {
  className: string
  examStats: ExamStats[]
  studentStats: StudentStats[]
  classPassingPct: number
}

// ── Badge computation ─────────────────────────────────────────────────────────
function computeBadges(
  examId: string,
  examStats: ExamStats[],
  studentStats: StudentStats[],
  classPassingPct: number,
): AwardedBadge[] {
  const mk = (
    badgeId: BadgeId,
    s: StudentStats,
    examName?: string,
    detail?: string,
  ): AwardedBadge => ({
    key: `${badgeId}::${s.student.id}`,
    badgeId,
    studentId: s.student.id,
    studentName: s.student.name,
    studentEmail: s.student.email ?? null,
    examName,
    detail: detail ?? '',
  })

  if (examId === 'all') {
    const results: AwardedBadge[] = []
    const sorted = [...studentStats].sort((a, b) => b.avgPct - a.avgPct)

    // 1st, 2nd, 3rd overall
    const rankIds: BadgeId[] = ['rank1', 'rank2', 'rank3']
    for (let i = 0; i < Math.min(3, sorted.length); i++) {
      results.push(mk(rankIds[i], sorted[i], undefined, `${sorted[i].avgPct.toFixed(1)}% overall average`))
    }

    // Academic Excellence (≥90% avg)
    for (const s of studentStats) {
      if (s.avgPct >= 90) {
        results.push(mk('excellence', s, undefined, `${s.avgPct.toFixed(1)}% average`))
      }
    }

    return results
  }

  // ── Per-exam badges ────────────────────────────────────────────────────────
  const examStat = examStats.find(e => e.exam.id === examId)
  if (!examStat) return []

  const examName = examStat.exam.name
  const results: AwardedBadge[] = []
  const sorted = [...examStat.scores].sort((a, b) => b.percentage - a.percentage)

  // Perfect Score (all students with 100%)
  for (const score of sorted) {
    if (score.percentage < 100) break
    const s = studentStats.find(x => x.student.id === score.student_id)
    if (s) results.push(mk('perfect', s, examName, `100% · ${examName}`))
  }

  // 1st, 2nd, 3rd place
  const rankIds: BadgeId[] = ['rank1', 'rank2', 'rank3']
  for (let i = 0; i < Math.min(3, sorted.length); i++) {
    const s = studentStats.find(x => x.student.id === sorted[i].student_id)
    if (s) results.push(mk(rankIds[i], s, examName, `${sorted[i].percentage.toFixed(1)}% · ${examName}`))
  }

  // Academic Excellence (≥90% on this exam)
  for (const score of examStat.scores) {
    if (score.percentage < 90) continue
    const s = studentStats.find(x => x.student.id === score.student_id)
    if (s) results.push(mk('excellence', s, examName, `${score.percentage.toFixed(1)}% · ${examName}`))
  }

  return results
}

// ── Canvas helpers ────────────────────────────────────────────────────────────
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 2): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur)
      cur = w
      if (lines.length >= maxLines) break
    } else {
      cur = test
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur)
  return lines.length ? lines : [text.slice(0, 30)]
}

function strokeLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
}

// ── Badge image generation (1080×1920 — Instagram Story / FB My Day) ──────────
function generateBadge(
  def: typeof BADGES[BadgeId],
  studentName: string,
  className: string,
  detail: string,
  date: string,
): Promise<Blob> {
  const W = 1080, H = 1920
  return new Promise(resolve => {
    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')!

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, W * 0.6, H)
    bg.addColorStop(0, def.bg1)
    bg.addColorStop(1, def.bg2)
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // Subtle dot grid texture
    ctx.fillStyle = 'rgba(255,255,255,0.022)'
    for (let x = 50; x < W; x += 72) {
      for (let y = 50; y < H; y += 72) {
        ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill()
      }
    }

    // ── Review center name ──────────────────────────────────
    ctx.fillStyle = 'rgba(255,255,255,0.38)'
    ctx.font = 'bold 38px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('ACADGENIUS TUTORIAL POWERHOUSE', W / 2, 112)

    ctx.strokeStyle = `${def.color}33`
    ctx.lineWidth = 1.5
    strokeLine(ctx, W * 0.2, 140, W * 0.8, 140)

    // Class name
    ctx.fillStyle = 'rgba(255,255,255,0.44)'
    ctx.font = '46px sans-serif'
    ctx.fillText(className, W / 2, 212)

    // ── Glowing circle + emoji ──────────────────────────────
    const CX = W / 2, CY = 580, R = 238

    // Outer glow
    const glow = ctx.createRadialGradient(CX, CY, R * 0.1, CX, CY, R * 1.3)
    glow.addColorStop(0, `${def.color}38`)
    glow.addColorStop(1, 'transparent')
    ctx.fillStyle = glow
    ctx.fillRect(0, CY - R * 1.4, W, (R * 1.4) * 2)

    // Circle fill
    ctx.fillStyle = `${def.color}10`
    ctx.beginPath(); ctx.arc(CX, CY, R, 0, Math.PI * 2); ctx.fill()

    // Circle ring
    ctx.strokeStyle = `${def.color}90`
    ctx.lineWidth = 5
    ctx.beginPath(); ctx.arc(CX, CY, R, 0, Math.PI * 2); ctx.stroke()

    // Emoji centred in circle
    ctx.font = '210px serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(def.emoji, CX, CY + 6)
    ctx.textBaseline = 'alphabetic'

    // ── Badge name ──────────────────────────────────────────
    ctx.shadowColor = def.color
    ctx.shadowBlur = 28
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 86px sans-serif'
    ctx.textAlign = 'center'
    const badgeLines = wrapText(ctx, def.name.toUpperCase(), W - 80, 2)
    badgeLines.forEach((ln, i) => ctx.fillText(ln, W / 2, 958 + i * 96))
    ctx.shadowBlur = 0

    const afterBadge = 958 + badgeLines.length * 96

    // Divider
    ctx.strokeStyle = `${def.color}66`
    ctx.lineWidth = 2
    strokeLine(ctx, W * 0.3, afterBadge + 14, W * 0.7, afterBadge + 14)

    // "AWARDED TO"
    ctx.fillStyle = def.color
    ctx.font = 'bold 42px sans-serif'
    ctx.fillText('AWARDED TO', W / 2, afterBadge + 82)

    // Student name
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 104px sans-serif'
    const nameLines = wrapText(ctx, studentName, W - 80, 2)
    nameLines.forEach((ln, i) => ctx.fillText(ln, W / 2, afterBadge + 216 + i * 116))

    const afterName = afterBadge + 216 + nameLines.length * 116

    // Detail & date (capped so nothing goes off-canvas)
    if (detail) {
      ctx.fillStyle = 'rgba(255,255,255,0.48)'
      ctx.font = '44px sans-serif'
      ctx.fillText(detail, W / 2, Math.min(afterName + 56, 1660))
    }
    ctx.fillStyle = 'rgba(255,255,255,0.28)'
    ctx.font = '38px sans-serif'
    ctx.fillText(date, W / 2, Math.min(afterName + 116, 1730))

    // ── Bottom branding ─────────────────────────────────────
    ctx.strokeStyle = `${def.color}22`
    ctx.lineWidth = 1
    strokeLine(ctx, W * 0.2, 1826, W * 0.8, 1826)

    ctx.fillStyle = 'rgba(255,255,255,0.22)'
    ctx.font = '34px sans-serif'
    ctx.fillText('atpinternalteam.vercel.app', W / 2, 1876)

    canvas.toBlob(blob => resolve(blob!), 'image/png')
  })
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function BadgesTab({ className, examStats, studentStats, classPassingPct }: Props) {
  const [examId, setExamId]       = useState('all')
  const [selected, setSelected]   = useState<Set<string>>(new Set())
  const [step, setStep]           = useState<'list' | 'email'>('list')
  const [generated, setGenerated] = useState<GeneratedImage[]>([])
  const [recipients, setRecipients] = useState<EmailRecipient[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSending, setIsSending]       = useState(false)
  const [error, setError]               = useState<string | null>(null)

  const sortedExams = useMemo(
    () => [...examStats].sort((a, b) => (a.exam.date ?? '').localeCompare(b.exam.date ?? '')),
    [examStats],
  )

  const badges = useMemo(
    () => computeBadges(examId, examStats, studentStats, classPassingPct),
    [examId, examStats, studentStats, classPassingPct],
  )

  const allKeys = useMemo(() => new Set(badges.map(b => b.key)), [badges])
  const selectedBadges = badges.filter(b => selected.has(b.key))

  function toggle(key: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  async function handleNext() {
    if (selectedBadges.length === 0) return
    setIsGenerating(true)
    setError(null)
    try {
      const date = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
      const imgs: GeneratedImage[] = []

      for (const award of selectedBadges) {
        const def = BADGES[award.badgeId]
        const blob = await generateBadge(def, award.studentName, className, award.detail, date)
        const safe = award.studentName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')
        imgs.push({
          blob,
          filename: `${safe}_${award.badgeId}.png`,
          studentId: award.studentId,
          studentName: award.studentName,
          studentEmail: award.studentEmail,
        })
      }

      setGenerated(imgs)

      // One recipient per student (may have multiple badges)
      const seen = new Set<string>()
      const recs: EmailRecipient[] = []
      for (const img of imgs) {
        if (!seen.has(img.studentId)) {
          seen.add(img.studentId)
          recs.push({ id: img.studentId, name: img.studentName, email: img.studentEmail, enabled: true })
        }
      }
      setRecipients(recs)
      setStep('email')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Badge generation failed. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleDownloadOnly() {
    if (generated.length === 1) {
      dlBlob(generated[0].blob, generated[0].filename)
    } else {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      const folder = zip.folder(`${className.replace(/\s+/g, '_')}_Badges`)!
      for (const img of generated) folder.file(img.filename, img.blob)
      dlBlob(await zip.generateAsync({ type: 'blob' }), `${className.replace(/\s+/g, '_')}_Badges.zip`)
    }
    await logActivity('exported_pdf', 'class', null, className, `Downloaded ${generated.length} badge(s) for: ${className}`)
    setStep('list')
  }

  async function handleSend(subject: string, body: string, signature: string, extraFiles: File[]) {
    setIsSending(true)
    try {
      const toB64 = (blob: Blob) => new Promise<string>((res, rej) => {
        const r = new FileReader()
        r.onload = () => res((r.result as string).split(',')[1])
        r.onerror = rej
        r.readAsDataURL(blob)
      })
      const enabled = recipients.filter(r => r.enabled && r.email)
      const recipientData = await Promise.all(
        enabled.map(async r => ({
          name: r.name,
          email: r.email!,
          pdfs: await Promise.all(
            generated
              .filter(img => img.studentId === r.id)
              .map(async img => ({ filename: img.filename, base64: await toB64(img.blob) }))
          ),
        }))
      )
      const extraAttach = await Promise.all(
        extraFiles.map(async f => ({ filename: f.name, base64: await toB64(f) }))
      )
      await sendReportEmails(recipientData, subject, body, signature, extraAttach)
      await logActivity('sent_email', 'class', null, className, `Sent ${generated.length} badge(s) for: ${className}`)
      setStep('list')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  function dlBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename
    document.body.appendChild(a); a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const CYAN = '#0BB5C7'

  return (
    <div className="space-y-4">

      {/* ── Email compose modal ─────────────────────────────────────────────── */}
      {step === 'email' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div
            className="w-full rounded-2xl p-5 shadow-2xl flex flex-col max-h-[90vh]"
            style={{ maxWidth: 520, backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <div className="flex items-center gap-2 mb-4 shrink-0">
              <Mail size={15} style={{ color: CYAN }} />
              <h2 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Send Badges via Email</h2>
            </div>
            <EmailComposeStep
              recipients={recipients}
              onRecipientsChange={setRecipients}
              pdfSummary={`${generated.length} badge image${generated.length !== 1 ? 's' : ''} auto-attached`}
              onSend={handleSend}
              onDownloadOnly={handleDownloadOnly}
              onBack={() => setStep('list')}
              isSending={isSending}
            />
          </div>
        </div>
      )}

      {/* ── Badge legend ────────────────────────────────────────────────────── */}
      <div className="rounded-xl p-3 sm:p-4 space-y-2.5" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
        <p className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>BADGE DEFINITIONS</p>
        {(Object.values(BADGES) as typeof BADGES[BadgeId][]).map(def => (
          <div key={def.name} className="flex items-start gap-2.5">
            <span className="text-base leading-none mt-0.5 shrink-0">{def.emoji}</span>
            <div className="min-w-0">
              <span className="text-xs font-semibold" style={{ color: def.color }}>{def.name}</span>
              <span className="text-xs ml-1" style={{ color: 'var(--color-text-muted)' }}>— {def.desc}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Toolbar: exam picker + select controls ─────────────────────────── */}
      <div className="space-y-2">
        <label className="block text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
          Exam / Version
        </label>
        <div className="flex gap-2">
          <select
            value={examId}
            onChange={e => { setExamId(e.target.value); setSelected(new Set()) }}
            className="flex-1 px-3 py-2 text-sm rounded-xl min-w-0"
            style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text-primary)', outline: 'none' }}
          >
            <option value="all">All Exams (Overall)</option>
            {sortedExams.map(e => (
              <option key={e.exam.id} value={e.exam.id}>{e.exam.name}</option>
            ))}
          </select>
          <button
            onClick={() => setSelected(new Set(allKeys))}
            className="text-xs font-medium px-3 py-2 rounded-xl shrink-0"
            style={{ backgroundColor: `${CYAN}18`, color: CYAN }}
          >
            All
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs font-medium px-3 py-2 rounded-xl shrink-0"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* ── Badge cards grid ────────────────────────────────────────────────── */}
      {badges.length === 0 ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {examId === 'all'
            ? 'No student scores found to compute overall badges.'
            : 'No scores found for this exam. Make sure scores have been imported.'}
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
          {badges.map(award => {
            const def = BADGES[award.badgeId]
            const isOn = selected.has(award.key)
            return (
              <div
                key={award.key}
                onClick={() => toggle(award.key)}
                className="relative rounded-2xl p-3 sm:p-4 cursor-pointer transition-all overflow-hidden select-none"
                style={{
                  border: `2px solid ${isOn ? def.color : 'var(--color-border)'}`,
                  background: isOn
                    ? `linear-gradient(135deg, ${def.bg1} 0%, ${def.bg2} 100%)`
                    : 'var(--color-bg)',
                }}
              >
                {/* Checkbox */}
                <div
                  className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all"
                  style={{
                    borderColor: isOn ? def.color : 'var(--color-border)',
                    backgroundColor: isOn ? def.color : 'transparent',
                  }}
                >
                  {isOn && <span className="text-white text-[9px] leading-none font-bold">✓</span>}
                </div>

                {isOn && (
                  <div
                    className="absolute top-5 left-3 w-8 h-8 rounded-full blur-xl opacity-60"
                    style={{ backgroundColor: def.color }}
                  />
                )}

                <div className="text-3xl sm:text-4xl mb-1.5 relative">{def.emoji}</div>
                <div className="text-[10px] font-bold mb-0.5 relative" style={{ color: isOn ? def.color : 'var(--color-text-muted)' }}>
                  {def.name}
                </div>
                <div
                  className="text-xs font-semibold leading-tight relative"
                  style={{ color: isOn ? '#ffffff' : 'var(--color-text-primary)' }}
                >
                  {award.studentName}
                </div>
                {award.detail && (
                  <div
                    className="text-[10px] mt-1 truncate relative"
                    style={{ color: isOn ? 'rgba(255,255,255,0.5)' : 'var(--color-text-muted)' }}
                  >
                    {award.detail}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      {badges.length > 0 && (
        <div className="flex flex-col items-end gap-2">
          {error && <p className="text-xs" style={{ color: 'var(--color-danger)' }}>{error}</p>}
          <button
            onClick={handleNext}
            disabled={selected.size === 0 || isGenerating}
            className="px-5 py-2 text-sm font-medium rounded-xl text-white disabled:opacity-50 flex items-center gap-2 transition-opacity"
            style={{ backgroundColor: CYAN }}
          >
            {isGenerating && <Loader2 size={13} className="animate-spin" />}
            {isGenerating ? 'Generating badges…' : `Next → (${selected.size})`}
          </button>
        </div>
      )}
    </div>
  )
}
