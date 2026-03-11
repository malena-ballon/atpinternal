import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { StudentStats } from '../PerformanceInsights'

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

const C = { cyan: '#0BB5C7', dark: '#111827', mid: '#374151', muted: '#6B7280', border: '#E5E7EB', altRow: '#F9FAFB', success: '#16A34A', danger: '#DC2626', warn: '#D97706' }

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: 'Helvetica', backgroundColor: '#FFFFFF' },
  brand: { fontSize: 7, color: C.muted, letterSpacing: 1, marginBottom: 4 },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: C.dark, marginBottom: 3 },
  subtitle: { fontSize: 10, color: C.mid, marginBottom: 2 },
  studentInfo: { fontSize: 9, color: C.muted },
  genDate: { fontSize: 7, color: C.muted, marginTop: 4 },
  divider: { borderBottomWidth: 1, borderBottomColor: C.border, marginTop: 10, marginBottom: 16 },
  sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.dark, marginBottom: 8, marginTop: 14 },
  statRow: { flexDirection: 'row', marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 6, padding: 10, marginRight: 6, alignItems: 'center' },
  statValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.dark },
  statLabel: { fontSize: 7, color: C.muted, marginTop: 2 },
  infoRow: { flexDirection: 'row', marginBottom: 10, gap: 8 },
  infoCard: { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 8, padding: 10 },
  infoCardLabel: { fontSize: 7, color: C.muted, marginBottom: 3 },
  infoCardValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.dark },
  infoCardSub: { fontSize: 8, color: C.muted, marginTop: 2 },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  barLabel: { width: 130, fontSize: 8, color: C.mid },
  barTrack: { flex: 1, height: 8, backgroundColor: '#E5E7EB', borderRadius: 4 },
  barValue: { width: 38, textAlign: 'right', fontSize: 8, color: C.dark },
  tableHeader: { flexDirection: 'row', backgroundColor: '#F3F4F6', paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  tableRow: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: C.border },
  tableRowAlt: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, backgroundColor: C.altRow, borderBottomWidth: 0.5, borderBottomColor: C.border },
  th: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.muted, textTransform: 'uppercase' },
  td: { fontSize: 9, color: C.mid },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: C.muted },
})

interface Props {
  className: string
  stats: StudentStats
  totalStudents: number
  totalExams: number
  classPassingPct: number
  subjectPercentileByExam?: Record<string, Record<string, number>>
  pdfSubjects?: { id: string; name: string }[]
}

