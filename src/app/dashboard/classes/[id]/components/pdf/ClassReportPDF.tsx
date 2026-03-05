import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { StudentStats, ExamStats } from '../PerformanceInsights'

// ── Helpers ───────────────────────────────────────────────────────────────────
function mean(arr: number[]) { return arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length }
function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

// ── Styles ────────────────────────────────────────────────────────────────────
const C = { cyan: '#0BB5C7', dark: '#111827', mid: '#374151', muted: '#6B7280', border: '#E5E7EB', altRow: '#F9FAFB', success: '#16A34A', danger: '#DC2626' }

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: 'Helvetica', backgroundColor: '#FFFFFF' },
  // header
  brand: { fontSize: 7, color: C.muted, letterSpacing: 1, marginBottom: 4 },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: C.dark, marginBottom: 3 },
  subtitle: { fontSize: 10, color: C.mid, marginBottom: 2 },
  genDate: { fontSize: 7, color: C.muted, marginTop: 4 },
  divider: { borderBottomWidth: 1, borderBottomColor: C.border, marginTop: 10, marginBottom: 16 },
  // sections
  sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.dark, marginBottom: 8, marginTop: 14 },
  // summary row
  statCard: { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 6, padding: 10, marginRight: 6, alignItems: 'center' },
  statValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.dark },
  statLabel: { fontSize: 7, color: C.muted, marginTop: 2 },
  // bar chart
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  barLabel: { width: 130, fontSize: 8, color: C.mid },
  barTrack: { flex: 1, height: 8, backgroundColor: '#E5E7EB', borderRadius: 4 },
  barValue: { width: 38, textAlign: 'right', fontSize: 8, color: C.dark },
  // table
  tableHeader: { flexDirection: 'row', backgroundColor: '#F3F4F6', paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  tableRow: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: C.border },
  tableRowAlt: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, backgroundColor: C.altRow, borderBottomWidth: 0.5, borderBottomColor: C.border },
  th: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.muted, textTransform: 'uppercase' },
  td: { fontSize: 9, color: C.mid },
  // footer
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: C.muted },
})

