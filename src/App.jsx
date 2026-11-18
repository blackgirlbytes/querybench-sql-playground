import { useEffect, useRef, useState } from 'react'
import { examples } from './sample.js'
import { freshDatabase, getTables, openDatabase, quoteIdentifier, runQuery, saveDatabase, previewTable } from './database.js'
import { applyDataset } from './generate.js'
import DataBuilder from './DataBuilder.jsx'

const initialQuery = examples[0].sql
const preferencesKey = 'querybench-table-preferences-v1'

function readPreferences() {
  try {
    return JSON.parse(localStorage.getItem(preferencesKey)) || {}
  } catch {
    return {}
  }
}

function previewSql(name) {
  return name ? `SELECT *\nFROM ${quoteIdentifier(name)}\nLIMIT 10;` : ''
}

function Icon({ name, size = 18 }) {
  const paths = {
    play: <path d="m8 5 10 7-10 7V5Z" fill="currentColor" stroke="none" />,
    database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    reset: <><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" /><path d="M3 3v5h5" /></>,
    chevron: <path d="m7 10 5 5 5-5" />,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="M6 6 18 18M18 6 6 18" />,
    command: <><path d="M9 7V5a2 2 0 1 0-2 2h10a2 2 0 1 0-2-2v14a2 2 0 1 0 2-2H7a2 2 0 1 0 2 2V7Z" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function formatCell(value) {
  if (value === null) return <span className="null-value">NULL</span>
  if (value instanceof Uint8Array) return <span className="null-value">BLOB</span>
  return String(value)
}

export default function App() {
  const dbRef = useRef(null)
  const editorRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [query, setQuery] = useState(initialQuery)
  const [tables, setTables] = useState([])
  const [selectedTable, setSelectedTable] = useState('customers')
  const [builder, setBuilder] = useState(null)
  const [preferences, setPreferences] = useState(readPreferences)
  const [saved, setSaved] = useState(true)
  const [rowCount, setRowCount] = useState(25)
  const [result, setResult] = useState(null)
  const [message, setMessage] = useState(null)
  const [activeExample, setActiveExample] = useState(0)
  const [showReset, setShowReset] = useState(false)
  const [panel, setPanel] = useState('results')

  function refresh(db) {
    const next = getTables(db)
    setTables(next)
    setSelectedTable(current => next.some(table => table.name === current) ? current : (next[0]?.name || ''))
    return next
  }

  useEffect(() => {
    let mounted = true
    openDatabase().then(db => {
      if (!mounted) { db.close(); return }
      dbRef.current = db
      const available = refresh(db)
      const preferred = readPreferences().selectedTable
      const first = available.find(table => table.name === preferred)
        || available.find(table => table.name === 'customers') || available[0]
      setSelectedTable(first?.name || '')
      setQuery(first?.name === 'customers' ? initialQuery : previewSql(first?.name))
      setActiveExample(first?.name === 'customers' ? 0 : -1)
      setResult(first ? previewTable(db, first.name) : null)
      setMessage({ type: 'success', text: 'Database ready', detail: first ? `Previewing ${first.name}.` : 'Create a table to start practicing.' })
      setReady(true)
    }).catch(error => setMessage({ type: 'error', text: 'Database could not load', detail: error.message }))
    return () => { mounted = false }
  }, [])

  function execute() {
    if (!dbRef.current || !query.trim()) return
    try {
      const output = runQuery(dbRef.current, query)
      refresh(dbRef.current)
      const last = output.sets.at(-1) || null
      setResult(last)
      setPanel('results')
      setMessage({
        type: 'success',
        text: 'Query ran successfully',
        detail: last ? `${last.values.length} ${last.values.length === 1 ? 'row' : 'rows'} returned · ${output.elapsed} ms` : `Statement completed · ${output.elapsed} ms`,
      })
    } catch (error) {
      setResult(null)
      setPanel('results')
      setMessage({ type: 'error', text: 'SQL error', detail: error.message })
      refresh(dbRef.current)
    }
  }

  const initialRules = Object.fromEntries(tables.flatMap(table => {
    const entry = Object.hasOwn(preferences.recipes || {}, table.name) && preferences.recipes[table.name]
    return entry && entry.schema === JSON.stringify(table.columns) ? [[table.name, entry.rules]] : []
  }))

  function datasetComplete({ tableName, count, created, rules }) {
    const db = dbRef.current
    const available = refresh(db)
    const updated = available.find(table => table.name === tableName)
    const recipes = Object.assign(Object.create(null), preferences.recipes)
    if (created) delete recipes[tableName]
    if (rules && updated) {
      recipes[tableName] = { schema: JSON.stringify(updated.columns), rules }
    }
    const next = { selectedTable: tableName, recipes }
    setPreferences(next)
    setSelectedTable(tableName)
    setResult(previewTable(db, tableName))
    if (created || query === initialQuery || !query.trim()) {
      setQuery(previewSql(tableName))
      setActiveExample(-1)
    }
    setPanel('results')
    setBuilder(null)
    const noun = count === 1 ? 'row' : 'rows'
    const heading = created ? `Created ${tableName} with ${count} ${noun}` : `Added ${count} ${noun} to ${tableName}`
    try {
      saveDatabase(db)
      localStorage.setItem(preferencesKey, JSON.stringify(next))
      setSaved(true)
      setMessage({ type: 'success', text: heading, detail: `Previewing up to 10 rows from ${tableName}.` })
    } catch {
      setSaved(false)
      setMessage({ type: 'error', text: heading, detail: 'Browser storage is unavailable or full. This session has your changes, but reloading may lose them.' })
    }
  }

  function addRows() {
    try {
      const rules = Object.hasOwn(initialRules, selectedTable) ? initialRules[selectedTable] : undefined
      const count = applyDataset(dbRef.current, { tableName: selectedTable, count: Number(rowCount), rules })
      datasetComplete({ tableName: selectedTable, count })
    } catch (error) {
      setMessage({ type: 'error', text: 'Could not generate rows', detail: error.message })
      setPanel('results')
    }
  }

  function reset() {
    dbRef.current?.close()
    const db = freshDatabase()
    dbRef.current = db
    refresh(db)
    setQuery(initialQuery)
    setSelectedTable('customers')
    setPreferences({})
    localStorage.removeItem(preferencesKey)
    setSaved(true)
    setResult(db.exec(initialQuery)[0] || null)
    setMessage({ type: 'success', text: 'Starter data restored', detail: 'Your saved database was replaced.' })
    setShowReset(false)
    setActiveExample(0)
    setPanel('results')
  }

  function chooseExample(index) {
    setQuery(examples[index].sql)
    setActiveExample(index)
    editorRef.current?.focus()
  }

  function handleEditorKey(event) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      execute()
    }
    if (event.key === 'Tab') {
      event.preventDefault()
      const input = event.currentTarget
      const start = input.selectionStart
      const end = input.selectionEnd
      setQuery(current => current.slice(0, start) + '  ' + current.slice(end))
      requestAnimationFrame(() => { input.selectionStart = input.selectionEnd = start + 2 })
    }
  }

  const currentTable = tables.find(table => table.name === selectedTable)

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><span>Q</span><i /></div><div><strong>Querybench</strong><small>SQL interview practice</small></div></div>
      <div className="topbar-right"><span className="engine-pill"><span className="engine-dot" /> SQLite in your browser</span><span className="save-note">{saved ? 'Auto-saved locally' : 'Changes in this session only'}</span></div>
    </header>

    <div className="workspace">
      <aside className="sidebar">
        <div className="sidebar-heading"><span>YOUR DATABASE</span><Icon name="database" size={17} /></div>
        <div className="sidebar-intro">Explore the schema, then write a query to answer your own questions.</div>
        <div className="table-list">
          {tables.map(table => <button key={table.name} className={`table-item ${selectedTable === table.name ? 'selected' : ''}`} onClick={() => { setSelectedTable(table.name); setPanel('schema') }}>
            <span className="table-icon"><Icon name="database" size={16} /></span><span className="table-name">{table.name}</span><span className="table-count">{table.count}</span>
          </button>)}
          {!tables.length && <p className="empty-tables">Create your first table to get started.</p>}
        </div>
        <div className="sidebar-divider" />
        <div className="sidebar-heading examples-heading"><span>QUERY EXAMPLES</span></div>
        <div className="example-list">{examples.map((example, index) => <button key={example.title} className={`example-item ${activeExample === index ? 'active' : ''}`} onClick={() => chooseExample(index)}><span>{example.title}</span><small>{example.subtitle}</small></button>)}</div>
        <div className="sidebar-bottom"><span className="tip-symbol">⌘</span><span>Press <kbd>⌘</kbd> + <kbd>Enter</kbd> to run a query</span></div>
      </aside>

      <main className="main-area">
        <div className="intro-row">
          <div><h1>SQL playground</h1><p>Create your own data or practice with the starter tables.</p></div>
          <div className="workspace-actions">
            <button className="create-table-button" onClick={() => setBuilder('new')} disabled={!ready}><Icon name="plus" size={17} /> Create a table</button>
            <button className="reset-button" aria-label="Reset database" title="Reset database" onClick={() => setShowReset(true)} disabled={!ready}><Icon name="reset" size={16} /></button>
          </div>
        </div>

        <section className="editor-card" aria-label="SQL editor">
          <div className="card-heading"><div className="card-title"><span className="section-icon editor-icon">{`{ }`}</span><span>SQL editor</span><span className="editor-tag">query.sql</span></div><span className="dialect">SQLite dialect</span></div>
          <div className="editor-body"><div className="line-numbers" aria-hidden="true">{query.split('\n').map((_, index) => <span key={index}>{index + 1}</span>)}</div><textarea ref={editorRef} value={query} onChange={event => { setQuery(event.target.value); setActiveExample(-1) }} onKeyDown={handleEditorKey} spellCheck="false" aria-label="SQL query" placeholder="SELECT * FROM customers;" /></div>
          <div className="editor-footer"><span>Run any SQLite statement, including CREATE TABLE and INSERT.</span><button className="run-button" onClick={execute} disabled={!ready || !query.trim()}><Icon name="play" size={17} /> Run query <span className="shortcut">⌘ ↵</span></button></div>
        </section>

        <section className="data-card" aria-label="Results and schema">
          <div className="data-tabs"><div className="tabs"><button className={panel === 'results' ? 'active' : ''} onClick={() => setPanel('results')}>Results</button><button className={panel === 'schema' ? 'active' : ''} onClick={() => setPanel('schema')}>Table structure</button></div>{panel === 'results' && result && <span className="row-summary">{result.values.length} {result.values.length === 1 ? 'row' : 'rows'}</span>}</div>
          {panel === 'results' ? <>
            {message && <div className={`status-message ${message.type}`}><span className="status-icon"><Icon name={message.type === 'success' ? 'check' : 'close'} size={15} /></span><div><strong>{message.text}</strong><span>{message.detail}</span></div></div>}
            {result ? <div className="results-scroll"><table><thead><tr>{result.columns.map((column, index) => <th key={`${column}-${index}`}>{column}</th>)}</tr></thead><tbody>{result.values.map((row, rowIndex) => <tr key={rowIndex}>{row.map((value, index) => <td key={index}>{formatCell(value)}</td>)}</tr>)}</tbody></table>{!result.values.length && <div className="empty-results">The query returned no rows.</div>}</div> : <div className="empty-results">Run a SELECT query to see rows here.</div>}
          </> : <div className="schema-content">{currentTable ? <><div className="schema-intro"><strong>{currentTable.name}</strong><span>{currentTable.count} rows · {currentTable.columns.length} columns</span></div><div className="schema-table"><div className="schema-head"><span>COLUMN</span><span>TYPE</span><span>KEY</span></div>{currentTable.columns.map(column => <div className="schema-row" key={column.name}><code>{column.name}</code><span>{column.type || 'ANY'}</span><span>{column.primaryKey ? 'Primary' : '—'}</span></div>)}</div></> : <div className="empty-results">Choose a table to view its columns.</div>}</div>}
        </section>
      </main>

      <aside className="generator-panel">
        <div className="generator-top"><h2>Generate data</h2><p>Add a batch of rows to your table. Choose “Customize rows” to set value ranges, list choices, or enter exact rows.</p></div>
        <div className="generator-form"><label htmlFor="table-select">TABLE</label><div className="select-wrap"><select id="table-select" value={selectedTable} onChange={event => setSelectedTable(event.target.value)} disabled={!tables.length}>{tables.map(table => <option key={table.name} value={table.name}>{table.name}</option>)}</select><Icon name="chevron" size={16} /></div><label htmlFor="row-count">NUMBER OF ROWS</label><input id="row-count" type="number" min="1" max="1000" value={rowCount} onChange={event => setRowCount(event.target.value)} /><span className="form-hint">1–1,000 rows per batch</span><button className="generate-button" onClick={addRows} disabled={!ready || !selectedTable}><Icon name="plus" size={18} /> Generate data</button></div>
        <button className="customize-rows-button" disabled={!ready || !selectedTable} onClick={() => setBuilder('existing')}>Customize rows</button>
      </aside>
    </div>

    {builder && <DataBuilder db={dbRef.current} tables={tables} selectedTable={selectedTable} initialDestination={builder} initialRules={initialRules} onClose={() => setBuilder(null)} onComplete={datasetComplete} />}
    {showReset && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setShowReset(false) }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="reset-title"><div className="modal-icon"><Icon name="reset" size={22} /></div><h2 id="reset-title">Reset the database?</h2><p>This replaces your current tables and rows with the original practice data.</p><div className="modal-actions"><button onClick={() => setShowReset(false)}>Cancel</button><button className="confirm-reset" onClick={reset}>Reset database</button></div></div></div>}
  </div>
}
