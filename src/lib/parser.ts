'use client'

export interface TaskEntry {
  project: string
  ticket: string          // e.g. "LC-252"
  module: string          // e.g. "[Module-3-02]"
  taskRaw: string
  description: string     // cleaned, past tense
  startTime: string       // e.g. "09:48 AM"
  endTime: string | null
  estimatedTime: string
  status: string
  hours: number
  date: Date
  isEstimated: boolean    // true = no end time found, used estimated
}

export interface DayGroup {
  date: Date
  tasks: TaskEntry[]
  totalHours: number
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

function parseTime(timeStr: string): { h: number; m: number } | null {
  if (!timeStr) return null
  const s = timeStr.trim().replace(/(\d)(AM|PM)/i, '$1 $2').toUpperCase()
  const m = s.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/)
  if (!m) return null
  let h = parseInt(m[1])
  const min = parseInt(m[2])
  if (m[3] === 'PM' && h !== 12) h += 12
  if (m[3] === 'AM' && h === 12) h = 0
  return { h, m: min }
}

function calcHours(start: string, end: string): number {
  const s = parseTime(start)
  const e = parseTime(end)
  if (!s || !e) return 0
  const diff = (e.h * 60 + e.m) - (s.h * 60 + s.m)
  return Math.round((diff / 60) * 100) / 100
}

function parseEstimated(est: string): number {
  if (!est) return 0
  const h = est.match(/(\d+\.?\d*)\s*hour/i)
  const m = est.match(/(\d+\.?\d*)\s*min/i)
  let total = 0
  if (h) total += parseFloat(h[1])
  if (m) total += parseFloat(m[1]) / 60
  return Math.round(total * 100) / 100
}

// ─── Past-tense description builder ──────────────────────────────────────────

// Map present/gerund → past tense
const VERB_MAP: [RegExp, string][] = [
  [/^Testing\b/i, 'Tested'],
  [/^Implementing\b/i, 'Implemented'],
  [/^Creating\b/i, 'Created'],
  [/^Adding\b/i, 'Added'],
  [/^Displaying\b/i, 'Displayed'],
  [/^Fixing\b/i, 'Fixed'],
  [/^Updating\b/i, 'Updated'],
  [/^Working on\b/i, 'Worked on'],
  [/^Handling\b/i, 'Handled'],
  [/^Developing\b/i, 'Developed'],
  [/^Resolving\b/i, 'Resolved'],
  [/^Improving\b/i, 'Improved'],
  [/^Reviewing\b/i, 'Reviewed'],
  [/^Setting up\b/i, 'Set up'],
  [/^Researching\b/i, 'Researched'],
  [/^Optimizing\b/i, 'Optimized'],
  [/^Integrating\b/i, 'Integrated'],
  [/^Configuring\b/i, 'Configured'],
  [/^Debugging\b/i, 'Debugged'],
  [/^Building\b/i, 'Built'],
]

function toPastTense(text: string): string {
  for (const [pattern, replacement] of VERB_MAP) {
    if (pattern.test(text)) return text.replace(pattern, replacement)
  }
  return text
}

