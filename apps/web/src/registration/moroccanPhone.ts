export const moroccanDialCode = '+212'

export const moroccanPhoneError = 'Enter a valid Moroccan phone number with 9 digits after +212.'

export function moroccanNationalNumber(value: string) {
  return value.replace(/[\s().-]/g, '').replace(/^(?:\+212|00212)?0?/, '')
}

export function isMoroccanPhoneNumber(value: string) {
  return value.trim().startsWith(moroccanDialCode) && /^[5-8]\d{8}$/.test(moroccanNationalNumber(value))
}
