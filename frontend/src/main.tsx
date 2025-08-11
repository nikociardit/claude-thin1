import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App.tsx'
import './index.css'
import './fallback.css'

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
      retry: (failureCount, error: any) => {
        if (error?.response?.status === 401) return false
        return failureCount < 2
      }
    },
    mutations: {
      retry: false
    }
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1e293b',
              color: '#f1f5f9',
              fontSize: '14px',
              maxWidth: '500px'
            },
            success: {
              iconTheme: {
                primary: '#22c55e',
                secondary: '#f1f5f9'
              }
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#f1f5f9'
              }
            }
          }}
        />
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>,
)