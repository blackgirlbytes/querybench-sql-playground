import { quoteIdentifier } from './identifiers.js'

const firstNames = ['Avery', 'Jordan', 'Sam', 'Taylor', 'Morgan', 'Riley', 'Casey', 'Drew', 'Quinn', 'Jamie', 'Alex', 'Robin']
const lastNames = ['Lee', 'Rivera', 'Patel', 'Brooks', 'Nguyen', 'Cooper', 'Kim', 'Bennett', 'Diaz', 'Reed']
const cities = ['New York', 'Chicago', 'Austin', 'Seattle', 'Boston', 'Denver', 'Atlanta', 'Portland']
const products = ['Ceramic planter', 'Desk organizer', 'Canvas backpack', 'Reading light', 'Water bottle', 'Keyboard stand', 'Linen notebook', 'Phone charger']
const categories = ['Home', 'Office', 'Electronics', 'Accessories', 'Stationery']
const statuses = ['pending', 'shipped', 'delivered', 'cancelled']
const pick = values => values[Math.floor(Math.random() * values.length)]
const integer = (min, max) => min + Math.floor(Math.random() * (max - min + 1))
const date = () => new Date(Date.now() - integer(0, 700) * 86400000).toISOString().slice(0, 10)

function valueFor(column, rowNumber, tableName) {
  const name = column.name.toLowerCase()
  const type = column.type.toUpperCase()
  // SQLite applies type affinity on insert. Generate a compatible value even for
  // columns whose names normally suggest a different kind of data.
  if (!type || (type.includes('BLOB') && !type.includes('INT') && !/CHAR|CLOB|TEXT/.test(type))) {
    return new Uint8Array([integer(0, 255)])
  }
  const isText = !type.includes('INT') && /CHAR|CLOB|TEXT/.test(type)
  if (!isText) {
    if (type === 'DATE' || type === 'DATETIME' || type === 'TIMESTAMP') return date()
    if (name.includes('active') || type.includes('BOOL')) return integer(0, 1)
    if (name.includes('age')) return integer(22, 65)
    if (name.includes('quantity') || name.includes('count')) return integer(1, 5)
    if (type.includes('INT')) return integer(1, 1000)
    if (/price|amount|total|cost/.test(name)) return Number((integer(8, 250) + Math.random()).toFixed(2))
    return Number((Math.random() * 100).toFixed(2))
  }
  if (name.includes('email')) return `person${rowNumber}_${integer(1000, 9999)}@example.com`
  if (name.includes('first_name') || name === 'firstname') return pick(firstNames)
  if (name.includes('last_name') || name === 'lastname') return pick(lastNames)
  if (name.includes('city')) return pick(cities)
  if (name.includes('status')) return pick(statuses)
  if (name.includes('category')) return pick(categories)
  if ((name === 'name' && tableName.toLowerCase() === 'products') || name.includes('product_name')) return `${pick(products)} ${rowNumber}`
  if (name === 'name' || name === 'full_name') return `${pick(firstNames)} ${pick(lastNames)}`
  if (name.includes('date') || name.endsWith('_at') || name.includes('time')) return date()
  return `Sample ${column.name.replaceAll('_', ' ')} ${rowNumber}`
}

const supportedTypes = new Set(['TEXT', 'INTEGER', 'REAL', 'NUMERIC', 'BLOB'])

function checkedName(name, label) {
  if (typeof name !== 'string' || !name.trim() || name.includes('\0')) {
    throw new Error(`Enter a valid ${label} name.`)
  }
  return name.trim()
}

function createTable(db, tableName, columns) {
  if (!Array.isArray(columns) || !columns.length) throw new Error('Add at least one column.')
  const names = columns.map(column => checkedName(column.name, 'column'))
  if (new Set(names.map(name => name.toLowerCase())).size !== names.length) throw new Error('Each column needs a distinct name.')
  const definitions = columns.map((column, index) => {
    if (!supportedTypes.has(column.type)) throw new Error(`Choose a supported SQLite type for ${names[index]}.`)
    return `${quoteIdentifier(names[index])} ${column.type}`
  })
  const keys = columns.flatMap((column, i) => column.primaryKey ? [quoteIdentifier(names[i])] : [])
  if (keys.length) definitions.push(`PRIMARY KEY (${keys.join(', ')})`)
  db.run(`CREATE TABLE ${quoteIdentifier(tableName)} (${definitions.join(', ')})`)
}

