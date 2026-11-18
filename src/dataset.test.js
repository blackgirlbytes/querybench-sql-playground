import test from 'node:test'
import assert from 'node:assert/strict'
import initSqlJs from 'sql.js'
import { parseRowCsv } from './csv.js'
import { applyDataset } from './generate.js'

const SQL = await initSqlJs()

test('creates a user-defined table and continues generating with explicit choices and ranges', () => {
  const db = new SQL.Database()
  const tableName = 'space "missions"'
  const columns = [
    { name: 'mission no', type: 'INTEGER', primaryKey: true },
    { name: 'select', type: 'TEXT' }, { name: 'crew', type: 'INTEGER' }, {name: 'seq', type: 'INTEGER'},
  ]
  const rules = { select: { kind: 'choices', values: ['flyby', 'orbital'] }, crew: { kind: 'range', min: 2, max: 6 }, seq: { kind: 'sequence' } }
  applyDataset(db, { tableName, columns, rules, count: 30 })
  applyDataset(db, { tableName, rules, count: 5 })
  assert.deepEqual(db.exec(`SELECT count(*), max("mission no"), max(seq) FROM "space ""missions""" WHERE crew BETWEEN 2 AND 6 AND "select" IN ('flyby','orbital')`)[0].values, [[35,35,35]])
  db.close()
})

test('exact CSV keeps quoted commas, newlines, NULLs, empty strings and leading zero IDs', () => {
  const input = 'code,score,note,date\r\n007,3.2,"a, b","NULL"\r\n008,42,"line\ntwo",NULL\r\n009,1,"say ""hi""",\r\n'
  const { columns, rows } = parseRowCsv(input)
  assert.deepEqual(columns.map(column => column.type), ['TEXT','REAL','TEXT','TEXT'])
  const db = new SQL.Database()
  applyDataset(db, { tableName: 'measurements', columns, rows })
  assert.deepEqual(db.exec('SELECT * FROM measurements')[0].values, [
    ['007', 3.2, 'a, b', 'NULL'], ['008', 42, 'line\ntwo', null], ['009', 1, 'say "hi"', ''],
  ])
  assert.throws(() => parseRowCsv('a,b\n1\n'), /record 2/)
  db.close()
})

test('failure rolls back a new table and also rolls back partial appends', () => {
  const db = new SQL.Database()
  const tableName = 'score'
  const columns = [{name:'id',type:'INTEGER',primaryKey:true}]
  const rows = [{id:10}, {id:10}]
  assert.throws(() => applyDataset(db, {tableName, columns, rows}), /Row 2/)
  assert.deepEqual(db.exec("SELECT name FROM sqlite_master WHERE name='score'"), [])
  applyDataset(db, {tableName, columns, count:1})
  assert.throws(() => applyDataset(db, {tableName, rows}), /Row 2/)
  assert.deepEqual(db.exec('SELECT id FROM score')[0].values, [[1]])
  db.close()
})

test('generation preserves column defaults and a composite foreign key', () => {
  const db = new SQL.Database()
  db.run(`PRAGMA foreign_keys=ON;
    CREATE TABLE parent(a INTEGER, b INTEGER, PRIMARY KEY(a,b));
    INSERT INTO parent VALUES(1,2),(3,4);
    CREATE TABLE child(x INTEGER, y INTEGER, flag TEXT DEFAULT 'yes', FOREIGN KEY(x,y) REFERENCES parent);`)
  applyDataset(db, {tableName:'child', count:30})
  assert.deepEqual(db.exec('PRAGMA foreign_key_check'), [])
  assert.deepEqual(db.exec("SELECT count(*) FROM child WHERE flag='yes'")[0].values, [[30]])
  db.close()
})

test('targets the exact existing table and respects its declared type during auto generation', () => {
  const db = new SQL.Database()
  db.run('CREATE TABLE " space "(status INTEGER, price TEXT); CREATE TABLE "space"(wrong INTEGER)')
  applyDataset(db, {tableName:' space ', count:5})
  assert.deepEqual(db.exec('SELECT DISTINCT typeof(status), typeof(price) FROM " space "')[0].values, [['integer', 'text']])
  assert.deepEqual(db.exec('SELECT COUNT(*) FROM space')[0].values, [[0]])
  db.close()
})
