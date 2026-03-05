'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Copy, Check } from 'lucide-react'

// Each cell can be a plain value OR have separate display/copy values
export type CopyCell = string | number | { display: React.ReactNode; copy: string }

interface Props {
  headers: string[]
  rows: CopyCell[][]
  /** Called when user copies; default copies TSV to clipboard */
  onCopy?: (text: string) => void
}

interface Sel {
  r1: number; r2: number  // row indices (inclusive), -1 = all
  c1: number; c2: number  // col indices (inclusive), -1 = all
}

function cellCopyValue(cell: CopyCell): string {
  if (cell == null) return ''
  if (typeof cell === 'object' && 'copy' in cell) return cell.copy
  return String(cell)
}

function cellDisplay(cell: CopyCell): React.ReactNode {
  if (cell == null) return ''
  if (typeof cell === 'object' && 'display' in cell) return cell.display
  return String(cell)
}

function buildTSV(headers: string[], rows: CopyCell[][], sel: Sel): string {
  const r1 = sel.r1 === -1 ? 0 : sel.r1
  const r2 = sel.r2 === -1 ? rows.length - 1 : sel.r2
  const c1 = sel.c1 === -1 ? 0 : sel.c1
  const c2 = sel.c2 === -1 ? headers.length - 1 : sel.c2

  const headerRow = headers.slice(c1, c2 + 1).join('\t')
  const dataRows = rows.slice(r1, r2 + 1)
    .map(row => row.slice(c1, c2 + 1).map(cellCopyValue).join('\t'))
  return [headerRow, ...dataRows].join('\n')
}

function inSel(sel: Sel | null, ri: number, ci: number): boolean {
  if (!sel) return false
  const r1 = sel.r1 === -1 ? 0 : sel.r1
  const r2 = sel.r2 === -1 ? Infinity : sel.r2
  const c1 = sel.c1 === -1 ? 0 : sel.c1
  const c2 = sel.c2 === -1 ? Infinity : sel.c2
  return ri >= r1 && ri <= r2 && ci >= c1 && ci <= c2
}

export default function CopyableTable({ headers, rows, onCopy }: Props) {
  const [sel, setSel] = useState<Sel | null>(null)
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ r: number; c: number } | null>(null)
  const [copied, setCopied] = useState(false)
  const tableRef = useRef<HTMLTableElement>(null)

  // Copy to clipboard
  const doCopy = useCallback((s: Sel) => {
    const text = buildTSV(headers, rows, s)
    if (onCopy) { onCopy(text); return }
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [headers, rows, onCopy])

  // Keyboard: Ctrl+C / Cmd+C
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && sel) {
        e.preventDefault()
        doCopy(sel)
      }
      if (e.key === 'Escape') setSel(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [sel, doCopy])

  // Mouse drag logic
  function startDrag(r: number, c: number) {
    setDragStart({ r, c })
    setDragging(true)
    setSel({ r1: r, r2: r, c1: c, c2: c })
  }

  function continueDrag(r: number, c: number) {
    if (!dragging || !dragStart) return
    setSel({
      r1: Math.min(dragStart.r, r),
      r2: Math.max(dragStart.r, r),
      c1: Math.min(dragStart.c, c),
      c2: Math.max(dragStart.c, c),
    })
  }

  useEffect(() => {
    function onMouseUp() { setDragging(false) }
    window.addEventListener('mouseup', onMouseUp)
    return () => window.removeEventListener('mouseup', onMouseUp)
  }, [])

  // Selection info string
  function selInfo(): string {
    if (!sel) return ''
    const r1 = sel.r1 === -1 ? 0 : sel.r1
    const r2 = sel.r2 === -1 ? rows.length - 1 : sel.r2
    const c1 = sel.c1 === -1 ? 0 : sel.c1
    const c2 = sel.c2 === -1 ? headers.length - 1 : sel.c2
    const rCount = r2 - r1 + 1
    const cCount = c2 - c1 + 1
    if (rCount === rows.length && cCount === headers.length) return 'Entire table'
    if (rCount === rows.length) return `${cCount} column${cCount > 1 ? 's' : ''}`
    if (cCount === headers.length) return `${rCount} row${rCount > 1 ? 's' : ''}`
    return `${rCount}×${cCount} cells`
  }

  const CYAN = '#0BB5C7'
  const selBg = 'rgba(11,181,199,0.10)'
  const selBorder = 'rgba(11,181,199,0.35)'

  return (
    <div className="relative select-none" style={{ userSelect: 'none' }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-2 h-7">
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {sel ? selInfo() + ' selected' : 'Click to select · Drag to select range · Ctrl+C to copy'}
        </span>
        <div className="flex items-center gap-2">
          {sel && (
            <>
              <button
                onClick={() => setSel({
                  r1: 0, r2: rows.length - 1, c1: 0, c2: headers.length - 1
                })}
                className="text-xs px-2 py-0.5 rounded"
                style={{ border: `1px solid ${selBorder}`, color: CYAN }}
              >
                Select All
              </button>
              <button
                onClick={() => doCopy(sel)}
                className="flex items-center gap-1 text-xs px-2.5 py-0.5 rounded font-medium text-white"
                style={{ backgroundColor: CYAN }}
              >
                {copied ? <Check size={11} /> : <Copy size={11} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={() => setSel(null)}
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
              >
                ✕
              </button>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
        <div className="overflow-x-auto">
          <table
            ref={tableRef}
            className="w-full text-sm"
            style={{ borderCollapse: 'collapse' }}
          >
            <thead>
              <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                {/* Row-number column header — click to select all */}
                <th
                  className="px-2 py-2.5 text-center text-xs w-8 cursor-pointer"
                  style={{ color: 'var(--color-text-muted)', borderRight: '1px solid var(--color-border)' }}
                  onClick={() => setSel({ r1: 0, r2: rows.length - 1, c1: 0, c2: headers.length - 1 })}
                  title="Select all"
                >
                  #
                </th>
                {headers.map((h, ci) => (
                  <th
                    key={ci}
                    className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer"
                    style={{
                      color: 'var(--color-text-muted)',
                      backgroundColor: sel && inSel(sel, -1, ci) ? selBg : undefined,
                    }}
                    onClick={() => setSel({ r1: 0, r2: rows.length - 1, c1: ci, c2: ci })}
                    title={`Select column "${h}"`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr
                  key={ri}
                  style={{
                    borderBottom: ri < rows.length - 1 ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  {/* Row number — click to select entire row */}
                  <td
                    className="px-2 py-2.5 text-center text-xs cursor-pointer"
                    style={{
                      color: 'var(--color-text-muted)',
                      borderRight: '1px solid var(--color-border)',
                      backgroundColor: sel && inSel(sel, ri, 0) ? selBg : 'var(--color-bg)',
                    }}
                    onClick={() => setSel({ r1: ri, r2: ri, c1: 0, c2: headers.length - 1 })}
                  >
                    {ri + 1}
                  </td>
                  {row.map((cell, ci) => {
                    const selected = sel ? inSel(sel, ri, ci) : false
                    return (
                      <td
                        key={ci}
                        className="px-3 py-2.5 cursor-cell"
                        style={{
                          backgroundColor: selected ? selBg : undefined,
                          outline: selected ? `1px solid ${selBorder}` : undefined,
                          outlineOffset: '-1px',
                        }}
                        onMouseDown={() => startDrag(ri, ci)}
                        onMouseEnter={() => continueDrag(ri, ci)}
                      >
                        {cellDisplay(cell)}
                      </td>
                    )
                  })}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={headers.length + 1}
                    className="px-4 py-6 text-center text-sm"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    No data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
