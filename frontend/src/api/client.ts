import axios from 'axios'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
})

// Inject JWT on every request
client.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('aria_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Redirect to login on 401
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      sessionStorage.removeItem('aria_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default client
