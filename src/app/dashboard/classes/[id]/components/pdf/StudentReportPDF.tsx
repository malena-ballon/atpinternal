import { Document, Page, View, Text, Image, StyleSheet, Svg, Circle, Path } from '@react-pdf/renderer'
import type { StudentStats } from '../PerformanceInsights'

export type PDFSubjectStat = {
  id: string
  name: string
  avgGrade: number | null
  highestGrade: number | null
  avgPercentile: number | null
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

const C = {
  cyan: '#0BB5C7', dark: '#111827', mid: '#374151', muted: '#6B7280',
  border: '#E5E7EB', altRow: '#F9FAFB', success: '#16A34A', danger: '#DC2626', warn: '#D97706',
}

const st = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: 'Helvetica', backgroundColor: '#FFFFFF' },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: C.dark, marginBottom: 3 },
  subtitle: { fontSize: 10, color: C.mid, marginBottom: 2 },
  studentInfo: { fontSize: 9, color: C.muted },
  genDate: { fontSize: 7, color: C.muted, marginTop: 4 },
  divider: { borderBottomWidth: 1, borderBottomColor: C.border, marginTop: 10, marginBottom: 14 },
  sectionTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, marginTop: 14 },
  // Stat cards
  statRow: { flexDirection: 'row', marginBottom: 10 },
  statCard: { flex: 1, backgroundColor: C.altRow, borderRadius: 6, padding: 10, marginRight: 6, alignItems: 'center' },
  statValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.dark },
  statLabel: { fontSize: 7, color: C.muted, marginTop: 2 },
  // Table
  tableHeader: { flexDirection: 'row', backgroundColor: '#F3F4F6', paddingVertical: 5, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: C.border },
  tableRow: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: C.border },
  tableRowAlt: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 6, backgroundColor: C.altRow, borderBottomWidth: 0.5, borderBottomColor: C.border },
  th: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.muted, textTransform: 'uppercase' },
  td: { fontSize: 8, color: C.mid },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: C.muted },
})