function buildDescription(taskRaw: string, status: string): string {
  // Strip ticket prefix [LC-XXX], [CAN-123], [ARCC-45], etc.
  let desc = taskRaw.replace(/\[\w+-\d+\]\s*[-–]?\s*/gi, '').trim()
  // Strip module [Module-X-XX] prefix
  const moduleMatch = desc.match(/^(\[Module-[\w-]+\])\s*/i)
  const modulePart = moduleMatch ? moduleMatch[1] + ' ' : ''
  if (moduleMatch) desc = desc.slice(moduleMatch[0].length).trim()

  // Unwrap "Working on X (Implementing ...)" pattern
  const implMatch = desc.match(/^Working on\s+(.+?)\s*\(Implementing.*?\)/i)
  if (implMatch) desc = 'Implemented ' + implMatch[1].trim()

  const planMatch = desc.match(/^Working on\s+(.+?)\s*\(Creating plan.*?\)/i)
  if (planMatch) desc = 'Created implementation plan for ' + planMatch[1].trim()

  const improveMatch = desc.match(/^Working on some improvements? in\s+(.+)/i)
  if (improveMatch) desc = 'Improved ' + improveMatch[1].trim()

  // Strip remaining verbose openers
  desc = desc.replace(/^Working on\s+/i, '')

  // Apply past tense
  desc = toPastTense(desc.trim())

  // Clean trailing parens/dashes
  desc = desc.replace(/\s*\(.*?\)\s*$/, '').replace(/[-–\s]+$/, '').trim()
  if (desc) desc = desc[0].toUpperCase() + desc.slice(1)

  // Append status if meaningful (past tense, trimmed)
  const skipStatus = new Set([
    'done', 'completed', 'implementation done', 'implementation done.',
    'on going', 'ongoing', '',
  ])
  if (status) {
    const s = status.trim().replace(/\.$/, '')
    const sLow = s.toLowerCase()
    if (sLow === 'on hold') {
      desc += ' (On Hold)'
    } else if (!skipStatus.has(sLow)) {
      const firstSentence = s.split(/[.!?]/)[0].trim()
      const shortened = firstSentence.length > 70 ? firstSentence.slice(0, 67) + '…' : firstSentence
      desc += ` | ${shortened}`
    }
  }

  const ticket = taskRaw.match(/\[\w+-\d+\]/i)?.[0] ?? ''
  return [ticket, modulePart.trim(), desc].filter(Boolean).join(' ')
}

// ─── Date detection ───────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  jan:0, feb:1, mar:2, apr:3, may:4, jun:5,
  jul:6, aug:7, sep:8, oct:9, nov:10, dec:11,
}

// Matches any month name (full or abbreviated): January|Jan|February|Feb ...
const MONTH_NAMES =
  'Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?' +
  '|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?'

// Optional weekday prefix that Slack adds to day separators: "Monday, " or "Mon, "
const WEEKDAY_PREFIX = '(?:(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)[a-z]*[,\\s]+'  + ')?'

// Matches: "March 10", "March 10th", "March 10, 2026", "March 10th, 2026"
//          "Monday, March 10"  "Monday, March 10, 2026"  "Mon, Mar 10th, 2026"
const MONTH_DATE_RE = new RegExp(
  `^${WEEKDAY_PREFIX}(${MONTH_NAMES})[\\s]+(\\d{1,2})(?:st|nd|rd|th)?(?:[,\\s]+(\\d{4}))?\\s*$`,
  'i'
)

function detectSlackDate(line: string, now: Date): Date | null {
  const s = line.trim()
  if (!s) return null

  // ── 1. ISO: 2026-03-12 ──
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) return new Date(+iso[1], +iso[2]-1, +iso[3])

  // ── 2. Custom separator: --- 2026-03-12 --- ──
  const sep = s.match(/^[-=*#\s]*(\d{4})-(\d{1,2})-(\d{1,2})[-=*#\s]*$/)
  if (sep) return new Date(+sep[1], +sep[2]-1, +sep[3])

  // ── 3. Today / Yesterday ──
  if (/^today\b/i.test(s)) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }
  if (/^yesterday\b/i.test(s)) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    d.setDate(d.getDate() - 1)
    return d
  }

  // ── 4. Month-name formats (handles Slack copy-paste day separators) ──
  //  "March 10"           "March 10, 2026"      "March 10th, 2026"
  //  "Monday, March 10"   "Monday, March 10, 2026"
  //  "Mon, Mar 10th"      "Mon Mar 10, 2026"
  const withMonth = s.match(MONTH_DATE_RE)
  if (withMonth) {
    const month = MONTH_MAP[withMonth[1].toLowerCase().slice(0, 3)]
    const day   = +withMonth[2]
    const year  = withMonth[3] ? +withMonth[3] : now.getFullYear()
    if (month !== undefined && day >= 1 && day <= 31) {
      return new Date(year, month, day)
    }
  }

  // ── 5. Weekday alone (last resort — backtracks to nearest occurrence) ──
  //  "Monday at 9:48 AM"  "Mon at 5pm"  "Monday"
  //  Only reached when there is NO month-name info available (pattern 4 above
  //  already consumed the "Monday, March 10" case).
  const DAY_IDX: Record<string, number> = {sun:0,mon:1,tue:2,wed:3,thu:4,fri:5,sat:6}
  const dayOnly = s.match(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)[a-z]*(?:\s|,|$)/i)
  if (dayOnly) {
    const target = DAY_IDX[dayOnly[1].toLowerCase().slice(0, 3)]
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    while (d.getDay() !== target) d.setDate(d.getDate() - 1)
    return d
  }

  return null
}

