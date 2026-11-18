// Parse delimiter and quote state together so quoted NULL and "001" stay text.
export function parseRowCsv(input) {
  const text = String(input).replace(/^\uFEFF/, '')
  const records = []
  let cells = []
  let field = ''
  let quoted = false
  let insideQuote = false
  let closedQuote = false

  function endField() {
    cells.push({ value: field, quoted })
    field = ''
    quoted = false
    closedQuote = false
  }

  function endRecord() {
    if (cells.length || field.length || quoted) {
      endField()
      records.push(cells)
      cells = []
    }
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (insideQuote) {
      if (char !== '"') {
        field += char
      } else if (text[i + 1] === '"') {
        field += '"'
        i++
      } else {
        insideQuote = false
        closedQuote = true
      }
    } else if (char === ',') {
      endField()
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      endRecord()
    } else if (char === '"' && !field && !closedQuote) {
      quoted = true
      insideQuote = true
    } else if (char === '"' || closedQuote) {
      throw new Error(`Unexpected character around a quote in CSV record ${records.length + 1}.`)
    } else {
      field += char
    }
  }
  if (insideQuote) throw new Error('Close the last quoted CSV field with a double quote.')
  endRecord()

  if (records.length < 2) throw new Error('Include a header and at least one row of data.')
  if (records.length > 1001) throw new Error('Paste up to 1,000 rows at a time.')
  const names = records.shift().map(cell => cell.value.trim())
  if (names.some(name => !name || name.includes('\0'))) throw new Error('Give every CSV column a name.')
  if (new Set(names.map(name => name.toLowerCase())).size !== names.length) throw new Error('Each CSV column needs a distinct name.')
  const types = names.map(() => null)

  const rows = records.map((record, index) => {
    if (record.length !== names.length) {
      throw new Error(`CSV record ${index + 2} has ${record.length} fields. The header has ${names.length}.`)
    }
    const entries = record.map((cell, i) => {
      const value = cellValue(cell)
      if (value !== null) {
        const type = typeof value === 'string' ? 'TEXT' : Number.isInteger(value) ? 'INTEGER' : 'REAL'
        if (type === 'TEXT' || !types[i] || (types[i] === 'INTEGER' && type === 'REAL')) types[i] = type
      }
      return [names[i], value]
    })
    return Object.fromEntries(entries)
  })
  return { columns: names.map((name, i) => ({name, type: types[i] || 'TEXT'})), rows }
}

function cellValue({value, quoted}) {
  if (quoted) return value
  if (value === 'NULL') return null
  if (!/^[+-]?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(value)) return value
  const number = Number(value)
  if (!Number.isFinite(number) || (Number.isInteger(number) && !Number.isSafeInteger(number))) return value
  return number
}
