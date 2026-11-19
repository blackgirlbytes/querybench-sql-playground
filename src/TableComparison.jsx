import { useMemo, useState } from 'react'
import { previewTable } from './database.js'
import './comparison.css'

const pageSize = 10

function TablePreview({ db, table, page, changePage, formatCell }) {
  const lastPage = Math.max(0, Math.ceil(table.count / pageSize) - 1)
  const currentPage = Math.min(page, lastPage)
  const offset = currentPage * pageSize
  const preview = useMemo(() => {
    try {
      return previewTable(db, table.name, offset)
    } catch (error) {
      return { error: error.message }
    }
  }, [db, table, offset])
  const shown = preview.values?.length || 0
  const rowLabel = shown ? `${offset + 1}–${offset + shown} of ${table.count} ${table.count === 1 ? 'row' : 'rows'}` : '0 rows'

  return <section className="comparison-card" aria-label={`${table.name} preview`}>
    <header>
      <h3>{table.name}</h3>
      {!preview.error && <span>{rowLabel}</span>}
    </header>
    {preview.error ? <p className="comparison-empty" role="alert">{preview.error}</p> : <>
      <div className="results-scroll comparison-scroll" tabIndex={0} role="region" aria-label={`Rows in ${table.name}`}>
        <table aria-label={table.name}>
          <thead><tr>{preview.columns.map((column, i) => <th key={i} scope="col">{column}</th>)}</tr></thead>
          <tbody>{preview.values.map((row, i) => <tr key={i}>
            {row.map((value, j) => <td key={j}>{formatCell(value)}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
      {!shown && <p className="comparison-empty">This table is empty.</p>}
      {lastPage > 0 && <nav className="comparison-pages" aria-label={`Pages of ${table.name}`}>
        <button disabled={currentPage === 0} onClick={() => changePage(currentPage - 1)}>Previous</button>
        <button disabled={currentPage === lastPage} onClick={() => changePage(currentPage + 1)}>Next</button>
      </nav>}
    </>}
  </section>
}

export default function TableComparison({ db, tables, formatCell }) {
  const [pages, setPages] = useState(() => new Map())
  const selected = tables.filter(table => pages.has(table.name))

  function toggle(name) {
    setPages(previous => {
      const next = new Map(previous)
      if (next.has(name)) next.delete(name)
      else next.set(name, 0)
      return next
    })
  }

  const allSelected = selected.length === tables.length
  return <section className="table-comparison" aria-label="Tables to compare">
    <div className="comparison-heading">
      <h2>Tables to compare</h2>
      {tables.length > 0 && <button className="comparison-select-all" onClick={() => {
        setPages(allSelected ? new Map() : new Map(tables.map(table => [table.name, pages.get(table.name) || 0])))
      }}>{allSelected ? 'Clear selection' : 'Select all'}</button>}
    </div>
    {tables.length ? <div className="comparison-picker" role="group" aria-label="Choose source tables">
      {tables.map(({name}) => <label key={name}>
        <input type="checkbox" checked={pages.has(name)} onChange={() => toggle(name)} />
        {name}
      </label>)}
    </div> : <p className="comparison-empty">Create a table to browse its rows.</p>}
    {db && selected.length > 0 && <div className="comparison-grid">
      {selected.map(table => <TablePreview key={table.name} db={db} table={table} formatCell={formatCell}
        page={pages.get(table.name)} changePage={page => setPages(previous => new Map(previous).set(table.name, page))} />)}
    </div>}
  </section>
}