export default function StudentReportPDF({ className, stats, totalStudents, totalExams, classPassingPct, subjectPercentileByExam, pdfSubjects }: Props) {
  const genDate = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
  const trendLabel = stats.trend === 'improving' ? '↑ Improving' : stats.trend === 'declining' ? '↓ Declining' : '→ Steady'
  const trendColor = stats.trend === 'improving' ? C.success : stats.trend === 'declining' ? C.danger : C.muted

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <Text style={s.brand}>ACADGENIUS TUTORIAL POWERHOUSE</Text>
        <Text style={s.title}>Individual Student Report</Text>
        <Text style={s.subtitle}>{className}</Text>
        <Text style={s.studentInfo}>
          {stats.student.name}{stats.student.school ? ` · ${stats.student.school}` : ''}{stats.student.email ? ` · ${stats.student.email}` : ''}
        </Text>
        <Text style={s.genDate}>Generated: {genDate}</Text>
        <View style={s.divider} />

        {/* Summary stats */}
        <View style={s.statRow}>
          {[
            { label: 'Overall Avg', value: stats.avgPct.toFixed(1) + '%' },
            { label: 'Class Rank', value: `${ordinal(stats.rank)} of ${totalStudents}` },
            { label: 'Percentile', value: ordinal(stats.percentile) },
            { label: 'Exams Taken', value: `${stats.examsTaken} / ${totalExams}` },
          ].map((c, i) => (
            <View key={c.label} style={[s.statCard, i === 3 ? { marginRight: 0 } : {}]}>
              <Text style={s.statValue}>{c.value}</Text>
              <Text style={s.statLabel}>{c.label}</Text>
            </View>
          ))}
        </View>

        {/* Trend + High + Low */}
        <View style={s.infoRow}>
          <View style={s.infoCard}>
            <Text style={s.infoCardLabel}>Performance Trend</Text>
            <Text style={[s.infoCardValue, { color: trendColor }]}>{trendLabel}</Text>
          </View>
          <View style={s.infoCard}>
            <Text style={s.infoCardLabel}>Highest Score</Text>
            <Text style={[s.infoCardValue, { color: C.success }]}>{stats.highest?.pct.toFixed(1) ?? '—'}%</Text>
            {stats.highest && <Text style={s.infoCardSub}>{stats.highest.exam.name}</Text>}
          </View>
          <View style={[s.infoCard, { marginRight: 0 }]}>
            <Text style={s.infoCardLabel}>Lowest Score</Text>
            <Text style={[s.infoCardValue, { color: C.danger }]}>{stats.lowest?.pct.toFixed(1) ?? '—'}%</Text>
            {stats.lowest && <Text style={s.infoCardSub}>{stats.lowest.exam.name}</Text>}
          </View>
        </View>

        {/* Performance per exam bar chart */}
        {stats.scores.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Performance Per Exam</Text>
            {stats.scores.map(sc => {
              const passes = sc.percentage >= (sc.exam.passing_pct_override ?? classPassingPct)
              return (
                <View key={sc.id} style={s.barRow}>
                  <Text style={s.barLabel}>{sc.exam.name}</Text>
                  <View style={s.barTrack}>
                    <View style={{ width: `${Math.min(sc.percentage, 100)}%`, height: 8, backgroundColor: passes ? C.success : C.danger, borderRadius: 4 }} />
                  </View>
                  <Text style={s.barValue}>{sc.percentage.toFixed(1)}%</Text>
                </View>
              )
            })}
          </>
        )}

        {/* Score per exam table */}
        {stats.scores.length > 0 && (() => {
          const subjCols = pdfSubjects ?? []
          const abbrev = (name: string) => name.length > 7 ? name.slice(0, 6) + '.' : name
          const subjFlex = 0.6
          const headers = ['Exam', 'Score', '%', ...subjCols.map(s => abbrev(s.name)), 'Result']
          const flexes = [1.8, 0.85, 0.55, ...subjCols.map(() => subjFlex), 0.55]
          return (
            <>
              <Text style={s.sectionTitle}>Detailed Scores</Text>
              <View style={s.tableHeader}>
                {headers.map((h, i) => (
                  <Text key={h + i} style={[s.th, { flex: flexes[i] }]}>{h}</Text>
                ))}
              </View>
              {stats.scores.map((sc, i) => {
                const effectivePassing = sc.exam.passing_pct_override ?? classPassingPct
                const passes = sc.percentage >= effectivePassing
                const examSubjMap = subjectPercentileByExam?.[sc.exam.id]
                return (
                  <View key={sc.id} style={i % 2 === 1 ? s.tableRowAlt : s.tableRow}>
                    <Text style={[s.td, { flex: 1.8, fontFamily: 'Helvetica-Bold', color: C.dark }]}>{sc.exam.name}</Text>
                    <Text style={[s.td, { flex: 0.85 }]}>{sc.raw_score} / {sc.total_items}</Text>
                    <Text style={[s.td, { flex: 0.55, fontFamily: 'Helvetica-Bold' }]}>{sc.percentage.toFixed(1)}%</Text>
                    {subjCols.map(subj => {
                      const pct = examSubjMap?.[subj.id]
                      return <Text key={subj.id} style={[s.td, { flex: subjFlex, color: C.muted }]}>{pct !== undefined ? ordinal(pct) : '—'}</Text>
                    })}
                    <Text style={[s.td, { flex: 0.55, color: passes ? C.success : C.danger }]}>{passes ? 'Pass' : 'Fail'}</Text>
                  </View>
                )
              })}
            </>
          )
        })()}

        {stats.scores.length === 0 && (
          <Text style={{ fontSize: 9, color: C.muted, textAlign: 'center', marginTop: 20 }}>No exam scores recorded for this student.</Text>
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
