export type SessionStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'rescheduled'
export type ClassStatus = 'active' | 'inactive' | 'archived'

export interface ScoreBracket {
  bracket: string
  min: number
  max: number
}

export const DEFAULT_BRACKETS: ScoreBracket[] = [
  { bracket: '90–100%', min: 90, max: 100 },
  { bracket: '80–89%', min: 80, max: 89.99 },
  { bracket: '70–79%', min: 70, max: 79.99 },
  { bracket: '60–69%', min: 60, max: 69.99 },
  { bracket: 'Below 60%', min: 0, max: 59.99 },
]

export interface ClassRow {
  id: string
  name: string
  description: string | null
  zoom_link: string | null
  status: ClassStatus
  default_passing_pct: number
  rate: number | null
  at_risk_threshold: number | null
  score_brackets: ScoreBracket[] | null
  created_at: string
  updated_at: string
}

export interface SubjectRow {
  id: string
  class_id: string
  name: string
  created_at: string
}

export interface AvailabilityEntry {
  day: string   // 'Monday' | 'Tuesday' | ...
  start: string // 'HH:MM'
  end: string   // 'HH:MM'
}

export interface TeacherRow {
  id: string
  user_id: string | null
  name: string
  specialization: string | null
  email: string
  availability: AvailabilityEntry[] | null
}

export interface SessionRow {
  id: string
  class_id: string
  subject_id: string | null
  teacher_id: string | null
  date: string
  start_time: string
  end_time: string
  status: SessionStatus
  notes: string | null
  zoom_link: string | null
  student_count: number
  original_date: string | null
  created_at: string
  updated_at: string
  // Joined (optional, from select with relations)
  subjects?: { name: string } | null
  teachers?: { name: string } | null
  classes?: { name: string } | null
}

export interface StudentRow {
  id: string
  name: string
  school: string | null
  email: string | null
  created_at: string
  enrolled_at?: string
}

export interface ExamRow {
  id: string
  class_id: string
  subject_id: string | null
  name: string
  date: string | null
  total_items: number
  passing_pct_override: number | null
  created_at: string
  updated_at: string
  subjects?: { name: string } | null
}

export interface ScoreRow {
  id: string
  exam_id: string
  student_id: string
  raw_score: number
  total_items: number
  percentage: number
  created_at: string
  students?: { name: string; email: string | null } | null
}

export interface ClassSummary {
  id: string
  name: string
  status: ClassStatus
  rate: number | null
  zoom_link: string | null
  subjectsCount: number
  sessionsCount: number
  completionPct: number
}
