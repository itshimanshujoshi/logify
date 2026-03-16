import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'

// ── Exact values from template ─────────────────────────────────────────────────
const HEADER_FILL  = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFF200' } }
const HEADER_FONT  = { name: 'Arial', size: 14, bold: true }
const DATA_FONT    = { name: 'Arial', size: 11 }
const DATE_FONT    = { name: 'Arial', size: 10 }
const TOTAL_FONT   = { name: 'Arial', size: 11, bold: true }
const CENTER_ALIGN = { horizontal: 'center' as const, vertical: 'middle' as const }
const WRAP_ALIGN   = { horizontal: 'left' as const, vertical: 'top' as const, wrapText: true }
const COL_WIDTHS   = [14.81, 39.29, 138.26, 15.45, 9.01]
const HEADER_H     = 45
const DEFAULT_ROW_H = 26

// ── Types (must match page.tsx) ────────────────────────────────────────────────

interface EditableRow {
  id: string
  date: string       // YYYY-MM-DD
  taskLabel: string
  bullets: string[]
  hours: number
}

interface SheetHeaders {
  task: string
  description: string
  hours: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Parse "YYYY-MM-DD" directly → [year, month0, day] avoiding any timezone conversion */
function parseDateStr(iso: string): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number)
  return [y, m - 1, d] // month is 0-indexed
}

function monthSheetName(date: Date) {
  return date.toLocaleString('en-US', { month: 'short', year: 'numeric' }).replace(' ', '-')
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function styleHeader(row: ExcelJS.Row) {
  row.height = HEADER_H
  row.eachCell({ includeEmpty: true }, (cell, colNum) => {
    if (colNum > 5) return
    cell.fill = HEADER_FILL
    cell.font = HEADER_FONT
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: colNum === 3 }
  })
}

function styleDataRow(row: ExcelJS.Row, rowHeight = DEFAULT_ROW_H) {
  row.height = rowHeight

  row.getCell(1).font = DATE_FONT
  row.getCell(1).alignment = CENTER_ALIGN
  row.getCell(1).numFmt = 'dd-mmm-yyyy'

  row.getCell(2).font = DATA_FONT
  row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' }

  row.getCell(3).font = DATA_FONT
  row.getCell(3).alignment = WRAP_ALIGN

  row.getCell(4).font = DATA_FONT
  row.getCell(4).alignment = CENTER_ALIGN
}

// ── Build one worksheet ────────────────────────────────────────────────────────

async function buildSheet(
  wb: ExcelJS.Workbook,
  year: number,
  month: number,
  rowsByDay: Map<number, EditableRow>,
  sheetHeaders: SheetHeaders,
) {
  const ws = wb.addWorksheet(monthSheetName(new Date(year, month, 1)))
  ws.columns = COL_WIDTHS.map(width => ({ width }))

  // Header row — values come from editable headers
  const headerRow = ws.addRow([
    null,
    sheetHeaders.task,
    sheetHeaders.description,
    sheetHeaders.hours,
    null,
  ])
  styleHeader(headerRow)

  const days = daysInMonth(year, month)

  for (let d = 1; d <= days; d++) {
    // Use Date.UTC so ExcelJS serialises the correct calendar date
    // regardless of the server's local timezone (avoids -1 day in UTC+ zones)
    const dateObj = new Date(Date.UTC(year, month, d))
    const editRow = rowsByDay.get(d)

    if (!editRow) {
      const row = ws.addRow([dateObj, null, null, null, null])
      styleDataRow(row)
    } else {
      const validBullets = editRow.bullets.filter(Boolean)
      const bulletText   = validBullets.map(b => `#${b}`).join('\n')
      const lineCount    = Math.max(1, validBullets.length)
      const rowH         = Math.max(35, lineCount * 22)

      const row = ws.addRow([dateObj, editRow.taskLabel, bulletText, Number(editRow.hours) || 0, null])
      styleDataRow(row, rowH)
    }
  }

  // Total row
  const lastDataRow = days + 1 // header(1) + days
  const totalRow = ws.addRow(['Total', null, null, { formula: `SUM(D2:D${lastDataRow})` }, null])
  totalRow.height = 25
  totalRow.getCell(1).font = TOTAL_FONT
  totalRow.getCell(1).alignment = CENTER_ALIGN
  totalRow.getCell(4).font = TOTAL_FONT
  totalRow.getCell(4).alignment = CENTER_ALIGN
  totalRow.getCell(4).numFmt = '0.00'
}

// ── POST handler ───────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      rows: EditableRow[]
      headers: SheetHeaders
      project: string
    }

    const { rows, headers, project } = body

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
    }

    // Normalise / fallback headers
    const sheetHeaders: SheetHeaders = {
      task:        headers?.task        || 'Task',
      description: headers?.description || 'Description',
      hours:       headers?.hours       || 'Hours to complete',
    }

    // Discover which months are covered
    const months = new Set<string>()
    for (const r of rows) {
      const [y, m] = parseDateStr(r.date)
      months.add(`${y}-${m}`)
    }

    const wb = new ExcelJS.Workbook()
    wb.creator  = 'Logify'
    wb.created  = new Date()

    for (const key of Array.from(months).sort()) {
      const [year, month] = key.split('-').map(Number)

      const rowsByDay = new Map<number, EditableRow>()
      for (const r of rows) {
        const [ry, rm, rd] = parseDateStr(r.date)
        if (ry === year && rm === month) {
          const existing = rowsByDay.get(rd)
          if (!existing) {
            rowsByDay.set(rd, { ...r })
          } else {
            // Merge: combine bullets and sum hours instead of overwriting
            existing.bullets = [...existing.bullets, ...r.bullets].filter(Boolean)
            existing.hours = Math.round((existing.hours + r.hours) * 100) / 100
          }
        }
      }

      await buildSheet(wb, year, month, rowsByDay, sheetHeaders)
    }

    const buffer     = await wb.xlsx.writeBuffer()
    const safeProject = project.replace(/[^a-zA-Z0-9_-]/g, '_')

    return new NextResponse(buffer, {
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${safeProject}_timesheet.xlsx"`,
      },
    })
  } catch (err) {
    console.error('Generate error:', err)
    return NextResponse.json({ error: 'Failed to generate xlsx' }, { status: 500 })
  }
}