function readColumns(db, tableName) {
  const table = db.exec(`PRAGMA table_info(${quoteIdentifier(tableName)})`)[0]
  if (!table?.values.length) throw new Error('Choose an existing table.')
  return table.values.map(row => ({ name: row[1], type: row[2], required: Boolean(row[3]), defaultValue: row[4], primaryKey: row[5] }))
}

function rowWriter(db, tableName) {
  const statements = new Map()
  return {
    insert(names, values) {
      const key = JSON.stringify(names)
      if (!statements.has(key)) {
        const target = quoteIdentifier(tableName)
        const clause = names.length ? `(${names.map(quoteIdentifier).join(', ')}) VALUES (${names.map(() => '?').join(', ')})` : 'DEFAULT VALUES'
        statements.set(key, db.prepare(`INSERT INTO ${target} ${clause}`))
      }
      statements.get(key).run(values)
    },
    close() {
      for (const statement of statements.values()) statement.free()
    },
  }
}

function sqlValue(value) {
  if (value === null || typeof value === 'string' || Number.isFinite(value) || value instanceof Uint8Array) return value
  if (typeof value === 'boolean') return Number(value)
  throw new Error('Use text, a finite number, or NULL for each value.')
}

function insertExactRows(writer, columns, rows) {
  if (!Array.isArray(rows) || !rows.length || rows.length > 1000) throw new Error('Enter between 1 and 1,000 rows.')
  const known = new Map(columns.map(column => [column.name.toLowerCase(), column.name]))
  rows.forEach((row, index) => {
    if (row === null || typeof row !== 'object' || Array.isArray(row)) throw new Error(`Row ${index + 1} needs named columns.`)
    const values = new Map()
    for (const [key, value] of Object.entries(row)) {
      const name = known.get(key.toLowerCase())
      if (!name) throw new Error(`Unknown column “${key}” in row ${index + 1}.`)
      if (values.has(name)) throw new Error(`Column “${name}” appears twice in row ${index + 1}.`)
      values.set(name, sqlValue(value))
    }
    const names = columns.map(column => column.name).filter(name => values.has(name))
    try {
      writer.insert(names, names.map(name => values.get(name)))
    } catch (error) {
      throw new Error(`Row ${index + 1}: ${error.message}`)
    }
  })
  return rows.length
}

function sampleForeignKeys(db, tableName, columns) {
  const groups = new Map()
  for (const key of db.exec(`PRAGMA foreign_key_list(${quoteIdentifier(tableName)})`)[0]?.values || []) {
    if (!groups.has(key[0])) groups.set(key[0], [])
    groups.get(key[0]).push(key)
  }
  return Array.from(groups.values(), keys => {
    keys.sort((a, b) => a[1] - b[1])
    const parent = keys[0][2]
    const childNames = keys.map(key => key[3].toLowerCase())
    const parentKeys = keys.some(key => !key[4]) ? readColumns(db, parent).filter(column => column.primaryKey).sort((a, b) => a.primaryKey - b.primaryKey) : []
    const targets = keys.map((key, index) => quoteIdentifier(key[4] || parentKeys[index]?.name))
    const values = db.exec(`SELECT ${targets.join(', ')} FROM ${quoteIdentifier(parent)}`)[0]?.values || []
    if (!values.length) {
      if (columns.some(column => childNames.includes(column.name.toLowerCase()) && column.required)) {
        throw new Error(`Add rows to ${parent} first; ${tableName}.${keys[0][3]} references it.`)
      }
      values.push(childNames.map(() => null))
    }
    return { childNames, values }
  })
}

