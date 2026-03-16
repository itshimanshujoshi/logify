'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { parseMessages, getProjectStats, groupByDate, toLocalISO } from '@/lib/parser'

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Types
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export interface EditableRow {
  id: string
  date: string
  taskLabel: string
  bullets: string[]
  hours: number
}

export interface SheetHeaders {
  task: string
  description: string
  hours: string
}

const DEFAULT_HEADERS: SheetHeaders = {
  task: 'Task',
  description: 'Description',
  hours: 'Hours to complete',
}

// â”€â”€â”€ Light futuristic palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const C = {
  appBg:       '#F0F4FF',
  white:       '#FFFFFF',
  surface:     '#FFFFFF',
  elevated:    '#F8FAFF',
  border:      '#E0E7FF',
  borderDark:  '#C7D2FE',
  // Accents
  cyan:        '#0EA5E9',
  cyanLight:   '#E0F2FE',
  violet:      '#7C3AED',
  violetLight: '#EDE9FE',
  green:       '#059669',
  greenLight:  '#D1FAE5',
  red:         '#DC2626',
  redLight:    '#FEE2E2',
  yellow:      '#D97706',
  yellowLight: '#FEF3C7',
  // Text
  text:        '#0F0F1A',
  textSoft:    '#374151',
  muted:       '#6B7280',
  mutedLight:  '#9CA3AF',
  // Header (dark band at top)
  headerBg:    '#1E0A3C',
  headerBorder:'#3D1A78',
}

function uid() { return Math.random().toString(36).slice(2, 9) }

function rowsTotal(rows: EditableRow[]) {
  return Math.round(rows.reduce((s, r) => s + (Number(r.hours) || 0), 0) * 100) / 100
}

function defaultLabel(project: string) {
  return project
}

function fmtDisplayDate(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Icons
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const Download = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)
const Check = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)
const Info = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
)
const Warning = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)
const Plus = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)
const Trash = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <polyline points="3 6 5 6 21 6" />
    <path d="m19 6-.867 14.142A2 2 0 0 1 16.138 22H7.862a2 2 0 0 1-1.995-1.858L5 6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
)
const Pencil = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)
const X = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)
const Spinner = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
  </svg>
)

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Inline editing â€” light theme
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function InlineText({
  value, onChange, placeholder = 'Click to edit', bold = false, center = false,
}: {
  value: string; onChange: (v: string) => void
  placeholder?: string; bold?: boolean; center?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => { setDraft(value) }, [value])
  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select() } }, [editing])

  const commit = useCallback(() => {
    onChange(draft.trim() || value); setEditing(false)
  }, [draft, value, onChange])

  if (editing) {
    return (
      <input
        ref={ref}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') { setDraft(value); setEditing(false) }
        }}
        className={`w-full rounded-lg px-2 py-0.5 outline-none text-sm ${bold ? 'font-semibold' : ''} ${center ? 'text-center' : ''}`}
        style={{
          background: C.white,
          border: `2px solid ${C.cyan}`,
          color: C.text,
          boxShadow: `0 0 0 3px rgba(14,165,233,.12)`,
        }}
      />
    )
  }

  return (
    <div
      onClick={() => setEditing(true)}
      title="Click to edit"
      className={`group cursor-text flex items-center gap-1.5 px-2 py-1 rounded-lg min-h-[28px]
        transition-all text-sm ${bold ? 'font-semibold' : ''} ${center ? 'justify-center' : ''}`}
      style={{ color: value ? C.text : C.mutedLight }}
      onMouseEnter={e => (e.currentTarget.style.background = C.cyanLight)}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <span className={value ? '' : 'italic text-xs'}>{value || placeholder}</span>
      <span className="opacity-0 group-hover:opacity-60 shrink-0 transition-opacity" style={{ color: C.cyan }}>
        <Pencil />
      </span>
    </div>
  )
}