// ── SVG Radar Chart ───────────────────────────────────────────────────────────
function PDFRadarChart({ data }: { data: PDFSubjectStat[] }) {
  if (data.length < 3) return null
  const N = data.length
  const cx = 90, cy = 90, R = 65

  const getXY = (i: number, r: number) => {
    const a = (i / N) * 2 * Math.PI - Math.PI / 2
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
  }

  const gridLevels = [0.25, 0.5, 0.75, 1]
  const gridPaths = gridLevels.map(level => {
    const pts = Array.from({ length: N }, (_, i) => {
      const { x, y } = getXY(i, R * level)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    return `M${pts.join(' L')} Z`
  })

  const axisLines = Array.from({ length: N }, (_, i) => {
    const { x, y } = getXY(i, R)
    return `M${cx},${cy} L${x.toFixed(1)},${y.toFixed(1)}`
  })

  const avg = (d: PDFSubjectStat) => Math.min(d.avgGrade ?? 0, 100)
  const dataPts = data.map((d, i) => {
    const { x, y } = getXY(i, (avg(d) / 100) * R)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  return (
    <Svg width={200} height={200} viewBox="0 0 180 180">
      {/* Filled background grid rings */}
      {gridPaths.map((d, i) => (
        <Path key={`g${i}`} d={d} fill={i === gridLevels.length - 1 ? '#E5E7EB' : 'none'} fillOpacity={i === gridLevels.length - 1 ? 0.45 : 1} stroke="#D1D5DB" strokeWidth={i === gridLevels.length - 1 ? 1 : 0.75} />
      ))}
      {/* Axis lines */}
      {axisLines.map((d, i) => <Path key={`a${i}`} d={d} stroke="#D1D5DB" strokeWidth={0.75} />)}
      {/* Data polygon fill */}
      <Path d={`M${dataPts.join(' L')} Z`} fill={C.cyan} fillOpacity={0.25} stroke={C.cyan} strokeWidth={2} />
      {/* Data dots */}
      {data.map((d, i) => {
        const { x, y } = getXY(i, (avg(d) / 100) * R)
        return <Circle key={`p${i}`} cx={x} cy={y} r={3.5} fill={C.cyan} />
      })}
      {/* Labels */}
      {data.map((d, i) => {
        const { x, y } = getXY(i, R + 14)
        const label = d.name.length > 9 ? d.name.slice(0, 8) + '.' : d.name
        return <Text key={`l${i}`} x={x.toFixed(1)} y={y.toFixed(1)} style={{ fontSize: 5.5, fill: C.mid }} textAnchor="middle">{label}</Text>
      })}
    </Svg>
  )
}

// ── SVG Trend Line Chart ──────────────────────────────────────────────────────
function PDFTrendChart({ data, trendColor }: { data: { name: string; pct: number }[]; trendColor: string }) {
  if (data.length < 2) return null
  const W = 230, H = 90
  const pL = 24, pR = 8, pT = 8, pB = 8
  const cW = W - pL - pR, cH = H - pT - pB
  const xStep = cW / (data.length - 1)
  const yPos = (pct: number) => pT + cH - (Math.max(0, Math.min(pct, 100)) / 100) * cH

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${(pL + i * xStep).toFixed(1)},${yPos(d.pct).toFixed(1)}`).join(' ')

  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {/* Grid lines */}
      {[25, 50, 75, 100].map(v => (
        <Path key={v} d={`M${pL},${yPos(v).toFixed(1)} L${(W - pR).toFixed(1)},${yPos(v).toFixed(1)}`} stroke="#F3F4F6" strokeWidth={0.5} />
      ))}
      {/* Y labels */}
      {[0, 50, 100].map(v => (
        <Text key={v} x={(pL - 3).toFixed(1)} y={(yPos(v) + 2).toFixed(1)} style={{ fontSize: 5, fill: C.muted }} textAnchor="end">{v}%</Text>
      ))}
      {/* Trend line */}
      <Path d={linePath} fill="none" stroke={trendColor} strokeWidth={1.5} />
      {/* Dots */}
      {data.map((d, i) => (
        <Circle key={i} cx={(pL + i * xStep).toFixed(1)} cy={yPos(d.pct).toFixed(1)} r={2.5} fill={trendColor} />
      ))}
    </Svg>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  className: string
  stats: StudentStats
  totalStudents: number
  totalExams: number
  classPassingPct: number
  subjectPercentileByExam?: Record<string, Record<string, number>>
  pdfSubjects?: { id: string; name: string }[]
  subjectStats?: PDFSubjectStat[]
  highestByExam?: Record<string, { pct: number; name: string }>
}

export default function StudentReportPDF({
  className, stats, totalStudents, totalExams, classPassingPct,
  subjectPercentileByExam, pdfSubjects, subjectStats, highestByExam,
}: Props) {
  const genDate = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
  const trendLabel = stats.trend === 'improving' ? '↑ Improving' : stats.trend === 'declining' ? '↓ Declining' : '→ Steady'
  const trendColor = stats.trend === 'improving' ? C.success : stats.trend === 'declining' ? C.danger : C.muted

  const trendData = stats.scores.map(s => ({ name: s.exam.name, pct: parseFloat(s.percentage.toFixed(1)) }))

  const upcatDate = new Date('2026-08-06')
  const daysUntilUpcat = Math.ceil((upcatDate.getTime() - Date.now()) / 86400000)
  const upcatColor = '#1E3A5F'

  const visibleSubjects = subjectStats?.filter(s => s.avgGrade !== null) ?? []

  return (
    <Document>
      <Page size="A4" style={st.page}>

        {/* ── HEADER (unchanged) ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <Image src={`${window.location.origin}/logo.jpg`} style={{ width: 30, height: 30, marginRight: 8, borderRadius: 4 }} />
          <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.dark }}>Acadgenius Tutorial Powerhouse</Text>
        </View>
        <Text style={st.title}>Individual Student Report</Text>
        <Text style={st.subtitle}>{className}</Text>
        <Text style={st.studentInfo}>
          {stats.student.name}{stats.student.school ? ` · ${stats.student.school}` : ''}{stats.student.email ? ` · ${stats.student.email}` : ''}
        </Text>
        <Text style={st.genDate}>Generated: {genDate}</Text>
        <View style={st.divider} />

        {/* ── ROW 1: UPCAT countdown (leftmost) + 3 stat cards ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          {daysUntilUpcat > 0 && (
            <View style={{ alignItems: 'center', paddingRight: 14, paddingLeft: 4 }}>
              <Text style={{ fontSize: 22, fontFamily: 'Helvetica-Bold', color: upcatColor, lineHeight: 1 }}>{daysUntilUpcat}</Text>
              <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', color: upcatColor, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>days until UPCAT</Text>
              <Text style={{ fontSize: 6, color: C.muted, marginTop: 1 }}>Aug 6, 2026</Text>
              {stats.trend === 'improving' && (
                <Text style={{ fontSize: 5.5, color: C.success, marginTop: 3 }}>trending up ↑</Text>
              )}
            </View>
          )}
          <View style={{ flexDirection: 'row', flex: 1 }}>
            {[
              { label: 'Overall Average', value: stats.avgPct.toFixed(1) + '%' },
              { label: 'Class Rank', value: `${ordinal(stats.rank)} of ${totalStudents}` },
              { label: 'Exams Taken', value: `${stats.examsTaken} / ${totalExams}` },
            ].map((c, i, arr) => (
              <View key={c.label} style={[st.statCard, i === arr.length - 1 ? { marginRight: 0 } : {}]}>
                <Text style={st.statValue}>{c.value}</Text>
                <Text style={st.statLabel}>{c.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── ROW 2: Radar chart (left) + Trend line (right) ── */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 4 }}>
          {/* Left: Spider chart */}
          <View style={{ flex: 1, backgroundColor: C.altRow, borderRadius: 8, padding: 10 }}>
            <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.dark, marginBottom: 2 }}>Performance Per Subject</Text>
            <Text style={{ fontSize: 7, color: C.muted, marginBottom: 6 }}>Average score across all exams</Text>
            {visibleSubjects.length >= 3 ? (
              <View style={{ alignItems: 'center' }}>
                <PDFRadarChart data={visibleSubjects} />
              </View>
            ) : visibleSubjects.length > 0 ? (
              // Fallback: horizontal bars for < 3 subjects
              <View style={{ paddingTop: 4 }}>
                {visibleSubjects.map(subj => (
                  <View key={subj.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={{ fontSize: 7, color: C.mid, width: 80 }}>{subj.name}</Text>
                    <View style={{ flex: 1, height: 6, backgroundColor: C.border, borderRadius: 3 }}>
                      <View style={{ width: `${Math.min(subj.avgGrade ?? 0, 100)}%`, height: 6, backgroundColor: C.cyan, borderRadius: 3 }} />
                    </View>
                    <Text style={{ fontSize: 7, color: C.dark, width: 36, textAlign: 'right' }}>{(subj.avgGrade ?? 0).toFixed(1)}%</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ fontSize: 7, color: C.muted, textAlign: 'center', marginTop: 20 }}>No subject data.</Text>
            )}
          </View>

          {/* Right: Trend line chart */}
          <View style={{ flex: 1, backgroundColor: C.altRow, borderRadius: 8, padding: 10 }}>
            <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.dark, marginBottom: 2 }}>Overall Performance Trend</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ fontSize: 7, color: C.muted, flex: 1 }}>Score history across exams</Text>
              <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: trendColor }}>{trendLabel}</Text>
            </View>
            {trendData.length >= 2 ? (
              <>
                <PDFTrendChart data={trendData} trendColor={trendColor} />
                {/* Stats summary below the chart */}
                {(() => {
                  const vals = trendData.map(d => d.pct)
                  const high = Math.max(...vals)
                  const low = Math.min(...vals)
                  const avg = vals.reduce((a, b) => a + b, 0) / vals.length
                  const highExam = trendData.find(d => d.pct === high)?.name ?? ''
                  const lowExam = trendData.find(d => d.pct === low)?.name ?? ''
                  const statItems = [
                    { label: 'Highest', value: `${high.toFixed(1)}%`, sub: highExam, color: C.success },
                    { label: 'Average', value: `${avg.toFixed(1)}%`, sub: `${vals.length} exams`, color: C.cyan },
                    { label: 'Lowest', value: `${low.toFixed(1)}%`, sub: lowExam, color: C.danger },
                  ]
                  return (
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
                      {statItems.map(s => (
                        <View key={s.label} style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 5, padding: 7, alignItems: 'center' }}>
                          <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: s.color }}>{s.value}</Text>
                          <Text style={{ fontSize: 6, color: C.muted, marginTop: 1 }}>{s.label}</Text>
                          <Text style={{ fontSize: 5.5, color: C.muted, marginTop: 1 }}>{s.sub.length > 10 ? s.sub.slice(0, 9) + '.' : s.sub}</Text>
                        </View>
                      ))}
                    </View>
                  )
                })()}
              </>
            ) : (
              <Text style={{ fontSize: 7, color: C.muted, textAlign: 'center', marginTop: 20 }}>Need at least 2 exams.</Text>
            )}
          </View>
        </View>

        {/* ── ROW 3: Subject breakdown cards ── */}
        {visibleSubjects.length > 0 && (
          <>
            <Text style={st.sectionTitle}>Subject Breakdown</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {visibleSubjects.map(subj => {
                const pctColor = (subj.avgPercentile ?? 0) >= 75 ? C.success
                  : (subj.avgPercentile ?? 0) >= 50 ? C.cyan
                  : (subj.avgPercentile ?? 0) >= 25 ? C.warn : C.danger
                return (
                  <View key={subj.id} style={{ width: 118, backgroundColor: C.altRow, borderRadius: 6, padding: 8 }}>
                    <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.dark, marginBottom: 4 }}>{subj.name.length > 16 ? subj.name.slice(0, 15) + '…' : subj.name}</Text>
                    {subj.avgPercentile !== null && (
                      <>
                        <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: pctColor }}>{ordinal(subj.avgPercentile)}</Text>
                        <Text style={{ fontSize: 6, color: C.muted, marginBottom: 4 }}>Avg Percentile</Text>
                      </>
                    )}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 7, color: C.muted }}>Your Avg Score</Text>
                      <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.dark }}>{subj.avgGrade!.toFixed(1)}%</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                      <Text style={{ fontSize: 7, color: C.muted }}>Top Student Avg</Text>
                      <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.success }}>{subj.highestGrade!.toFixed(1)}%</Text>
                    </View>
                  </View>
                )
              })}
            </View>
          </>
        )}

        {/* ── ROW 4: Detailed scores per exam ── */}
        {stats.scores.length > 0 && (() => {
          const subjCols = pdfSubjects ?? []
          const abbrev = (name: string) => name.length > 7 ? name.slice(0, 6) + '.' : name
          const subjFlex = 0.55
          const hasTopScore = !!highestByExam && Object.keys(highestByExam).length > 0
          const headers = ['Exam', 'Score', '%', ...subjCols.map(s => abbrev(s.name)), ...(hasTopScore ? ['Top Score'] : []), 'Result']
          const flexes = [1.7, 0.8, 0.5, ...subjCols.map(() => subjFlex), ...(hasTopScore ? [0.6] : []), 0.5]
          return (
            <>
              <Text style={[st.sectionTitle, { marginTop: 14 }]}>Score Per Exam</Text>
              {hasTopScore && <Text style={{ fontSize: 6.5, color: C.muted, marginBottom: 6 }}>Top score refers to the highest score obtained by a student.</Text>}
              <View style={st.tableHeader}>
                {headers.map((h, i) => <Text key={h + i} style={[st.th, { flex: flexes[i] }]}>{h}</Text>)}
              </View>
              {stats.scores.map((sc, i) => {
                const effectivePassing = sc.exam.passing_pct_override ?? classPassingPct
                const passes = sc.percentage >= effectivePassing
                const examSubjMap = subjectPercentileByExam?.[sc.exam.id]
                const top = highestByExam?.[sc.exam.id]
                const isTop = top && Math.abs(top.pct - sc.percentage) < 0.01
                return (
                  <View key={sc.id} style={i % 2 === 1 ? st.tableRowAlt : st.tableRow}>
                    <Text style={[st.td, { flex: 1.7, fontFamily: 'Helvetica-Bold', color: C.dark }]}>{sc.exam.name}</Text>
                    <Text style={[st.td, { flex: 0.8 }]}>{sc.raw_score} / {sc.total_items}</Text>
                    <Text style={[st.td, { flex: 0.5, fontFamily: 'Helvetica-Bold' }]}>{sc.percentage.toFixed(1)}%</Text>
                    {subjCols.map(subj => {
                      const pct = examSubjMap?.[subj.id]
                      return <Text key={subj.id} style={[st.td, { flex: subjFlex, color: C.muted }]}>{pct !== undefined ? ordinal(pct) : '—'}</Text>
                    })}
                    {hasTopScore && (
                      <Text style={[st.td, { flex: 0.6, color: isTop ? C.success : C.muted }]}>
                        {top ? `${isTop ? '* ' : ''}${top.pct.toFixed(1)}%` : '—'}
                      </Text>
                    )}
                    <Text style={[st.td, { flex: 0.5, color: passes ? C.success : C.danger }]}>{passes ? 'Pass' : 'Fail'}</Text>
                  </View>
                )
              })}
            </>
          )
        })()}

        {stats.scores.length === 0 && (
          <Text style={{ fontSize: 9, color: C.muted, textAlign: 'center', marginTop: 20 }}>No exam scores recorded for this student.</Text>
        )}

        {/* ── FOOTER ── */}
        <View style={st.footer} fixed>
          <Text style={st.footerText}>Generated by Acadgenius Tutorial Powerhouse</Text>
          <Text style={st.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
