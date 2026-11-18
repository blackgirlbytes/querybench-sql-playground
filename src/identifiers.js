export function quoteIdentifier(name) {
  return `"${String(name).replaceAll('"', '""')}"`
}