function InlineNumber({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => { setDraft(String(value)) }, [value])
  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select() } }, [editing])

  const commit = useCallback(() => {
    const n = parseFloat(draft)
    onChange(isNaN(n) ? value : Math.round(n * 100) / 100)
    setEditing(false)
  }, [draft, value, onChange])

  if (editing) {
    return (
      <input
        ref={ref}
        type="number" step="0.01" min="0"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') { setDraft(String(value)); setEditing(false) }
        }}
        className="w-full rounded-lg px-2 py-0.5 outline-none text-sm text-center font-bold"
        style={{ background: C.white, border: `2px solid ${C.violet}`, color: C.violet, boxShadow: `0 0 0 3px rgba(124,58,237,.12)` }}
      />
    )
  }

  return (
    <div
      onClick={() => setEditing(true)}
      title="Click to edit hours"
      className="group cursor-text flex items-center justify-center gap-1.5 px-2 py-1 rounded-lg transition-all text-sm font-bold"
      style={{ color: C.violet }}
      onMouseEnter={e => (e.currentTarget.style.background = C.violetLight)}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {value}
      <span className="opacity-0 group-hover:opacity-60 shrink-0 transition-opacity" style={{ color: C.violet }}>
        <Pencil />
      </span>
    </div>
  )
}

function InlineDate({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => { setDraft(value) }, [value])
  useEffect(() => { if (editing) ref.current?.focus() }, [editing])

  const commit = useCallback(() => { onChange(draft || value); setEditing(false) }, [draft, value, onChange])

  if (editing) {
    return (
      <input
        ref={ref}
        type="date"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') { setDraft(value); setEditing(false) }
        }}
        className="w-full rounded-lg px-2 py-0.5 outline-none text-sm text-center"
        style={{ background: C.white, border: `2px solid ${C.cyan}`, color: C.text, boxShadow: `0 0 0 3px rgba(14,165,233,.12)` }}
      />
    )
  }

  return (
    <div
      onClick={() => setEditing(true)}
      title="Click to edit date"
      className="group cursor-text flex items-center justify-center gap-1.5 px-2 py-1 rounded-lg transition-all text-sm"
      style={{ color: C.textSoft }}
      onMouseEnter={e => (e.currentTarget.style.background = C.cyanLight)}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <span>{fmtDisplayDate(value)}</span>
      <span className="opacity-0 group-hover:opacity-60 shrink-0 transition-opacity" style={{ color: C.cyan }}>
        <Pencil />
      </span>
    </div>
  )
}

// â”€â”€ Bullet editor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function BulletItem({ value, onChange, onDelete }: { value: string; onChange: (v: string) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(!value)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { setDraft(value) }, [value])
  useEffect(() => { if (editing) { ref.current?.focus(); if (value) ref.current?.select() } }, [editing, value])

  const commit = useCallback(() => { onChange(draft); setEditing(false) }, [draft, onChange])

  return (
    <div className="flex items-start gap-1.5 group/bullet">
      <span className="shrink-0 mt-1 select-none text-xs font-bold" style={{ color: C.violet }}>#</span>
      {editing ? (
        <textarea
          ref={ref} rows={2}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Escape') { setDraft(value); setEditing(false) }
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit() }
          }}
          className="flex-1 text-xs rounded-lg px-2 py-1.5 outline-none resize-none leading-relaxed"
          style={{ background: C.white, border: `2px solid ${C.violet}`, color: C.text, boxShadow: `0 0 0 3px rgba(124,58,237,.10)` }}
        />
      ) : (
        <div
          onClick={() => setEditing(true)}
          title="Click to edit"
          className="flex-1 text-xs leading-relaxed py-1 px-1.5 rounded-lg cursor-text transition-all"
          style={{ color: value ? C.textSoft : C.mutedLight }}
          onMouseEnter={e => (e.currentTarget.style.background = C.violetLight)}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          {value || <span className="italic">Empty â€” click to write</span>}
        </div>
      )}
      <button
        onClick={onDelete}
        className="opacity-0 group-hover/bullet:opacity-100 mt-0.5 shrink-0 p-1 rounded-md transition-all"
        style={{ color: C.red }}
        onMouseEnter={e => (e.currentTarget.style.background = C.redLight)}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <X />
      </button>
    </div>
  )
}

