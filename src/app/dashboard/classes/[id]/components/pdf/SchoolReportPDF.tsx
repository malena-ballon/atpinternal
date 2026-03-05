import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { SchoolStats } from '../PerformanceInsights'
import type { ExamRow } from '@/types'

const C = { cyan: '#0BB5C7', dark: '#111827', mid: '#374151', muted: '#6B7280', border: '#E5E7EB', altRow: '#F9FAFB', success: '#16A34A' }

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: 'Helvetica', backgroundColor: '#FFFFFF' },
  brand: { fontSize: 7, color: C.muted, letterSpacing: 1, marginBottom: 4 },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: C.dark, marginBottom: 3 },
  subtitle: { fontSize: 10, color: C.mid, marginBottom: 2 },
  genDate: { fontSize: 7, color: C.muted, marginTop: 4 },
  divider: { borderBottomWidth: 1, borderBottomColor: C.border, marginTop: 10, marginBottom: 16 },
  sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.dark, marginBottom: 8, marginTop: 14 },
  topCard: { backgroundColor: 'rgba(11,181,199,0.06)', borderRadius: 8, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(11,181,199,0.2)' },
  topLabel: { fontSize: 7, color: C.cyan, marginBottom: 3, fontFamily: 'Helvetica-Bold' },
  topName: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: C.dark },
  topSub: { fontSize: 9, color: C.mid, marginTop: 3 },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 7 },
  barLabel: { width: 130, fontSize: 8, color: C.mid },
  barTrack: { flex: 1, height: 10, backgroundColor: '#E5E7EB', borderRadius: 4 },
  barValue: { width: 50, textAlign: 'right', fontSize: 8, color: C.dark },
  tableHeader: { flexDirection: 'row', backgroundColor: '#F3F4F6', paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  tableRow: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: C.border },
  tableRowAlt: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, backgroundColor: C.altRow, borderBottomWidth: 0.5, borderBottomColor: C.border },
  th: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.muted, textTransform: 'uppercase' },
  td: { fontSize: 9, color: C.mid },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: C.muted },
})

const COLORS = ['#0BB5C7', '#22c55e', '#f59e0b', '#8b5cf6', '#f97316', '#ec4899', '#06b6d4', '#84cc16']

interface Props {
  className: string
  schoolStats: SchoolStats[]
  sortedExams: ExamRow[]
}

export default function SchoolReportPDF({ className, schoolStats, sortedExams }: Props) {
  const genDate = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
  const topSchool = schoolStats[0]

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <Text style={s.brand}>ACADGENIUS TUTORIAL POWERHOUSE</Text>
        <Text style={s.title}>School Performance Report</Text>
        <Text style={s.subtitle}>{className}</Text>
        <Text style={s.genDate}>Generated: {genDate}</Text>
        <View style={s.divider} />

        {/* Top school */}
        {topSchool && (
          <View style={s.topCard}>
            <Text style={s.topLabel}>TOP-PERFORMING SCHOOL</Text>
            <Text style={s.topName}>{topSchool.school}</Text>
            <Text style={s.topSub}>{topSchool.avgPct.toFixed(1)}% avg · {topSchool.students.length} student{topSchool.students.length !== 1 ? 's' : ''}</Text>
          </View>
        )}

        {/* Average by school — bar chart */}
        <Text style={s.sectionTitle}>Average Score by School</Text>
        {schoolStats.map((school, i) => (
          <View key={school.school} style={s.barRow}>
            <Text style={s.barLabel}>{school.school}</Text>
            <View style={s.barTrack}>
              <View style={{ width: `${Math.min(school.avgPct, 100)}%`, height: 10, backgroundColor: COLORS[i % COLORS.length], borderRadius: 4 }} />
            </View>
            <Text style={s.barValue}>{school.avgPct.toFixed(1)}% ({school.students.length})</Text>
          </View>
        ))}

        {/* School trend across exams — text table */}
        {sortedExams.length > 0 && (
          <>
            <Text style={s.sectionTitle}>School Performance Across Exams</Text>
            {/* Header row */}
            <View style={[s.tableHeader, { flexWrap: 'nowrap' }]}>
              <Text style={[s.th, { flex: 2 }]}>School</Text>
              {sortedExams.slice(0, 6).map(e => (
                <Text key={e.id} style={[s.th, { flex: 1, textAlign: 'right' }]}>{e.name.slice(0, 8)}</Text>
              ))}
              <Text style={[s.th, { flex: 0.8, textAlign: 'right' }]}>Avg</Text>
            </View>
            {schoolStats.map((school, i) => (
              <View key={school.school} style={i % 2 === 1 ? s.tableRowAlt : s.tableRow}>
                <Text style={[s.td, { flex: 2, fontFamily: 'Helvetica-Bold', color: C.dark }]}>{school.school}</Text>
                {sortedExams.slice(0, 6).map((e, ei) => {
                  const avg = school.examTrend[ei]?.avg ?? 0
                  return (
                    <Text key={e.id} style={[s.td, { flex: 1, textAlign: 'right', color: avg > 0 ? C.mid : C.muted }]}>
                      {avg > 0 ? avg.toFixed(0) + '%' : '—'}
                    </Text>
                  )
                })}
                <Text style={[s.td, { flex: 0.8, textAlign: 'right', fontFamily: 'Helvetica-Bold', color: C.dark }]}>
                  {school.avgPct.toFixed(1)}%
                </Text>
              </View>
            ))}
          </>
        )}

        {/* School representation */}
        <Text style={s.sectionTitle}>School Representation</Text>
        <View style={s.tableHeader}>
          {['Rank', 'School', 'Students', 'Overall Avg'].map((h, i) => (
            <Text key={h} style={[s.th, { flex: [0.5, 3, 1, 1.2][i] }]}>{h}</Text>
          ))}
        </View>
        {schoolStats.map((school, i) => (
          <View key={school.school} style={i % 2 === 1 ? s.tableRowAlt : s.tableRow}>
            <Text style={[s.td, { flex: 0.5, color: i === 0 ? C.cyan : C.muted, fontFamily: 'Helvetica-Bold' }]}>{i + 1}</Text>
            <Text style={[s.td, { flex: 3, fontFamily: 'Helvetica-Bold', color: C.dark }]}>{school.school}</Text>
            <Text style={[s.td, { flex: 1 }]}>{school.students.length}</Text>
            <Text style={[s.td, { flex: 1.2, fontFamily: 'Helvetica-Bold' }]}>{school.avgPct.toFixed(1)}%</Text>
          </View>
        ))}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Generated by Acadgenius Tutorial Powerhouse</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
