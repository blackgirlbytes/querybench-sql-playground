import { useEffect, useMemo, useRef, useState } from 'react'
import { parseRowCsv } from './csv.js'
import { applyDataset } from './generate.js'
import './builder.css'

const types = ['TEXT', 'INTEGER', 'REAL', 'NUMERIC', 'BLOB']
const textRules = [
  ['name', 'Full names'], ['email', 'Email addresses'], ['city', 'Cities'],
  ['date', 'Dates'], ['text', 'Sample text'],
]
const numberRules = [['range', 'Number range'], ['sequence', 'Sequential numbers']]
const csvExample = 'player,team,points\nAlex,Owls,12\nSam,Foxes,9\nAlex,Owls,15'
const newColumn = key => ({ key, name: '', type: 'TEXT', kind: 'auto' })

function rulesFor(type) {
  const numeric = /INT|REAL|NUM|DEC|FLOA|DOUB/i.test(type)
  return [['auto', 'Automatic'], ['choices', 'My own values'], ...(numeric ? numberRules : textRules)]
}

function ruleDraft(saved = {}) {
  return {
    kind: saved.kind || 'auto',
    choices: saved.values?.join('\n') ?? '',
    min: saved.min ?? 1,
    max: saved.max ?? 100,
  }
}

function collectRule(column) {
  if (column.kind === 'choices') {
    const values = (column.choices || '').split('\n').map(value => value.trim()).filter(Boolean)
    if (!values.length) throw new Error(`Enter at least one value for ${column.name}.`)
    return { kind: 'choices', values }
  }
  if (column.kind === 'range') {
    const min = Number(column.min ?? 1)
    const max = Number(column.max ?? 100)
    if (column.min === '' || column.max === '' || !Number.isFinite(min) || !Number.isFinite(max) || min > max) {
      throw new Error(`Enter a valid minimum and maximum for ${column.name}.`)
    }
    return { kind: 'range', min, max }
  }
  return { kind: column.kind || 'auto' }
}

function ColumnEditor({ column, index, existing, onChange, onRemove }) {
  const label = `Column ${index + 1}`
  return <div className="qb-column">
    <div className={`qb-column-fields ${existing ? 'qb-existing-column' : ''}`}>
      {existing ? <div className="qb-column-summary"><strong>{column.name}</strong><code>{column.type || 'ANY'}</code></div> : <>
        <label>Column name<input required aria-label={`${label} name`} value={column.name} placeholder="e.g. team" onChange={e => onChange({ name: e.target.value })} /></label>
        <label>Type<select aria-label={`${label} type`} value={column.type} onChange={e => onChange({ type: e.target.value, kind: 'auto' })}>{types.map(type => <option key={type}>{type}</option>)}</select></label>
      </>}
      <label>Generate<select aria-label={`${label} generator`} value={column.kind || 'auto'} onChange={e => onChange({ kind: e.target.value })}>
        {rulesFor(column.type).map(([value, title]) => <option value={value} key={value}>{title}</option>)}
      </select></label>
      {!existing && <button className="qb-remove" type="button" aria-label={`Remove column ${index + 1}`} title="Remove column" onClick={onRemove}>×</button>}
    </div>
    {column.kind === 'choices' && <label className="qb-rule-detail">Values (one per line)
      <textarea aria-label={`${label} values`} rows="3" required value={column.choices || ''} placeholder={'Owls\nFoxes\nBears'} onChange={e => onChange({ choices: e.target.value })} />
    </label>}
    {column.kind === 'range' && <div className="qb-rule-detail qb-range">
      <label>Minimum<input aria-label={`${label} minimum`} type="number" step="any" required value={column.min ?? 1} onChange={e => onChange({ min: e.target.value })} /></label>
      <label>Maximum<input aria-label={`${label} maximum`} type="number" step="any" required value={column.max ?? 100} onChange={e => onChange({ max: e.target.value })} /></label>
    </div>}
  </div>
}

function CsvPreview({ parsed }) {
  if (!parsed) return null
  if (parsed.error) return <p className="qb-csv-warning">{parsed.error}</p>
  const { columns, rows } = parsed
  return <div className="qb-preview">
    <p>Preview · {rows.length} {rows.length === 1 ? 'row' : 'rows'} · {columns.length} {columns.length === 1 ? 'column' : 'columns'}</p>
    <div className="qb-preview-scroll"><table aria-label="CSV preview">
      <thead><tr>{columns.map(column => <th key={column.name}>{column.name}</th>)}</tr></thead>
      <tbody>{rows.slice(0, 3).map((row, index) => <tr key={index}>{columns.map(column =>
        <td key={column.name}>{row[column.name] === null ? <em>NULL</em> : String(row[column.name])}</td>
      )}</tr>)}</tbody>
    </table></div>
  </div>
}

