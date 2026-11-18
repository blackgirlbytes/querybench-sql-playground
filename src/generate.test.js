import test from 'node:test'
import assert from 'node:assert/strict'
import initSqlJs from 'sql.js'
import { starterSql } from './sample.js'
import { generateRows } from './generate.js'

const SQL = await initSqlJs()

test('starter data supports joins and generated foreign keys', () => {
  const db = new SQL.Database()
  db.run(starterSql)
  generateRows(db, 'customers', 5)
  generateRows(db, 'orders', 12)
  const count = db.exec('SELECT COUNT(*) FROM orders o JOIN customers c ON c.id = o.customer_id')[0].values[0][0]
  assert.equal(count, 20)
  const violations = db.exec('PRAGMA foreign_key_check')
  assert.equal(violations.length, 0)
  db.close()
})

test('generator handles a user-created table and rejects missing parent rows', () => {
  const db = new SQL.Database()
  db.run('PRAGMA foreign_keys = ON; CREATE TABLE teams (id INTEGER PRIMARY KEY, name TEXT NOT NULL); CREATE TABLE players (id INTEGER PRIMARY KEY, team_id INTEGER NOT NULL REFERENCES teams(id), name TEXT NOT NULL, age INTEGER NOT NULL)')
  assert.throws(() => generateRows(db, 'players', 2), /Add rows to teams first/)
  generateRows(db, 'teams', 3)
  generateRows(db, 'players', 7)
  assert.equal(db.exec('SELECT COUNT(*) FROM players')[0].values[0][0], 7)
  assert.equal(db.exec('PRAGMA foreign_key_check').length, 0)
  db.close()
})
