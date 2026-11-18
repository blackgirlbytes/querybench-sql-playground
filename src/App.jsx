import { useEffect, useRef, useState } from 'react'
import { examples } from './sample.js'
import { freshDatabase, getTables, openDatabase, quoteIdentifier, runQuery, saveDatabase } from './database.js'
import { generateRows } from './generate.js'

const initialQuery = examples[0].sql

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
  }

  useEffect(() => {
    let mounted = true
    openDatabase().then(db => {
      if (!mounted) { db.close(); return }
      dbRef.current = db
      refresh(db)
      const data = db.exec(initialQuery)[0]
      setResult(data || null)
      setMessage({ type: 'success', text: 'Starter database ready', detail: 'Run a query or pick an example.' })
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

  function addRows() {
    try {
      const count = generateRows(dbRef.current, selectedTable, Number(rowCount))
      saveDatabase(dbRef.current)
      refresh(dbRef.current)
      const data = dbRef.current.exec(`SELECT * FROM ${quoteIdentifier(selectedTable)} ORDER BY rowid DESC LIMIT 10`)[0]
      setResult(data || null)
      setPanel('results')
      setMessage({ type: 'success', text: `${count} rows added to ${selectedTable}`, detail: 'Showing the 10 newest rows below.' })
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
      <div className="topbar-right"><span className="engine-pill"><span className="engine-dot" /> SQLite in your browser</span><span className="save-note">Auto-saved locally</span></div>
    </header>

    <div className="workspace">
      <aside className="sidebar">
        <div className="sidebar-heading"><span>YOUR DATABASE</span><Icon name="database" size={17} /></div>
        <div className="sidebar-intro">Explore the schema, then write a query to answer your own questions.</div>
        <div className="table-list">
          {tables.map(table => <button key={table.name} className={`table-item ${selectedTable === table.name ? 'selected' : ''}`} onClick={() => { setSelectedTable(table.name); setPanel('schema') }}>
            <span className="table-icon"><Icon name="database" size={16} /></span><span className="table-name">{table.name}</span><span className="table-count">{table.count}</span>
          </button>)}
          {!tables.length && <p className="empty-tables">No tables yet. Run a CREATE TABLE statement to get started.</p>}
        </div>
        <div className="sidebar-divider" />
        <div className="sidebar-heading examples-heading"><span>QUERY EXAMPLES</span></div>
        <div className="example-list">{examples.map((example, index) => <button key={example.title} className={`example-item ${activeExample === index ? 'active' : ''}`} onClick={() => chooseExample(index)}><span>{example.title}</span><small>{example.subtitle}</small></button>)}</div>
        <div className="sidebar-bottom"><span className="tip-symbol">⌘</span><span>Press <kbd>⌘</kbd> + <kbd>Enter</kbd> to run a query</span></div>
      </aside>

      <main className="main-area">
        <div className="intro-row"><div><div className="eyebrow">THE WORKSPACE</div><h1>Think in queries.</h1><p>Write SQL, inspect the data, and see what happens.</p></div><button className="reset-button" onClick={() => setShowReset(true)}><Icon name="reset" size={16} /> Reset database</button></div>

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
        <div className="generator-top"><div className="generator-emblem"><Icon name="plus" size={20} /></div><span className="generator-kicker">DATA GENERATOR</span><h2>Need more rows?</h2><p>Fill any table with realistic practice data in a click. Foreign keys point to existing records.</p></div>
        <div className="generator-form"><label htmlFor="table-select">TABLE</label><div className="select-wrap"><select id="table-select" value={selectedTable} onChange={event => setSelectedTable(event.target.value)} disabled={!tables.length}>{tables.map(table => <option key={table.name} value={table.name}>{table.name}</option>)}</select><Icon name="chevron" size={16} /></div><label htmlFor="row-count">NUMBER OF ROWS</label><input id="row-count" type="number" min="1" max="1000" value={rowCount} onChange={event => setRowCount(event.target.value)} /><span className="form-hint">1–1,000 rows per batch</span><button className="generate-button" onClick={addRows} disabled={!ready || !selectedTable}><Icon name="plus" size={18} /> Generate data</button></div>
        <div className="generator-note"><span className="note-icon">✦</span><p>Tip: create your own table with SQL, then select it here to generate rows for it.</p></div>
      </aside>
    </div>

    {showReset && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setShowReset(false) }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="reset-title"><div className="modal-icon"><Icon name="reset" size={22} /></div><h2 id="reset-title">Reset the database?</h2><p>This replaces your current tables and rows with the original practice data.</p><div className="modal-actions"><button onClick={() => setShowReset(false)}>Cancel</button><button className="confirm-reset" onClick={reset}>Reset database</button></div></div></div>}
  </div>
}