export default function DataBuilder({ db, tables, selectedTable, initialDestination = 'new', initialRules = {}, onComplete, onClose }) {
  const dialogRef = useRef(null)
  const nextKey = useRef(2)
  const [destination, setDestination] = useState(tables.length ? initialDestination : 'new')
  const [existingName, setExistingName] = useState(selectedTable || tables[0]?.name || '')
  const [newName, setNewName] = useState('')
  const [mode, setMode] = useState('generate')
  const [columns, setColumns] = useState([newColumn(1)])
  const [autoId, setAutoId] = useState(true)
  const [drafts, setDrafts] = useState(new Map())
  const [rowCount, setRowCount] = useState(25)
  const [csv, setCsv] = useState('')
  const [error, setError] = useState('')
  const creating = destination === 'new'
  const tableName = creating ? newName.trim() : existingName
  const table = tables.find(item => item.name === existingName)
  const existingColumns = (table?.columns || []).map(column => ({
    ...column,
    ...ruleDraft(initialRules?.[existingName]?.[column.name]),
    ...drafts.get(existingName)?.get(column.name),
  }))
  const editableColumns = creating ? columns : existingColumns
  const csvPlaceholder = creating ? csvExample : (table?.columns || [])
    .map(column => /[",\r\n]/.test(column.name) ? '"' + column.name.replaceAll('"', '""') + '"' : column.name)
    .join(',')
  const parsed = useMemo(() => {
    if (mode !== 'exact' || !csv.trim()) return null
    try { return parseRowCsv(csv) } catch (err) { return { error: err.message } }
  }, [csv, mode])

  useEffect(() => {
    const dialog = dialogRef.current
    dialog.showModal()
    return () => dialog.close()
  }, [])

  function changeColumn(column, patch) {
    if (creating) {
      setColumns(current => current.map(item => item.key === column.key ? { ...item, ...patch } : item))
    } else {
      setDrafts(current => {
        const tableDraft = new Map(current.get(existingName))
        tableDraft.set(column.name, { ...tableDraft.get(column.name), ...patch })
        return new Map(current).set(existingName, tableDraft)
      })
    }
  }

  function submit(event) {
    event.preventDefault()
    setError('')
    try {
      const config = { tableName }
      if (mode === 'exact') {
        if (!parsed || parsed.error) throw new Error(parsed?.error || 'Paste a header and at least one row.')
        config.rows = parsed.rows
        if (creating) config.columns = parsed.columns
      } else {
        if (creating) {
          config.columns = columns.map(column => ({ name: column.name.trim(), type: column.type }))
          if (autoId) config.columns.unshift({ name: 'id', type: 'INTEGER', primaryKey: true })
        }
        config.rules = Object.fromEntries(editableColumns.filter(column => column.kind !== 'auto').map(column => [
          creating ? column.name.trim() : column.name, collectRule(column),
        ]))
        config.count = Number(rowCount)
      }
      const count = applyDataset(db, config)
      onComplete({ tableName, count, created: creating, rules: config.rules })
    } catch (err) {
      setError(err.message)
    }
  }

  return <dialog ref={dialogRef} className="qb-builder" aria-labelledby="qb-builder-title" onCancel={onClose}>
    <form onSubmit={submit} onChange={() => setError('')}>
      <header className="qb-builder-head"><h2 id="qb-builder-title">Build a dataset</h2>
        <button type="button" className="qb-close" aria-label="Close dataset builder" onClick={onClose}>×</button>
      </header>
      <div className="qb-builder-body">
        <div className="qb-target">
          <label>Destination<select value={destination} onChange={e => setDestination(e.target.value)}>
            <option value="new">Create a new table</option>
            <option value="existing" disabled={!tables.length}>Add to an existing table</option>
          </select></label>
          {creating
            ? <label>Table name<input autoFocus required placeholder="e.g. game_scores" value={newName} onChange={e => setNewName(e.target.value)} /></label>
            : <label>Table<select value={existingName} onChange={e => setExistingName(e.target.value)}>{tables.map(item => <option key={item.name}>{item.name}</option>)}</select></label>}
        </div>
        <fieldset className="qb-modes"><legend>Row source</legend>
          <label><input type="radio" name="row-source" value="generate" checked={mode === 'generate'} onChange={() => setMode('generate')} /><span>Generate rows</span></label>
          <label><input type="radio" name="row-source" value="exact" checked={mode === 'exact'} onChange={() => setMode('exact')} /><span>Paste exact rows</span></label>
        </fieldset>
        {mode === 'generate' ? <>
          <div className="qb-section-title"><h3>Columns</h3>{creating &&
            <label className="qb-checkbox"><input type="checkbox" checked={autoId} onChange={e => setAutoId(e.target.checked)} /> Include an automatic id</label>
          }</div>
          <div className="qb-column-list">
            {editableColumns.map((column, index) => <ColumnEditor
              key={creating ? column.key : column.name}
              column={column} index={index} existing={!creating}
              onChange={patch => changeColumn(column, patch)}
              onRemove={() => setColumns(current => current.filter(item => item.key !== column.key))}
            />)}
          </div>
          {creating && <button type="button" className="qb-add" onClick={() => {
            const column = newColumn(nextKey.current++)
            setColumns(current => [...current, column])
          }}>+ Add column</button>}
          <label className="qb-count">Number of rows<input type="number" min={creating ? 0 : 1} max="1000" step="1" required value={rowCount} onChange={e => setRowCount(e.target.value)} /></label>
        </> : <>
          <label>Rows as CSV<textarea className="qb-csv" rows="6" spellCheck="false" required placeholder={csvPlaceholder} value={csv} onChange={e => setCsv(e.target.value)} /></label>
          <p className="qb-hint">{creating ? 'The first line names your columns. Their types come from the rows you paste.' : 'Use existing column names on the first line. Omit automatic IDs to let SQLite assign them.'} Use NULL for a missing value.</p>
          <CsvPreview parsed={parsed} />
        </>}
      </div>
      <footer className="qb-builder-footer">
        {error && <p className="qb-error" role="alert">{error}</p>}
        <div><button type="button" className="qb-cancel" onClick={onClose}>Cancel</button>
          <button type="submit" className="qb-submit">{creating ? 'Create table' : 'Add rows'}</button></div>
      </footer>
    </form>
  </dialog>
}
