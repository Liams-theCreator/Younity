export const apiRequest: typeof fetch = async (input, options) => {
  return fetch(input, {
    ...options,
    credentials: 'include',
  })
}