function isSeparatorLine(line: string): boolean {
  // Lines that are date separators or Slack timestamp lines (not message content)
  const s = line.trim()
  if (!s) return false
  // Short lines that look like dates or timestamps
  if (/^[-=*#]{3,}/.test(s)) return true
  const detected = detectSlackDate(s, new Date())
  return detected !== null
}

// ─── Message block parser ─────────────────────────────────────────────────────

function extractField(block: string, key: string): string | null {
  const re = new RegExp(`${key}\\s*:\\s*(.+)`, 'i')
  const m = block.match(re)
  return m ? m[1].trim() : null
}

const GARBAGE_PHRASES = [
  /^ok\b/i, /^okay\b/i, /^sure\b/i, /^yes\b/i, /^noted\b/i,
  /^done\b/i, /^thanks\b/i, /^thank you/i, /^got it/i,
  /^please\b/i, /^sir\b/i, /^hi\b/i, /^hello\b/i,
  /^i will\b/i, /^i'll\b/i, /^will do/i, /^understood/i,
]

function isGarbage(text: string): boolean {
  const s = text.trim()
  if (!s) return true
  if (s.length < 5) return true
  // Must have Project + Task to be valid
  if (!/Project\s*:/i.test(s)) return true
  if (!/Task\s*:/i.test(s)) return true
  if (!/Start\s*Time\s*:/i.test(s)) return true
  return false
}

function parseSingleBlock(block: string, date: Date): {
  project: string; taskRaw: string; startTime: string
  endTime: string|null; estimatedTime: string; status: string
} | null {
  if (isGarbage(block)) return null

  const project     = extractField(block, 'Project')
  const task        = extractField(block, 'Task')
  const startTime   = extractField(block, 'Start\\s*Time')
  const endTime     = extractField(block, 'End\\s*Time')
  const estimated   = extractField(block, 'Estimated\\s*Time')

  if (!project || !task || !startTime) return null

  // Skip lunch entries
  if (/^lunch/i.test(task)) return null

  // Status: everything after "Status :" on same line (first line only)
  const statusMatch = block.match(/Status\s*:\s*(.+)/i)
  const status = statusMatch ? statusMatch[1].split('\n')[0].trim() : ''

  return {
    project: project.trim(),
    taskRaw: task.trim(),
    startTime: startTime.trim(),
    endTime: endTime?.trim() ?? null,
    estimatedTime: estimated?.trim() ?? '',
    status,
  }
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseMessages(rawText: string, fallbackDate: Date): TaskEntry[] {
  const lines = rawText.split('\n')
  const now = new Date()

  // Walk lines, detect date changes, collect message blocks
  type Section = { date: Date; text: string }
  const sections: Section[] = []
  let currentDate = fallbackDate
  let currentLines: string[] = []

  for (const line of lines) {
    const detectedDate = detectSlackDate(line.trim(), now)
    if (detectedDate) {
      if (currentLines.join('').trim()) {
        sections.push({ date: new Date(currentDate), text: currentLines.join('\n') })
        currentLines = []
      }
      currentDate = detectedDate
    } else {
      currentLines.push(line)
    }
  }
  if (currentLines.join('').trim()) {
    sections.push({ date: currentDate, text: currentLines.join('\n') })
  }

  // Parse each section into raw entries
  type RawEntry = ReturnType<typeof parseSingleBlock> & { date: Date }
  const allRaw: NonNullable<RawEntry>[] = []

  for (const section of sections) {
    // Split on blank lines or on "Project :" starting a new block
    const blocks = section.text
      .split(/\n(?=\s*Project\s*:)/i)
      .map(b => b.trim())
      .filter(Boolean)

    for (const block of blocks) {
      const parsed = parseSingleBlock(block, section.date)
      if (parsed) allRaw.push({ ...parsed, date: new Date(section.date) })
    }
  }

  // Deduplicate: group by (project + task + startTime) → prefer end message
  const groups = new Map<string, NonNullable<RawEntry>>()
  for (const entry of allRaw) {
    const key = `${entry.project}||${entry.taskRaw}||${entry.startTime}`
    const existing = groups.get(key)
    if (!existing) {
      groups.set(key, entry)
    } else {
      if (entry.endTime && !existing.endTime) {
        groups.set(key, { ...entry, status: entry.status || existing.status })
      } else if (entry.status && !existing.status) {
        existing.status = entry.status
      }
    }
  }

  // Build final TaskEntry list
  const tasks: TaskEntry[] = []
  for (const raw of Array.from(groups.values())) {
    const hours = raw.endTime
      ? calcHours(raw.startTime, raw.endTime)
      : parseEstimated(raw.estimatedTime)

    const ticketMatch = raw.taskRaw.match(/\[([A-Z]+-\d+)\]/i)
    const moduleMatch = raw.taskRaw.match(/\[Module-[\w-]+\]/i)

    tasks.push({
      project: raw.project,
      ticket: ticketMatch?.[1] ?? '',
      module: moduleMatch?.[0] ?? '',
      taskRaw: raw.taskRaw,
      description: buildDescription(raw.taskRaw, raw.status),
      startTime: raw.startTime,
      endTime: raw.endTime,
      estimatedTime: raw.estimatedTime,
      status: raw.status,
      hours,
      date: raw.date,
      isEstimated: !raw.endTime,
    })
  }

  // Sort by date then start time
  return tasks.sort((a, b) => {
    const dd = a.date.getTime() - b.date.getTime()
    if (dd !== 0) return dd
    const ta = parseTime(a.startTime)
    const tb = parseTime(b.startTime)
    if (!ta || !tb) return 0
    return (ta.h * 60 + ta.m) - (tb.h * 60 + tb.m)
  })
}

// ─── Grouping helpers ─────────────────────────────────────────────────────────

/** Formats a local Date as YYYY-MM-DD without UTC conversion (avoids -1 day bug in IST/UTC+ timezones) */
export function toLocalISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function getProjectStats(tasks: TaskEntry[]) {
  const map = new Map<string, { count: number; hours: number; days: Set<string> }>()
  for (const t of tasks) {
    const key = toLocalISO(t.date)
    if (!map.has(t.project)) map.set(t.project, { count: 0, hours: 0, days: new Set() })
    const s = map.get(t.project)!
    s.count++
    s.hours = Math.round((s.hours + t.hours) * 100) / 100
    s.days.add(key)
  }
  return Array.from(map.entries()).map(([project, s]) => ({
    project,
    taskCount: s.count,
    totalHours: s.hours,
    dayCount: s.days.size,
  }))
}

export function groupByDate(tasks: TaskEntry[]): DayGroup[] {
  const map = new Map<string, TaskEntry[]>()
  for (const t of tasks) {
    const key = toLocalISO(t.date)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(t)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, dayTasks]) => ({
      date: dayTasks[0].date,
      tasks: dayTasks,
      totalHours: Math.round(dayTasks.reduce((s, t) => s + t.hours, 0) * 100) / 100,
    }))
}