function BulletsCell({ bullets, onChange }: { bullets: string[]; onChange: (b: string[]) => void }) {
  return (
    <div className="space-y-1.5 py-0.5">
      {bullets.map((b, i) => (
        <BulletItem
          key={i} value={b}
          onChange={val => { const next = [...bullets]; next[i] = val; onChange(next) }}
          onDelete={() => onChange(bullets.filter((_, j) => j !== i))}
        />
      ))}
      <button
        onClick={() => onChange([...bullets, ''])}
        className="flex items-center gap-1.5 text-xs px-1.5 py-0.5 rounded-md transition-colors font-medium mt-0.5"
        style={{ color: C.violet }}
        onMouseEnter={e => (e.currentTarget.style.background = C.violetLight)}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <Plus /> Add bullet
      </button>
    </div>
  )
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Editable sheet table â€” white, clean, futuristic accents
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function EditableSheet({
  rows, headers, onRowsChange, onHeadersChange, onAddRow,
}: {
  rows: EditableRow[]; headers: SheetHeaders
  onRowsChange: (rows: EditableRow[]) => void; onHeadersChange: (h: SheetHeaders) => void; onAddRow: () => void
}) {
  const total = rowsTotal(rows)

  const updateRow = (id: string, patch: Partial<EditableRow>) =>
    onRowsChange(rows.map(r => r.id === id ? { ...r, ...patch } : r))
  const deleteRow = (id: string) => onRowsChange(rows.filter(r => r.id !== id))

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: `1.5px solid ${C.borderDark}`, boxShadow: '0 4px 24px rgba(124,58,237,.08)' }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ background: C.elevated, borderBottom: `1px solid ${C.border}` }}
      >
        <p className="text-xs font-medium" style={{ color: C.muted }}>
          Click any cell to edit Â·{' '}
          <span style={{ color: C.violet, fontWeight: 600 }}>{rows.length} rows</span>
        </p>
        <button
          onClick={onAddRow}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
          style={{ color: C.violet, border: `1.5px solid ${C.borderDark}`, background: C.white }}
          onMouseEnter={e => { e.currentTarget.style.background = C.violetLight; e.currentTarget.style.borderColor = C.violet }}
          onMouseLeave={e => { e.currentTarget.style.background = C.white; e.currentTarget.style.borderColor = C.borderDark }}
        >
          <Plus /> Add row
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto scrollbar-thin" style={{ background: C.white }}>
        <table className="w-full border-collapse text-sm" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '148px' }} />
            <col style={{ width: '155px' }} />
            <col />
            <col style={{ width: '110px' }} />
            <col style={{ width: '44px' }} />
          </colgroup>

          {/* Header â€” gradient accent */}
          <thead>
            <tr style={{ background: 'linear-gradient(90deg, rgba(14,165,233,.1) 0%, rgba(124,58,237,.12) 100%)' }}>
              <th style={{ borderBottom: `2px solid ${C.borderDark}`, borderRight: `1px solid ${C.border}`, padding: '10px 12px' }}>
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: C.cyan }}>Date</span>
              </th>
              <th style={{ borderBottom: `2px solid ${C.borderDark}`, borderRight: `1px solid ${C.border}`, padding: '8px' }}>
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: C.violet }}>Task</span>
              </th>
              <th style={{ borderBottom: `2px solid ${C.borderDark}`, borderRight: `1px solid ${C.border}`, padding: '8px' }}>
                <InlineText value={headers.description} onChange={v => onHeadersChange({ ...headers, description: v })} placeholder="Description" bold center />
              </th>
              <th style={{ borderBottom: `2px solid ${C.borderDark}`, borderRight: `1px solid ${C.border}`, padding: '8px' }}>
                <InlineText value={headers.hours} onChange={v => onHeadersChange({ ...headers, hours: v })} placeholder="Hours" bold center />
              </th>
              <th style={{ borderBottom: `2px solid ${C.borderDark}`, background: 'rgba(14,165,233,.04)' }} />
            </tr>
          </thead>

          <tbody style={{ background: C.white }}>
            {rows.map((row, idx) => (
              <tr
                key={row.id}
                className="group/row align-top transition-all animate-float-up"
                style={{
                  background: idx % 2 === 0 ? C.white : C.elevated,
                  animationDelay: `${idx * 25}ms`,
                  borderLeft: `3px solid transparent`,
                }}
                onMouseEnter={e => (e.currentTarget.style.borderLeft = `3px solid ${C.cyan}`)}
                onMouseLeave={e => (e.currentTarget.style.borderLeft = `3px solid transparent`)}
              >
                <td style={{ borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`, padding: '6px 8px' }}>
                  <InlineDate value={row.date} onChange={v => updateRow(row.id, { date: v })} />
                </td>
                <td style={{ borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`, padding: '6px 8px' }}>
                  <InlineText value={row.taskLabel} onChange={v => updateRow(row.id, { taskLabel: v })} placeholder="Task label" center />
                </td>
                <td style={{ borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`, padding: '8px 12px' }}>
                  <BulletsCell bullets={row.bullets} onChange={bullets => updateRow(row.id, { bullets })} />
                </td>
                <td style={{ borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`, padding: '6px 8px' }}>
                  <InlineNumber value={row.hours} onChange={v => updateRow(row.id, { hours: v })} />
                </td>
                <td style={{ borderBottom: `1px solid ${C.border}`, padding: '6px 4px', textAlign: 'center' }}>
                  <button
                    onClick={() => deleteRow(row.id)}
                    title="Delete row"
                    className="opacity-0 group-hover/row:opacity-100 p-1.5 rounded-lg transition-all"
                    style={{ color: C.red }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.redLight)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Trash />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>

          {/* Total */}
          <tfoot>
            <tr style={{ background: 'linear-gradient(90deg, rgba(14,165,233,.06), rgba(124,58,237,.06))', borderTop: `2px solid ${C.borderDark}` }}>
              <td colSpan={3} style={{ padding: '12px 20px', textAlign: 'right', color: C.muted, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                Total
              </td>
              <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 800, fontSize: '16px', color: C.violet }}>
                {total}h
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Project card â€” light with neon border
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const NEON = [
  { color: '#7C3AED', light: '#EDE9FE' },
  { color: '#0EA5E9', light: '#E0F2FE' },
  { color: '#059669', light: '#D1FAE5' },
  { color: '#D97706', light: '#FEF3C7' },
  { color: '#DC2626', light: '#FEE2E2' },
]

function ProjectCard({
  project, taskCount, totalHours, dayCount, selected, colorIdx, onClick,
}: {
  project: string; taskCount: number; totalHours: number; dayCount: number
  selected: boolean; colorIdx: number; onClick: () => void
}) {
  const p = NEON[colorIdx % NEON.length]

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl transition-all duration-200 animate-float-up"
      style={{
        background: selected ? p.light : C.white,
        border: `2px solid ${selected ? p.color : C.border}`,
        padding: '18px 20px',
        boxShadow: selected ? `0 4px 20px rgba(${hexToRgb(p.color)},.2)` : '0 1px 4px rgba(0,0,0,.05)',
        animationDelay: `${colorIdx * 60}ms`,
      }}
      onMouseEnter={e => {
        if (!selected) {
          e.currentTarget.style.borderColor = p.color
          e.currentTarget.style.background = p.light
          e.currentTarget.style.boxShadow = `0 4px 20px rgba(${hexToRgb(p.color)},.15)`
        }
      }}
      onMouseLeave={e => {
        if (!selected) {
          e.currentTarget.style.borderColor = C.border
          e.currentTarget.style.background = C.white
          e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,.05)'
        }
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="font-bold text-sm" style={{ color: selected ? p.color : C.text }}>{project}</span>
        </div>
        {selected && (
          <span
            className="text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1"
            style={{ background: C.white, color: p.color, border: `1.5px solid ${p.color}` }}
          >
            <Check /> Active
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 pl-5">
        {[
          { label: 'tasks', value: taskCount },
          { label: 'hours', value: `${totalHours}h` },
          { label: 'days',  value: dayCount },
        ].map(({ label, value }) => (
          <div key={label} className="text-center">
            <div className="text-xl font-extrabold leading-tight" style={{ color: selected ? p.color : C.text }}>{value}</div>
            <div className="text-xs font-medium" style={{ color: C.muted }}>{label}</div>
          </div>
        ))}
      </div>
    </button>
  )
}

// â”€â”€ Step dot â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function StepDot({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <div
      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all
        ${active ? 'animate-glow-pulse' : ''}`}
      style={{
        background: done   ? C.green
                  : active ? `linear-gradient(135deg, ${C.cyan}, ${C.violet})`
                  : C.border,
        color:  done || active ? C.white : C.muted,
      }}
    >
      {done ? <Check /> : n}
    </div>
  )
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Main page
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export default function Home() {
  const [messageText, setMessageText]     = useState('')
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [editableRows, setEditableRows]   = useState<EditableRow[]>([])
  const [headers, setHeaders]             = useState<SheetHeaders>(DEFAULT_HEADERS)
  const [isGenerating, setIsGenerating]   = useState(false)
  const [downloadDone, setDownloadDone]   = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [showGuide, setShowGuide]         = useState(false)

  const allTasks = useMemo(() => {
    if (!messageText.trim()) return []
    try { return parseMessages(messageText, new Date()) } catch { return [] }
  }, [messageText])

  const projectStats = useMemo(() => getProjectStats(allTasks), [allTasks])

  const filteredTasks = useMemo(() =>
    selectedProject ? allTasks.filter(t => t.project === selectedProject) : [],
    [allTasks, selectedProject])

  useEffect(() => {
    if (!selectedProject || filteredTasks.length === 0) { setEditableRows([]); return }
    const groups = groupByDate(filteredTasks)
    setEditableRows(groups.map(g => ({
      id: uid(),
      date: toLocalISO(g.date),
      taskLabel: defaultLabel(selectedProject),
      bullets: g.tasks.map(t => t.description),
      hours: g.totalHours,
    })))
  }, [selectedProject])

  const handleAddRow = useCallback(() => {
    const lastDate = editableRows.length > 0
      ? editableRows[editableRows.length - 1].date
      : toLocalISO(new Date())
    const next = new Date(lastDate + 'T00:00:00')
    next.setDate(next.getDate() + 1)
    setEditableRows(prev => [...prev, {
      id: uid(), date: next.toISOString().slice(0, 10),
      taskLabel: selectedProject ? defaultLabel(selectedProject) : '',
      bullets: [''], hours: 0,
    }])
  }, [editableRows, selectedProject])

  const handleDownload = useCallback(async () => {
    if (editableRows.length === 0) return
    setIsGenerating(true); setError(null); setDownloadDone(false)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: editableRows, headers, project: selectedProject ?? '' }),
      })
      if (!res.ok) throw new Error(await res.text())
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(selectedProject ?? 'logify').replace(/[^a-zA-Z0-9_-]/g, '_')}_timesheet.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      setDownloadDone(true)
      setTimeout(() => setDownloadDone(false), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed')
    } finally {
      setIsGenerating(false)
    }
  }, [editableRows, headers, selectedProject])

  const step = !messageText.trim() ? 1 : !selectedProject ? 2 : 3
  const hasRows = editableRows.length > 0

  return (
    <div className="min-h-screen app-grid-bg">

      {/* â”€â”€ Header â”€â”€ */}
      <header
        className="sticky top-0 z-20"
        style={{ background: C.headerBg, borderBottom: `1px solid ${C.headerBorder}` }}
      >
        {/* Accent line */}
        <div className="h-0.5 w-full"
          style={{ background: `linear-gradient(90deg, ${C.cyan}, ${C.violet}, ${C.cyan})` }} />

        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center"
              style={{ border: '1px solid rgba(255,255,255,.15)', background: 'rgba(255,255,255,.08)' }}>
              <img src="/assets/logo.png" alt="Logify" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight tracking-tight"
                style={{ background: `linear-gradient(90deg, ${C.cyan}, #A78BFA)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Logify
              </h1>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,.45)' }}>Messages â†’ .xlsx in seconds</p>
            </div>
          </div>

          {/* Steps */}
          <div className="hidden sm:flex items-center gap-2">
            {(['Paste Messages', 'Select Project', 'Edit & Download'] as const).map((label, i) => (
              <div key={i} className="flex items-center gap-2">
                <StepDot n={i + 1} active={step === i + 1} done={step > i + 1} />
                <span className="text-xs font-semibold transition-colors"
                  style={{ color: step > i + 1 ? C.green : step === i + 1 ? 'white' : 'rgba(255,255,255,.4)' }}>
                  {label}
                </span>
                {i < 2 && <div className="w-8 h-px mx-1" style={{ background: 'rgba(255,255,255,.15)' }} />}
              </div>
            ))}
          </div>

          {/* Guide toggle */}
          <button
            onClick={() => setShowGuide(g => !g)}
            className="hidden md:flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
            style={{
              color: showGuide ? C.cyan : 'rgba(255,255,255,.6)',
              border: `1px solid ${showGuide ? 'rgba(14,165,233,.5)' : 'rgba(255,255,255,.15)'}`,
              background: showGuide ? 'rgba(14,165,233,.1)' : 'transparent',
            }}
          >
            <Info />{showGuide ? 'Hide guide' : 'How to use'}
          </button>
        </div>

        {/* Guide panel */}
        {showGuide && (
          <div className="animate-float-up" style={{ background: '#160829', borderTop: `1px solid ${C.headerBorder}` }}>
            <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  n: '1', color: C.cyan,
                  title: 'Include dates in messages',
                  content: (
                    <div className="space-y-2 mt-1.5">
                      <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,.5)' }}>Option A â€” Date field</p>
                      <pre className="text-xs rounded-lg px-2.5 py-2 leading-relaxed whitespace-pre"
                        style={{ background: 'rgba(0,0,0,.3)', color: C.cyan, border: '1px solid rgba(14,165,233,.2)', fontFamily: 'monospace' }}>{`Date : 2026-03-12\nProject : LC\nTask: ...\nStart Time : 09:48 AM`}</pre>
                      <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,.5)' }}>Option B â€” Separator</p>
                      <pre className="text-xs rounded-lg px-2.5 py-2 leading-relaxed whitespace-pre"
                        style={{ background: 'rgba(0,0,0,.3)', color: '#A78BFA', border: '1px solid rgba(124,58,237,.2)', fontFamily: 'monospace' }}>{`--- 2026-03-12 ---\nProject : LC\nTask: ...`}</pre>
                    </div>
                  ),
                },
                { n: '2', color: '#A78BFA', title: 'Paste messages', content: <p className="text-xs leading-relaxed mt-1" style={{ color: 'rgba(255,255,255,.5)' }}>Copy your daily work log. Mixed projects are fine â€” garbage like "ok sir" and lunch entries are auto-filtered.</p> },
                { n: '3', color: C.green,   title: 'Select project',       content: <p className="text-xs leading-relaxed mt-1" style={{ color: 'rgba(255,255,255,.5)' }}>Pick which project to generate a timesheet for. Each gets its own Excel sheet.</p> },
                { n: '4', color: C.yellow,  title: 'Edit & Download',      content: <p className="text-xs leading-relaxed mt-1" style={{ color: 'rgba(255,255,255,.5)' }}>Click any cell to edit headers, dates, tasks, descriptions, or hours. Then download as .xlsx.</p> },
              ].map(item => (
                <div key={item.n} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: `rgba(${hexToRgb(item.color)},.2)`, color: item.color, border: `1px solid rgba(${hexToRgb(item.color)},.4)` }}>
                    {item.n}
                  </span>
                  <div>
                    <p className="text-xs font-bold text-white">{item.title}</p>
                    {item.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-5">

        {/* â”€â”€ Step 1: Paste â”€â”€ */}
        <section className="rounded-2xl overflow-hidden animate-float-up"
          style={{ background: C.white, border: `1.5px solid ${C.border}`, boxShadow: '0 2px 16px rgba(124,58,237,.06)' }}>

          <div className="px-6 pt-5 pb-4 flex items-center justify-between"
            style={{ borderBottom: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: step > 1 ? C.green : `linear-gradient(135deg, ${C.cyan}, ${C.violet})`, color: C.white }}>
                {step > 1 ? <Check /> : '1'}
              </div>
              <h2 className="font-semibold" style={{ color: C.text }}>Paste your messages</h2>
            </div>
            {allTasks.length > 0 && (
              <span className="text-xs font-bold px-3 py-1 rounded-full animate-fade-in"
                style={{ background: C.greenLight, color: C.green, border: `1px solid rgba(5,150,105,.25)` }}>
                {allTasks.length} tasks Â· {projectStats.length} project{projectStats.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Textarea with scan animation */}
            <div className="lg:col-span-2 flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.muted }}>
                Messages - paste everything, mixed projects are fine
              </label>
              <div className="relative flex-1">
                <textarea
                  value={messageText}
                  onChange={e => { setMessageText(e.target.value); setSelectedProject(null) }}
                  rows={14}
                  placeholder={[
                    '--- 2026-03-12 ---',
                    'Project : LC',
                    'Task: [LC-252] Testing new functionalities',
                    'Start Time : 09:48 AM',
                    'End Time : 12:25 PM',
                    'Status : Done',
                    '',
                    'Project : CanXida',
                    'Task: [CAN-2277] Testing coupon',
                    'Start Time : 05:52 PM',
                    'End Time : 07:06 PM',
                  ].join('\n')}
                  className="w-full rounded-xl p-4 font-mono text-sm leading-relaxed resize-y outline-none transition-all scrollbar-thin"
                  style={{
                    background: C.elevated,
                    border: `1.5px solid ${messageText ? C.cyan : C.border}`,
                    color: C.text,
                    boxShadow: messageText ? `0 0 0 3px rgba(14,165,233,.08)` : 'none',
                  }}
                  onFocus={e => { e.currentTarget.style.border = `1.5px solid ${C.cyan}`; e.currentTarget.style.background = C.white }}
                  onBlur={e => { e.currentTarget.style.border = `1.5px solid ${messageText ? C.cyan : C.border}`; e.currentTarget.style.background = messageText ? C.white : C.elevated }}
                />
                {messageText && (
                  <div className="absolute left-3 right-3 pointer-events-none scan-active overflow-hidden"
                    style={{ height: '2px', borderRadius: '1px', zIndex: 10 }}>
                    <div className="h-full"
                      style={{ background: `linear-gradient(90deg, transparent, ${C.cyan}, ${C.violet}, transparent)`, opacity: 0.5 }} />
                  </div>
                )}
              </div>
            </div>

            {/* Side panel */}
            <div className="space-y-4">
              {/* Date format tips */}
              <div className="rounded-xl p-4" style={{ background: C.elevated, border: `1.5px solid ${C.border}` }}>
                <div className="flex items-center gap-2 mb-3">
                  <span style={{ color: C.cyan }}><Info /></span>
                  <span className="text-xs font-bold" style={{ color: C.text }}>Including dates</span>
                </div>

                <div className="mb-3">
                  <p className="text-xs font-semibold mb-1.5 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full text-center text-xs font-bold leading-4"
                      style={{ background: C.cyanLight, color: C.cyan }}>A</span>
                    <span style={{ color: C.textSoft }}>Add a Date field</span>
                  </p>
                  <pre className="text-xs rounded-lg px-3 py-2.5 leading-relaxed whitespace-pre"
                    style={{ background: C.white, color: C.cyan, border: `1px solid ${C.border}`, fontFamily: 'monospace' }}>{`Date : 2026-03-12\nProject : LC\nTask: [LC-252] Testing\nStart Time : 09:48 AM`}</pre>
                </div>

                <div>
                  <p className="text-xs font-semibold mb-1.5 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full text-center text-xs font-bold leading-4"
                      style={{ background: C.violetLight, color: C.violet }}>B</span>
                    <span style={{ color: C.textSoft }}>Day separator</span>
                  </p>
                  <pre className="text-xs rounded-lg px-3 py-2.5 leading-relaxed whitespace-pre"
                    style={{ background: C.white, color: C.violet, border: `1px solid ${C.border}`, fontFamily: 'monospace' }}>{`--- 2026-03-12 ---\nProject : LC\nTask: ...\n\n--- 2026-03-13 ---\nProject : LC\nTask: ...`}</pre>
                </div>
              </div>

              {/* Parse status */}
              {allTasks.length > 0 && (
                <div className="rounded-xl p-4 animate-float-up"
                  style={{ background: C.greenLight, border: `1.5px solid rgba(5,150,105,.3)` }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span style={{ color: C.green }}><Check /></span>
                    <span className="text-xs font-bold" style={{ color: C.green }}>Parsed successfully</span>
                  </div>
                  <p className="text-sm font-bold" style={{ color: C.text }}>{allTasks.length} valid tasks found</p>
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: C.green }}>
                    {projectStats.map(p => p.project).join(', ')}
                  </p>
                </div>
              )}

              {messageText.trim() && allTasks.length === 0 && (
                <div className="rounded-xl p-4 animate-float-up"
                  style={{ background: C.redLight, border: `1.5px solid rgba(220,38,38,.25)` }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span style={{ color: C.red }}><Warning /></span>
                    <span className="text-xs font-bold" style={{ color: C.red }}>No valid tasks found</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: C.red }}>
                    Each task needs{' '}
                    <code className="px-1 rounded" style={{ background: 'rgba(220,38,38,.1)' }}>Project :</code>,{' '}
                    <code className="px-1 rounded" style={{ background: 'rgba(220,38,38,.1)' }}>Task:</code>, and{' '}
                    <code className="px-1 rounded" style={{ background: 'rgba(220,38,38,.1)' }}>Start Time :</code>
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* â”€â”€ Step 2: Select Project â”€â”€ */}
        {allTasks.length > 0 && (
          <section className="rounded-2xl overflow-hidden animate-float-up"
            style={{ background: C.white, border: `1.5px solid ${C.border}`, boxShadow: '0 2px 16px rgba(124,58,237,.06)' }}>
            <div className="px-6 pt-5 pb-4 flex items-center gap-3"
              style={{ borderBottom: `1px solid ${C.border}` }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{
                  background: step > 2 ? C.green : step === 2 ? `linear-gradient(135deg, ${C.cyan}, ${C.violet})` : C.border,
                  color: step >= 2 ? C.white : C.muted,
                }}>
                {step > 2 ? <Check /> : '2'}
              </div>
              <h2 className="font-semibold" style={{ color: C.text }}>Select project to generate sheet for</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {projectStats.map((ps, i) => (
                  <ProjectCard key={ps.project} {...ps} selected={selectedProject === ps.project}
                    colorIdx={i} onClick={() => setSelectedProject(ps.project)} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* â”€â”€ Step 3: Edit & Download â”€â”€ */}
        {selectedProject && hasRows && (
          <section className="rounded-2xl overflow-hidden animate-float-up"
            style={{ background: C.white, border: `1.5px solid ${C.border}`, boxShadow: '0 2px 16px rgba(124,58,237,.06)' }}>
            <div className="px-6 pt-5 pb-4 flex items-center justify-between flex-wrap gap-3"
              style={{ borderBottom: `1px solid ${C.border}` }}>
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: `linear-gradient(135deg, ${C.cyan}, ${C.violet})`, color: C.white }}>
                  3
                </div>
                <div>
                  <h2 className="font-semibold" style={{ color: C.text }}>Edit sheet &amp; Download</h2>
                  <p className="text-xs mt-0.5" style={{ color: C.muted }}>
                    {editableRows.length} day{editableRows.length !== 1 ? 's' : ''} Â· {rowsTotal(editableRows)}h total
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <button
                  onClick={handleDownload}
                  disabled={isGenerating}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all"
                  style={{
                    background: downloadDone
                      ? `linear-gradient(135deg, ${C.green}, #10B981)`
                      : `linear-gradient(135deg, ${C.cyan}, ${C.violet})`,
                    color: C.white,
                    boxShadow: downloadDone
                      ? `0 4px 16px rgba(5,150,105,.35)`
                      : `0 4px 16px rgba(14,165,233,.35)`,
                    opacity: isGenerating ? 0.8 : 1,
                  }}
                  onMouseEnter={e => { if (!isGenerating) e.currentTarget.style.boxShadow = `0 6px 24px rgba(14,165,233,.5)` }}
                  onMouseLeave={e => { if (!isGenerating) e.currentTarget.style.boxShadow = `0 4px 16px rgba(14,165,233,.35)` }}
                >
                  {isGenerating ? <><Spinner /> Generating...</>
                    : downloadDone ? <><Check /> Downloaded!</>
                    : <><Download /> Download .xlsx</>}
                </button>
                {isGenerating && (
                  <div className="w-full rounded-full overflow-hidden animate-fade-in" style={{ height: '3px', background: C.border }}>
                    <div className="h-full rounded-full progress-bar"
                      style={{ background: `linear-gradient(90deg, ${C.cyan}, ${C.violet})` }} />
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
                style={{ background: C.cyanLight, border: `1px solid rgba(14,165,233,.2)` }}>
                <span className="shrink-0 mt-0.5" style={{ color: C.cyan }}><Info /></span>
                <p className="text-xs leading-relaxed" style={{ color: C.textSoft }}>
                  <strong style={{ color: C.text }}>Click any cell to edit</strong> â€” headers, dates, task labels, descriptions, and hours.
                  Use <strong style={{ color: C.violet }}>+ Add bullet</strong> per row, or hover and click{' '}
                  <span className="inline-flex items-center" style={{ color: C.red }}><Trash /></span> to delete a row.
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl animate-fade-in"
                  style={{ background: C.redLight, border: `1px solid rgba(220,38,38,.25)` }}>
                  <span className="shrink-0 mt-0.5" style={{ color: C.red }}><Warning /></span>
                  <p className="text-sm" style={{ color: C.red }}>{error}</p>
                </div>
              )}

              <EditableSheet
                rows={editableRows} headers={headers}
                onRowsChange={setEditableRows} onHeadersChange={setHeaders} onAddRow={handleAddRow}
              />

              <p className="text-xs text-center" style={{ color: C.mutedLight }}>
                Logify fills all calendar days Â· yellow header Â· Arial 14pt Â· SUM formula in Total row
              </p>
            </div>
          </section>
        )}

        {selectedProject && !hasRows && filteredTasks.length === 0 && (
          <div className="rounded-2xl p-10 text-center animate-float-up"
            style={{ background: C.yellowLight, border: `1.5px solid rgba(217,119,6,.25)` }}>
            <p className="font-bold text-lg mb-2" style={{ color: C.yellow }}>No tasks for {selectedProject}</p>
            <p className="text-sm" style={{ color: 'rgba(217,119,6,.8)' }}>
              Make sure messages include{' '}
              <code className="px-1.5 py-0.5 rounded font-mono" style={{ background: 'rgba(217,119,6,.12)' }}>
                Project : {selectedProject}
              </code>
            </p>
          </div>
        )}
      </main>
    </div>
  )
}