function makeFactory(db, tableName, column, rule) {
  const name = column.name
  switch (rule?.kind || 'auto') {
    case 'auto': return n => valueFor(column, n, tableName)
    case 'text': return n => `${rule.prefix || 'Sample ' + name} ${n}`
    case 'name': return () => `${pick(firstNames)} ${pick(lastNames)}`
    case 'email': return n => `person${n}_${integer(1000, 9999)}@example.com`
    case 'date': return date
    case 'city': return () => pick(cities)
    case 'sequence': {
      const maximum = db.exec(`SELECT MAX(${quoteIdentifier(name)}) FROM ${quoteIdentifier(tableName)} WHERE typeof(${quoteIdentifier(name)}) IN ('integer','real')`)[0]?.values[0][0]
      let last = Math.floor(maximum ?? 0)
      return () => ++last
    }
    case 'choices': {
      if (!Array.isArray(rule.values) || !rule.values.length) throw new Error(`Enter choices for ${name}.`)
      const choices = rule.values.map(sqlValue)
      return () => pick(choices)
    }
    case 'range': {
      const { min, max } = rule
      if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) throw new Error(`Enter a valid range for ${name}.`)
      if (column.type.toUpperCase().includes('INT')) {
        const low = Math.ceil(min), high = Math.floor(max)
        if (low > high || !Number.isSafeInteger(low) || !Number.isSafeInteger(high)) throw new Error(`The range for ${name} must include a safe integer.`)
        return () => integer(low, high)
      }
      return () => Math.min(max, Math.max(min, Number((min + Math.random() * (max - min)).toFixed(2))))
    }
    default: throw new Error(`Unknown generation rule for ${name}.`)
  }
}

function insertGeneratedRows(db, writer, tableName, columns, count, rules = {}) {
  if (!Number.isInteger(count) || count < 1 || count > 1000) throw new Error('Choose between 1 and 1,000 rows.')
  for (const name of Object.keys(rules)) {
    if (!columns.some(column => column.name === name)) throw new Error(`Unknown column “${name}” in generation rules.`)
  }
  const ruleFor = column => Object.hasOwn(rules, column.name) ? rules[column.name] : undefined
  const refs = sampleForeignKeys(db, tableName, columns)
  const fkNames = new Set(refs.flatMap(ref => ref.childNames))
  const hasPrimaryIndex = db.exec(`PRAGMA index_list(${quoteIdentifier(tableName)})`)[0]?.values.some(row => row[3] === 'pk')
  const inserted = columns.filter(column => {
    if ((ruleFor(column)?.kind || 'auto') !== 'auto' || fkNames.has(column.name.toLowerCase())) return true
    const rowIdAlias = column.primaryKey && !hasPrimaryIndex && column.type.toUpperCase() === 'INTEGER'
    return !rowIdAlias && column.defaultValue === null
  })
  const names = inserted.map(column => column.name)
  const factories = inserted.map(column => makeFactory(db, tableName, column, ruleFor(column)))
  const start = db.exec(`SELECT COUNT(*) FROM ${quoteIdentifier(tableName)}`)[0].values[0][0]
  for (let i = 1; i <= count; i++) {
    const foreignValues = new Map()
    for (const { childNames, values } of refs) {
      const parent = pick(values)
      childNames.forEach((name, index) => foreignValues.set(name, parent[index]))
    }
    const values = inserted.map((column, index) => {
      const key = column.name.toLowerCase()
      if ((ruleFor(column)?.kind || 'auto') === 'auto' && foreignValues.has(key)) return foreignValues.get(key)
      return factories[index](start + i)
    })
    writer.insert(names, values)
  }
  return count
}

// Creating a table and adding its first batch is one operation, even inside a user transaction.
export function applyDataset(db, { tableName, columns, rows, count, rules }) {
  const validatedName = checkedName(tableName, 'table')
  // Retain the exact identifier selected from an existing SQLite schema.
  const name = columns === undefined ? tableName : validatedName
  if (rows !== undefined && count !== undefined) throw new Error('Choose exact rows or a generated row count.')
  db.run('SAVEPOINT qb_dataset')
  let writer
  try {
    if (columns !== undefined) createTable(db, name, columns)
    const actualColumns = readColumns(db, name)
    writer = rowWriter(db, name)
    let inserted = 0
    if (rows !== undefined) {
      inserted = insertExactRows(writer, actualColumns, rows)
    } else if (columns === undefined || count !== 0) {
      inserted = insertGeneratedRows(db, writer, name, actualColumns, count, rules)
    }
    db.run('RELEASE qb_dataset')
    return inserted
  } catch (error) {
    // SQLite may have already rolled back the entire transaction via a user-defined trigger.
    try { db.run('ROLLBACK TO qb_dataset; RELEASE qb_dataset') } catch {}
    throw error
  } finally {
    writer?.close()
  }
}

export function generateRows(db, tableName, count) {
  return applyDataset(db, { tableName, count })
}
