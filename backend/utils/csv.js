// Minimal CSV serializer (no external deps).
//
// Why hand-rolled: we don't want to pull in csv-stringify just to emit a flat
// table. Handles the only escapes that matter: commas, quotes, newlines.

function escapeCell(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  // RFC 4180: wrap in quotes if it contains comma, quote, or newline; double-up internal quotes.
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Convert an array of plain objects to a CSV string.
 * @param {string[]} columns - ordered list of object keys to emit
 * @param {object[]} rows
 * @param {string[]} [headers] - optional custom header labels (defaults to columns)
 * @returns {string} CSV text including trailing newline
 */
function toCsv(columns, rows, headers) {
  const headerLine = (headers || columns).map(escapeCell).join(',');
  const body = rows.map((r) => columns.map((c) => escapeCell(r[c])).join(',')).join('\n');
  return body ? `${headerLine}\n${body}\n` : `${headerLine}\n`;
}

/**
 * Send a CSV download response with proper headers.
 */
function sendCsv(res, filename, csvText) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.status(200).send(csvText);
}

module.exports = { toCsv, sendCsv, escapeCell };
