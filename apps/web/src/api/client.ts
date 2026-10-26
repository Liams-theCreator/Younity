/** Browser-managed HttpOnly cookies authenticate API requests. */
export const apiRequest: typeof fetch = async (input, options) => {
  return fetch(input, {
    ...options,
    credentials: 'include',
  })
}