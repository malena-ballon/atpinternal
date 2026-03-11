import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'

export interface MasterSchedulePDFRow {
  index: number
  date: string
  day: string
  time: string
  subject: string
  topic: string
  className: string
  teacher: string
  status: string
  students: string
}

interface Props {
  rows: MasterSchedulePDFRow[]
  generatedDate: string
}

const C = {
  cyan: '#0BB5C7', dark: '#111827', mid: '#374151',
  muted: '#6B7280', border: '#E5E7EB', altRow: '#F9FAFB',
}

const STATUS_LABELS: Record<string, string> = {
  scheduled:   'Upcoming',
  in_progress: 'In Progress',
  completed:   'Done',
  cancelled:   'Cancelled',
  rescheduled: 'Rescheduled',
}

const s = StyleSheet.create({
  page:      { padding: 36, fontSize: 9, fontFamily: 'Helvetica', backgroundColor: '#FFFFFF' },
  brand:     { fontSize: 7, color: C.muted, letterSpacing: 1, marginBottom: 4 },
  title:     { fontSize: 18, fontFamily: 'Helvetica-Bold', color: C.dark, marginBottom: 2 },
  genDate:   { fontSize: 7, color: C.muted, marginTop: 4 },
  divider:   { borderBottomWidth: 1, borderBottomColor: C.border, marginTop: 10, marginBottom: 14 },
  th:        { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  td:        { fontSize: 8, color: C.mid },
  tdDark:    { fontSize: 8, color: C.dark, fontFamily: 'Helvetica-Bold' },
  headerRow: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 5, backgroundColor: '#F3F4F6', borderRadius: 4 },
  row:       { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: C.border },
  rowAlt:    { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.altRow },
  col_num:     { width: 22 },
  col_date:    { width: 64 },
  col_day:     { width: 28 },
  col_time:    { width: 90 },
  col_subject: { flex: 1.2 },
  col_topic:   { flex: 1.5 },
  col_class:   { flex: 1.2 },
  col_teacher: { flex: 1 },
  col_status:  { width: 62 },
  col_students:{ width: 34, textAlign: 'center' },
  footer:    { position: 'absolute', bottom: 22, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between' },
  footerText:{ fontSize: 7, color: C.muted },
})

export default function MasterSchedulePDF({ rows, generatedDate }: Props) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <Image src={`${window.location.origin}/logo.jpg`} style={{ width: 30, height: 30, marginRight: 8, borderRadius: 4 }} />
          <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.dark }}>Acadgenius Tutorial Powerhouse</Text>
        </View>
        <Text style={s.title}>Master Schedule</Text>
        <Text style={s.genDate}>Generated {generatedDate} · {rows.length} session{rows.length !== 1 ? 's' : ''}</Text>
        <View style={s.divider} />

        {/* Table header */}
        <View style={s.headerRow}>
          <Text style={[s.th, s.col_num]}>#</Text>
          <Text style={[s.th, s.col_date]}>Date</Text>
          <Text style={[s.th, s.col_day]}>Day</Text>
          <Text style={[s.th, s.col_time]}>Time</Text>
          <Text style={[s.th, s.col_subject]}>Subject</Text>
          <Text style={[s.th, s.col_topic]}>Topic</Text>
          <Text style={[s.th, s.col_class]}>Class</Text>
          <Text style={[s.th, s.col_teacher]}>Teacher</Text>
          <Text style={[s.th, s.col_status]}>Status</Text>
          <Text style={[s.th, s.col_students]}>Stud.</Text>
        </View>

        {/* Rows */}
        {rows.map((row, i) => (
          <View key={i} style={i % 2 === 0 ? s.row : s.rowAlt} wrap={false}>
            <Text style={[s.td, s.col_num]}>{row.index}</Text>
            <Text style={[s.tdDark, s.col_date]}>{row.date}</Text>
            <Text style={[s.td, s.col_day]}>{row.day}</Text>
            <Text style={[s.td, s.col_time]}>{row.time}</Text>
            <Text style={[s.td, s.col_subject]}>{row.subject || '—'}</Text>
            <Text style={[s.td, s.col_topic]}>{row.topic || '—'}</Text>
            <Text style={[s.td, s.col_class]}>{row.className || '—'}</Text>
            <Text style={[s.td, s.col_teacher]}>{row.teacher || '—'}</Text>
            <Text style={[s.td, s.col_status]}>{STATUS_LABELS[row.status] ?? row.status}</Text>
            <Text style={[s.td, s.col_students]}>{row.students || '—'}</Text>
          </View>
        ))}

        {rows.length === 0 && (
          <Text style={{ fontSize: 9, color: C.muted, textAlign: 'center', marginTop: 20 }}>
            No sessions to display.
          </Text>
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Acadgenius Tutorial Powerhouse – Confidential</Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}
