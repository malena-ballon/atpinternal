import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ExamStats } from '../PerformanceInsights'

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

const C = { cyan: '#0BB5C7', dark: '#111827', mid: '#374151', muted: '#6B7280', border: '#E5E7EB', altRow: '#F9FAFB', success: '#16A34A', danger: '#DC2626' }

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: 'Helvetica', backgroundColor: '#FFFFFF' },
  brand: { fontSize: 7, color: C.muted, letterSpacing: 1, marginBottom: 4 },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: C.dark, marginBottom: 3 },
  subtitle: { fontSize: 10, color: C.mid, marginBottom: 2 },
  examName: { fontSize: 9, color: C.muted },
  genDate: { fontSize: 7, color: C.muted, marginTop: 4 },
  divider: { borderBottomWidth: 1, borderBottomColor: C.border, marginTop: 10, marginBottom: 16 },
  sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.dark, marginBottom: 8, marginTop: 14 },
  statRow: { flexDirection: 'row', marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 6, padding: 10, marginRight: 6, alignItems: 'center' },
  statValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.dark },
  statLabel: { fontSize: 7, color: C.muted, marginTop: 2 },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  barLabel: { width: 100, fontSize: 8, color: C.mid },
  barTrack: { flex: 1, height: 10, backgroundColor: '#E5E7EB', borderRadius: 4 },
  barValue: { width: 38, textAlign: 'right', fontSize: 8, color: C.dark },
  tableHeader: { flexDirection: 'row', backgroundColor: '#F3F4F6', paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  tableRow: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: C.border },
  tableRowAlt: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, backgroundColor: C.altRow, borderBottomWidth: 0.5, borderBottomColor: C.border },
  th: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.muted, textTransform: 'uppercase' },
  td: { fontSize: 9, color: C.mid },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: C.muted },
})

const DIST_COLORS = ['#22c55e', C.cyan, '#f59e0b', '#f97316', '#ef4444']

interface Props {
  className: string
  stats: ExamStats
  classPassingPct: number
}

export default function ExamReportPDF({ className, stats, classPassingPct }: Props) {
  const effectivePassing = stats.exam.passing_pct_override ?? classPassingPct
  const passRate = stats.scores.length > 0
    ? Math.round((stats.passCount / stats.scores.length) * 100) : 0

  const sortedByPct = [...stats.scores].sort((a, b) => b.percentage - a.percentage)

  // Compute per-student percentile within this exam
  const total = stats.scores.length
  const percentileMap = new Map(stats.scores.map(s => {
    const countLE = stats.scores.filter(x => x.percentage <= s.percentage).length
    return [s.id, Math.round((countLE / total) * 100)]
  }))

  const genDate = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
  const examDate = stats.exam.date
    ? new Date(stats.exam.date).toLocaleDateString('en-US', { dateStyle: 'medium' }) : null

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <Text style={s.brand}>ACADGENIUS TUTORIAL POWERHOUSE</Text>
        <Text style={s.title}>Individual Exam Report</Text>
        <Text style={s.subtitle}>{className}</Text>
        <Text style={s.examName}>
          {stats.exam.name}{stats.exam.subjects?.name ? ` · ${stats.exam.subjects.name}` : ''}{examDate ? ` · ${examDate}` : ''}
        </Text>
        <Text style={s.genDate}>Generated: {genDate}</Text>
        <View style={s.divider} />

        {/* Summary stats */}
        <View style={s.statRow}>
          {[
            { label: 'Class Avg', value: stats.avg.toFixed(1) + '%' },
            { label: 'Median', value: stats.median.toFixed(1) + '%' },
            { label: 'Std Dev', value: '±' + stats.stdDev.toFixed(1) + '%' },
            { label: 'Perfect Scores', value: String(stats.perfectCount) },
          ].map((c, i) => (
            <View key={c.label} style={[s.statCard, i === 3 ? { marginRight: 0 } : {}]}>
              <Text style={s.statValue}>{c.value}</Text>
              <Text style={s.statLabel}>{c.label}</Text>
            </View>
          ))}
        </View>

        {/* Pass / Fail */}
        <View style={{ flexDirection: 'row', marginBottom: 14, gap: 8 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(34,197,94,0.08)', borderRadius: 8, padding: 10 }}>
            <Text style={{ fontSize: 18, fontFamily: 'Helvetica-Bold', color: C.success }}>{stats.passCount} passed</Text>
            <Text style={{ fontSize: 8, color: C.success, marginTop: 2 }}>{passRate}% pass rate · passing {effectivePassing}%</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: 'rgba(239,68,68,0.06)', borderRadius: 8, padding: 10 }}>
            <Text style={{ fontSize: 18, fontFamily: 'Helvetica-Bold', color: C.danger }}>{stats.failCount} failed</Text>
            <Text style={{ fontSize: 8, color: C.danger, marginTop: 2 }}>
              Highest: {stats.highest?.pct.toFixed(1)}% ({stats.highest?.name ?? '—'})
            </Text>
            <Text style={{ fontSize: 8, color: C.muted }}>
              Lowest: {stats.lowest?.pct.toFixed(1)}% ({stats.lowest?.name ?? '—'})
            </Text>
          </View>
        </View>

        {/* Score Distribution */}
        <Text style={s.sectionTitle}>Score Distribution</Text>
        {stats.distribution.map((b, i) => (
          <View key={b.bracket} style={s.barRow}>
            <Text style={s.barLabel}>{b.bracket}</Text>
            <View style={s.barTrack}>
              {stats.scores.length > 0 && b.count > 0 && (
                <View style={{
                  width: `${(b.count / stats.scores.length) * 100}%`,
                  height: 10,
                  backgroundColor: DIST_COLORS[i] ?? C.cyan,
                  borderRadius: 4,
                }} />
              )}
            </View>
            <Text style={s.barValue}>{b.count} student{b.count !== 1 ? 's' : ''}</Text>
          </View>
        ))}

        {/* Student Scores Table */}
        {sortedByPct.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Student Scores &amp; Percentile Ranks</Text>
            <View style={s.tableHeader}>
              {['#', 'Student', 'Score', '%', 'Percentile', 'Result'].map((h, i) => (
                <Text key={h} style={[s.th, { flex: [0.3, 2.5, 1, 0.8, 1, 0.8][i] }]}>{h}</Text>
              ))}
            </View>
            {sortedByPct.map((sc, i) => {
              const passes = sc.percentage >= effectivePassing
              return (
                <View key={sc.id} style={i % 2 === 1 ? s.tableRowAlt : s.tableRow}>
                  <Text style={[s.td, { flex: 0.3, color: C.muted }]}>{i + 1}</Text>
                  <Text style={[s.td, { flex: 2.5, fontFamily: 'Helvetica-Bold', color: C.dark }]}>{sc.students?.name ?? '—'}</Text>
                  <Text style={[s.td, { flex: 1 }]}>{sc.raw_score} / {sc.total_items}</Text>
                  <Text style={[s.td, { flex: 0.8, fontFamily: 'Helvetica-Bold' }]}>{sc.percentage.toFixed(1)}%</Text>
                  <Text style={[s.td, { flex: 1, color: C.muted }]}>{ordinal(percentileMap.get(sc.id) ?? 0)}</Text>
                  <Text style={[s.td, { flex: 0.8, color: passes ? C.success : C.danger }]}>{passes ? 'Pass' : 'Fail'}</Text>
                </View>
              )
            })}
          </>
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Generated by Acadgenius Tutorial Powerhouse</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
