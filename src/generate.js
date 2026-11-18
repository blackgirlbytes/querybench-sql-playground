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

function valueFor(column, rowNumber, refs) {
  const name = column.name.toLowerCase()
  const type = column.type.toUpperCase()
  if (refs[name]) return pick(refs[name])
  if (name.includes('email')) return `person${rowNumber}_${integer(1000, 9999)}@example.com`
  if (name.includes('first_name') || name === 'firstname') return pick(firstNames)
  if (name.includes('last_name') || name === 'lastname') return pick(lastNames)
  if (name.includes('city')) return pick(cities)
  if (name.includes('status')) return pick(statuses)
  if (name.includes('category')) return pick(categories)
  if (name === 'name' || name.includes('product_name')) return `${pick(products)} ${rowNumber}`
  if (name.includes('date') || name.endsWith('_at') || name.includes('time')) return date()
  if (name.includes('price') || name.includes('amount') || name.includes('total') || name.includes('cost')) return Number((integer(8, 250) + Math.random()).toFixed(2))
  if (name.includes('quantity') || name.includes('count')) return integer(1, 5)
  if (name.includes('age')) return integer(22, 65)
  if (name.includes('active') || type.includes('BOOL')) return integer(0, 1)
  if (type.includes('INT')) return integer(1, 1000)
  if (type.includes('REAL') || type.includes('FLOAT') || type.includes('DOUBLE') || type.includes('NUM')) return Number((Math.random() * 100).toFixed(2))
  if (type.includes('BLOB')) return new Uint8Array([integer(0, 255)])
  return `Sample ${column.name.replaceAll('_', ' ')} ${rowNumber}`
}

export function generateRows(db, tableName, count) {
  if (!Number.isInteger(count) || count < 1 || count > 1000) throw new Error('Choose between 1 and 1,000 rows.')
  const table = db.exec(`PRAGMA table_info(${quoteIdentifier(tableName)})`)[0]
  if (!table?.values.length) throw new Error('Choose a table before generating rows.')
  const columns = table.values.map(row => ({ name: row[1], type: row[2], required: Boolean(row[3]), defaultValue: row[4], primaryKey: Boolean(row[5]) }))
    .filter(column => !(column.primaryKey && column.type.toUpperCase() === 'INTEGER'))
  if (!columns.length) throw new Error('This table only has an auto-generated ID column.')
  const foreignKeys = db.exec(`PRAGMA foreign_key_list(${quoteIdentifier(tableName)})`)[0]?.values || []
  const refs = {}
  for (const key of foreignKeys) {
    const values = db.exec(`SELECT ${quoteIdentifier(key[4])} FROM ${quoteIdentifier(key[2])}`)[0]?.values.map(row => row[0]) || []
    if (!values.length) throw new Error(`Add rows to ${key[2]} first; ${tableName}.${key[3]} references it.`)
    refs[key[3].toLowerCase()] = values
  }
  const start = db.exec(`SELECT COUNT(*) FROM ${quoteIdentifier(tableName)}`)[0].values[0][0]
  const placeholders = columns.map(() => '?').join(', ')
  const statement = db.prepare(`INSERT INTO ${quoteIdentifier(tableName)} (${columns.map(column => quoteIdentifier(column.name)).join(', ')}) VALUES (${placeholders})`)
  db.run('BEGIN TRANSACTION')
  try {
    for (let index = 0; index < count; index++) {
      const values = columns.map(column => column.defaultValue !== null && !column.required ? null : valueFor(column, start + index + 1, refs))
      statement.run(values)
      statement.reset()
    }
    db.run('COMMIT')
  } catch (error) {
    db.run('ROLLBACK')
    throw error
  } finally {
    statement.free()
  }
  return count
}
