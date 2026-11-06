import { Suspense } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { AuthProvider } from './AuthProvider'

function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<div className="drishti-loading" role="status">Loading ABHEDYA…</div>}>
        <RouterProvider router={router} />
      </Suspense>
    </AuthProvider>
  )
}

export default App