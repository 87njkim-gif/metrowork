import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from 'react-query'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './hooks/useAuth'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AdminRoute } from './components/auth/AdminRoute'

// 페이지 컴포넌트들
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import NewRegisterPage from './pages/auth/NewRegisterPage'
import DashboardPage from './pages/DashboardPage'
import ExcelUploadPage from './pages/excel/ExcelUploadPage'
import ExcelSearchPage from './pages/excel/ExcelSearchPage'
import WorkTodayPage from './pages/work/WorkTodayPage'
import AdminPendingPage from './pages/admin/AdminPendingPage'
import AdminWorkStatsPage from './pages/admin/AdminWorkStatsPage'

// 공통 컴포넌트
import BottomNavigation from './components/navigation/BottomNavigation'
import LoadingSpinner from './components/common/LoadingSpinner'

// React Query 클라이언트 설정
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5분
    },
  },
})

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <div className="App">
            <Routes>
              {/* 공개 라우트 */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/register-new" element={<NewRegisterPage />} />
              
              {/* 보호된 라우트 */}
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              } />
              
              <Route path="/excel/upload" element={
                <ProtectedRoute>
                  <ExcelUploadPage />
                </ProtectedRoute>
              } />
              
              <Route path="/excel/search" element={
                <ProtectedRoute>
                  <ExcelSearchPage />
                </ProtectedRoute>
              } />
              
              <Route path="/work/today" element={
                <ProtectedRoute>
                  <WorkTodayPage />
                </ProtectedRoute>
              } />
              
              {/* 관리자 라우트 */}
              <Route path="/admin/pending" element={
                <AdminRoute>
                  <AdminPendingPage />
                </AdminRoute>
              } />
              
              <Route path="/admin/work-stats" element={
                <AdminRoute>
                  <AdminWorkStatsPage />
                </AdminRoute>
              } />
              
              {/* 기본 리다이렉트 */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
            
            <BottomNavigation />
            
            {/* 토스트 알림 */}
            <Toaster
              position="top-center"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                  borderRadius: '12px',
                  padding: '16px',
                  fontSize: '14px',
                },
                success: {
                  iconTheme: {
                    primary: '#22c55e',
                    secondary: '#fff',
                  },
                },
                error: {
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: '#fff',
                  },
                },
              }}
            />
          </div>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App 