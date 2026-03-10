import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'

export interface SessionPDFRow {
  index: number
  date: string
  day: string
  startTime: string
  endTime: string
  teacher: string
  subject: string
  topic?: string
  status: string
}

interface Props {
  className: string
  sessions: SessionPDFRow[]
}

const C = { cyan: '#0BB5C7', dark: '#111827', mid: '#374151', muted: '#6B7280', border: '#E5E7EB', altRow: '#F9FAFB' }

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Upcoming',
  in_progress: 'In Progress',
  completed: 'Done',
  cancelled: 'Cancelled',
  rescheduled: 'Rescheduled',
}

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: 'Helvetica', backgroundColor: '#FFFFFF' },
  brand: { fontSize: 7, color: C.muted, letterSpacing: 1, marginBottom: 4 },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: C.dark, marginBottom: 2 },
  subtitle: { fontSize: 10, color: C.mid, marginBottom: 2 },
  genDate: { fontSize: 7, color: C.muted, marginTop: 4 },
  divider: { borderBottomWidth: 1, borderBottomColor: C.border, marginTop: 10, marginBottom: 16 },
  th: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  td: { fontSize: 8, color: C.mid },
  tdDark: { fontSize: 8, color: C.dark, fontFamily: 'Helvetica-Bold' },
  headerRow: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 5, backgroundColor: '#F3F4F6', borderRadius: 4 },
  row: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border },
  rowAlt: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.altRow },
  col_num:     { width: 24 },
  col_date:    { width: 70 },
  col_day:     { width: 32 },
  col_time:    { width: 90 },
  col_teacher: { flex: 1 },
  col_subject: { flex: 1 },
  col_topic:   { flex: 1 },
  col_status:  { width: 70 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: C.muted },
})

function fmt12(t: string) {
  if (!t) return '—'
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

export default function SessionSchedulePDF({ className, sessions }: Props) {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        {/* Header */}
        <Text style={s.brand}>ACADGENIUS TUTORIAL POWERHOUSE</Text>
        <Text style={s.title}>Session Schedule</Text>
        <Text style={s.subtitle}>{className}</Text>
        <Text style={s.genDate}>Generated {today} · {sessions.length} session{sessions.length !== 1 ? 's' : ''}</Text>
        <View style={s.divider} />

        {/* Table header */}
        <View style={s.headerRow}>
          <Text style={[s.th, s.col_num]}>#</Text>
          <Text style={[s.th, s.col_date]}>Date</Text>
          <Text style={[s.th, s.col_day]}>Day</Text>
          <Text style={[s.th, s.col_time]}>Time</Text>
          <Text style={[s.th, s.col_teacher]}>Teacher</Text>
          <Text style={[s.th, s.col_subject]}>Subject</Text>
          <Text style={[s.th, s.col_topic]}>Topic</Text>
          <Text style={[s.th, s.col_status]}>Status</Text>
        </View>

        {/* Rows */}
        {sessions.map((row, i) => (
          <View key={i} style={i % 2 === 0 ? s.row : s.rowAlt}>
            <Text style={[s.td, s.col_num]}>{row.index}</Text>
            <Text style={[s.tdDark, s.col_date]}>{row.date}</Text>
            <Text style={[s.td, s.col_day]}>{row.day}</Text>
            <Text style={[s.td, s.col_time]}>{fmt12(row.startTime)} – {fmt12(row.endTime)}</Text>
            <Text style={[s.td, s.col_teacher]}>{row.teacher || '—'}</Text>
            <Text style={[s.td, s.col_subject]}>{row.subject || '—'}</Text>
            <Text style={[s.td, s.col_topic]}>{row.topic || '—'}</Text>
            <Text style={[s.td, s.col_status]}>{STATUS_LABELS[row.status] ?? row.status}</Text>
          </View>
        ))}

        {sessions.length === 0 && (
          <Text style={{ fontSize: 9, color: C.muted, textAlign: 'center', marginTop: 20 }}>No sessions to display.</Text>
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Acadgenius Tutorial Powerhouse – Confidential</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