// ── Sub-components ────────────────────────────────────────────────────────────
function Bar({ name, pct, color = C.cyan }: { name: string; pct: number; color?: string }) {
  return (
    <View style={s.barRow}>
      <Text style={s.barLabel}>{name}</Text>
      <View style={s.barTrack}>
        <View style={{ width: `${Math.min(Math.max(pct, 0), 100)}%`, height: 8, backgroundColor: color, borderRadius: 4 }} />
      </View>
      <Text style={s.barValue}>{pct.toFixed(1)}%</Text>
    </View>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  className: string
  classOverTime: { name: string; avg: number }[]
  studentStats: StudentStats[]
  examStats: ExamStats[]
  classPassingPct: number
  totalStudents: number
  totalExams: number
}

export default function ClassReportPDF({ className, classOverTime, studentStats, examStats, classPassingPct, totalStudents, totalExams }: Props) {
  const top10 = studentStats.slice(0, 10)
  const atRisk = studentStats.filter(st => st.avgPct < classPassingPct)

  const mostImproved = studentStats
    .filter(st => st.scores.length >= 2)
    .map(st => ({ name: st.student.name, delta: st.scores[st.scores.length - 1].percentage - st.scores[0].percentage }))
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 5)

  const subjectMap = new Map<string, number[]>()
  for (const es of examStats) {
    const subj = es.exam.subjects?.name ?? 'No Subject'
    if (!subjectMap.has(subj)) subjectMap.set(subj, [])
    if (es.avg > 0) subjectMap.get(subj)!.push(es.avg)
  }
  const subjectData = Array.from(subjectMap.entries())
    .map(([name, avgs]) => ({ name, avg: mean(avgs) }))
    .sort((a, b) => b.avg - a.avg)

  const totalTaken = studentStats.reduce((s, st) => s + st.examsTaken, 0)
  const attendance = totalStudents * totalExams > 0
    ? ((totalTaken / (totalStudents * totalExams)) * 100).toFixed(1) + '%' : '—'
  const overallAvg = classOverTime.length > 0
    ? mean(classOverTime.map(x => x.avg)).toFixed(1) + '%' : '—'
  const genDate = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <Text style={s.brand}>ACADGENIUS TUTORIAL POWERHOUSE</Text>
        <Text style={s.title}>Class Performance Report</Text>
        <Text style={s.subtitle}>{className}</Text>
        <Text style={s.genDate}>Generated: {genDate}</Text>
        <View style={s.divider} />

        {/* Summary */}
        <View style={{ flexDirection: 'row', marginBottom: 2 }}>
          {[
            { label: 'Class Size', value: String(totalStudents) },
            { label: 'Total Exams', value: String(totalExams) },
            { label: 'Overall Avg', value: overallAvg },
            { label: 'Attendance Rate', value: attendance },
          ].map((c, i) => (
            <View key={c.label} style={[s.statCard, i === 3 ? { marginRight: 0 } : {}]}>
              <Text style={s.statValue}>{c.value}</Text>
              <Text style={s.statLabel}>{c.label}</Text>
            </View>
          ))}
        </View>

        {/* Class avg over time */}
        {classOverTime.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Class Average Over Time</Text>
            {classOverTime.map(e => <Bar key={e.name} name={e.name} pct={e.avg} />)}
          </>
        )}

        {/* Top performers */}
        {top10.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Top Performers</Text>
            <View style={s.tableHeader}>
              {['#', 'Student', 'Avg %', 'Percentile', 'Exams'].map((h, i) => (
                <Text key={h} style={[s.th, { flex: [0.3, 2, 0.8, 1, 0.8][i] }]}>{h}</Text>
              ))}
            </View>
            {top10.map((st, i) => (
              <View key={st.student.id} style={i % 2 === 1 ? s.tableRowAlt : s.tableRow}>
                <Text style={[s.td, { flex: 0.3, color: i < 3 ? C.cyan : C.muted }]}>{i + 1}</Text>
                <Text style={[s.td, { flex: 2, fontFamily: 'Helvetica-Bold', color: C.dark }]}>{st.student.name}</Text>
                <Text style={[s.td, { flex: 0.8 }]}>{st.avgPct.toFixed(1)}%</Text>
                <Text style={[s.td, { flex: 1, color: C.muted }]}>{ordinal(st.percentile)}</Text>
                <Text style={[s.td, { flex: 0.8, color: C.muted }]}>{st.examsTaken} / {totalExams}</Text>
              </View>
            ))}
          </>
        )}

        {/* At-risk students */}
        {atRisk.length > 0 && (
          <>
            <Text style={s.sectionTitle}>At-Risk Students (avg below {classPassingPct}%)</Text>
            <View style={s.tableHeader}>
              {['Student', 'Avg %', 'Percentile', 'School'].map((h, i) => (
                <Text key={h} style={[s.th, { flex: [2.5, 1, 1, 2][i] }]}>{h}</Text>
              ))}
            </View>
            {atRisk.map((st, i) => (
              <View key={st.student.id} style={i % 2 === 1 ? s.tableRowAlt : s.tableRow}>
                <Text style={[s.td, { flex: 2.5, fontFamily: 'Helvetica-Bold', color: C.danger }]}>{st.student.name}</Text>
                <Text style={[s.td, { flex: 1, color: C.danger }]}>{st.avgPct.toFixed(1)}%</Text>
                <Text style={[s.td, { flex: 1, color: C.muted }]}>{ordinal(st.percentile)}</Text>
                <Text style={[s.td, { flex: 2, color: C.muted }]}>{st.student.school ?? '—'}</Text>
              </View>
            ))}
          </>
        )}

        {/* Subject breakdown */}
        {subjectData.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Subject Breakdown</Text>
            {subjectData.map(sub => <Bar key={sub.name} name={sub.name} pct={sub.avg} />)}
          </>
        )}

        {/* Most improved */}
        {mostImproved.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Most Improved</Text>
            <View style={s.tableHeader}>
              {['Student', 'Score Change'].map((h, i) => (
                <Text key={h} style={[s.th, { flex: [3, 1][i] }]}>{h}</Text>
              ))}
            </View>
            {mostImproved.map((st, i) => (
              <View key={st.name} style={i % 2 === 1 ? s.tableRowAlt : s.tableRow}>
                <Text style={[s.td, { flex: 3, color: C.dark }]}>{st.name}</Text>
                <Text style={[s.td, { flex: 1, color: st.delta >= 0 ? C.success : C.danger }]}>
                  {st.delta >= 0 ? '+' : ''}{st.delta.toFixed(1)}%
                </Text>
              </View>
            ))}
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
