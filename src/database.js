import initSqlJs from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import { starterSql } from './sample.js'
import { quoteIdentifier } from './identifiers.js'

const STORAGE_KEY = 'querybench-database-v1'
let SQL

export async function openDatabase() {
  SQL ||= await initSqlJs({ locateFile: () => wasmUrl })
  const saved = localStorage.getItem(STORAGE_KEY)
  try {
    if (saved) {
      const bytes = Uint8Array.from(atob(saved), character => character.charCodeAt(0))
      const db = new SQL.Database(bytes)
      db.run('PRAGMA foreign_keys = ON')
      return db
    }
  } catch (error) {
    console.warn('Could not restore saved database:', error)
  }
  return freshDatabase()
}

export function freshDatabase() {
  const db = new SQL.Database()
  db.run(starterSql)
  saveDatabase(db)
  return db
}

export function saveDatabase(db) {
  const bytes = db.export()
  db.run('PRAGMA foreign_keys = ON')
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
  }
  localStorage.setItem(STORAGE_KEY, btoa(binary))
}

export function getTables(db) {
  const names = db.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND lower(name) NOT GLOB 'sqlite_*' ORDER BY name")[0]?.values.map(row => row[0]) || []
  return names.map(name => ({
    name,
    columns: db.exec(`PRAGMA table_info(${quoteIdentifier(name)})`)[0]?.values.map(row => ({ name: row[1], type: row[2], primaryKey: Boolean(row[5]) })) || [],
    count: db.exec(`SELECT COUNT(*) FROM ${quoteIdentifier(name)}`)[0]?.values[0][0] || 0,
  }))
}

export { quoteIdentifier }

function executeStatements(db, sql) {
  const sets = []
  for (const statement of db.iterateStatements(sql)) {
    const columns = statement.getColumnNames()
    const values = []
    while (statement.step()) values.push(statement.get())
    if (columns.length) sets.push({ columns, values })
  }
  return sets
}

export function previewTable(db, name) {
  return executeStatements(db, `SELECT * FROM ${quoteIdentifier(name)} LIMIT 10`)[0]
}

export function runQuery(db, sql) {
  const before = db.getRowsModified()
  const started = performance.now()
  const sets = executeStatements(db, sql)
  const elapsed = Math.round(performance.now() - started)
  const changed = db.getRowsModified() || before
  saveDatabase(db)
  return { sets, elapsed, changed }
}
