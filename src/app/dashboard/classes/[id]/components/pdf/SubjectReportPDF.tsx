import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ExamStats } from '../PerformanceInsights'

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
  tableHeader: { flexDirection: 'row', backgroundColor: '#F3F4F6', paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  tableRow: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: C.border },
  tableRowAlt: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, backgroundColor: C.altRow, borderBottomWidth: 0.5, borderBottomColor: C.border },
  th: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.muted, textTransform: 'uppercase' },
  td: { fontSize: 9, color: C.mid },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: C.muted },
})

export interface SubjectReportStats {
  subjectName: string
  avg: number
  median: number
  stdDev: number
  passRate: number
  totalScores: number
  examBreakdown: ExamStats[]
  students: { name: string; id: string; avg: number; examsTaken: number }[]
}

interface Props {
  className: string
  stats: SubjectReportStats
  classPassingPct: number
  maskedStudentId?: string
  topNVisible?: number
}

function anonymLabel(i: number) {
  if (i < 26) return String.fromCharCode(65 + i)
  return String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26))
}

export default function SubjectReportPDF({ className, stats, classPassingPct, maskedStudentId, topNVisible }: Props) {
  const genDate = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <Text style={s.brand}>ACADGENIUS TUTORIAL POWERHOUSE</Text>
        <Text style={s.title}>Subject Performance Report</Text>
        <Text style={s.subtitle}>{className}</Text>
        <Text style={s.examName}>{stats.subjectName}</Text>
        <Text style={s.genDate}>Generated: {genDate}</Text>
        <View style={s.divider} />

        {/* Summary stats */}
        <View style={s.statRow}>
          {[
            { label: 'Subject Avg', value: stats.avg.toFixed(1) + '%' },
            { label: 'Median', value: stats.median.toFixed(1) + '%' },
            { label: 'Pass Rate', value: stats.passRate.toFixed(0) + '%' },
            { label: 'Total Scores', value: String(stats.totalScores) },
          ].map((c, i) => (
            <View key={c.label} style={[s.statCard, i === 3 ? { marginRight: 0 } : {}]}>
              <Text style={s.statValue}>{c.value}</Text>
              <Text style={s.statLabel}>{c.label}</Text>
            </View>
          ))}
        </View>

        {/* Exam Breakdown Table */}
        {stats.examBreakdown.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Exam Breakdown</Text>
            <View style={s.tableHeader}>
              {['Exam Name', 'Avg', 'Pass Rate', 'Highest', 'Students'].map((h, i) => (
                <Text key={h} style={[s.th, { flex: [2, 0.8, 0.8, 1.2, 0.8][i] }]}>{h}</Text>
              ))}
            </View>
            {stats.examBreakdown.map((es, i) => {
              const pr = es.scores.length > 0 ? (es.passCount / es.scores.length * 100) : 0
              return (
                <View key={es.exam.id} style={i % 2 === 1 ? s.tableRowAlt : s.tableRow}>
                  <Text style={[s.td, { flex: 2, fontFamily: 'Helvetica-Bold', color: C.dark }]}>{es.exam.name}</Text>
                  <Text style={[s.td, { flex: 0.8 }]}>{es.avg.toFixed(1)}%</Text>
                  <Text style={[s.td, { flex: 0.8, color: pr >= 60 ? C.success : C.danger }]}>{pr.toFixed(0)}%</Text>
                  <Text style={[s.td, { flex: 1.2, color: C.muted }]}>{es.highest ? `${es.highest.pct.toFixed(0)}%` : '—'}</Text>
                  <Text style={[s.td, { flex: 0.8, color: C.muted }]}>{es.scores.length}</Text>
                </View>
              )
            })}
          </>
        )}

        {/* Student Performance Table */}
        {stats.students.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Student Performance Ranking</Text>
            <View style={s.tableHeader}>
              {['Rank', 'Student', 'Exams Taken', 'Average', 'Status'].map((h, i) => (
                <Text key={h} style={[s.th, { flex: [0.5, 2.5, 1, 1, 1][i] }]}>{h}</Text>
              ))}
            </View>
            {stats.students.map((st, i) => {
              const passes = st.avg >= classPassingPct
              const displayName = maskedStudentId
                ? (st.id === maskedStudentId ? st.name : `Student ${anonymLabel(i)}`)
                : topNVisible !== undefined && i >= topNVisible
                  ? `Student ${anonymLabel(i)}`
                  : st.name
              return (
                <View key={st.id} style={i % 2 === 1 ? s.tableRowAlt : s.tableRow}>
                  <Text style={[s.td, { flex: 0.5, color: C.muted }]}>{i + 1}</Text>
                  <Text style={[s.td, { flex: 2.5, fontFamily: 'Helvetica-Bold', color: C.dark }]}>{displayName}</Text>
                  <Text style={[s.td, { flex: 1 }]}>{st.examsTaken} / {stats.examBreakdown.length}</Text>
                  <Text style={[s.td, { flex: 1, fontFamily: 'Helvetica-Bold' }]}>{st.avg.toFixed(1)}%</Text>
                  <Text style={[s.td, { flex: 1, color: passes ? C.success : C.danger }]}>{passes ? 'Passing' : 'Failing'}</Text>
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