import { describe, expect, it } from 'vitest'
import { applicationCsv } from './applicationCsv'

const application = {
  id: 'application-fixture',
  orgName: 'Campus, "Robotics"',
  representativeFullName: 'Sara Example',
  status: 'PENDING' as const,
  submittedAt: '2026-11-06T12:00:00Z',
  passwordHash: 'must-never-be-exported',
}

describe('current application page CSV', () => {
  it('quotes commas and quotes and exports only selected review fields', () => {
    const csv = applicationCsv([application])
    expect(csv).toContain('"Campus, ""Robotics"""')
    expect(csv).toContain('"Sara Example"')
    expect(csv).toContain('\r\n')
    expect(csv).not.toContain('passwordHash')
    expect(csv).not.toContain('must-never-be-exported')
  })

  it('keeps spreadsheet formula prefixes as literal submitted text', () => {
    for (const orgName of ['=1+1', '+SUM(A1:A2)', '@name', '-1+1', '  =1+1', '\t=1+1']) {
      expect(applicationCsv([{ ...application, orgName }])).toContain(`"'${orgName}"`)
    }
  })
})
