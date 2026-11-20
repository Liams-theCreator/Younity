import type { ApplicationSummary } from './model'

export function applicationCsv(items: ApplicationSummary[]) {
  function cell(value: string) {
    // Keep submitted text as text when opened by spreadsheet software.
    const text = /^[\s]*[=+@-]|^[\t\r\n]/.test(value) ? `'${value}` : value
    return `"${text.replaceAll('"', '""')}"`
  }
  const rows = [
    ['Application ID', 'Organization', 'Representative', 'Status', 'Submitted at'],
    ...items.map((item) => [item.id, item.orgName, item.representativeFullName, item.status, item.submittedAt]),
  ]
  return '\uFEFF' + rows.map((row) => row.map(cell).join(',')).join('\r\n')
}

export function exportApplicationPage(items: ApplicationSummary[]) {
  const url = URL.createObjectURL(new Blob([applicationCsv(items)], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'younity-application-page.csv'
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
