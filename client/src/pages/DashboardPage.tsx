import React from 'react'
import { useQuery } from 'react-query'
import { useNavigate } from 'react-router-dom'
import { 
  Upload, 
  Search, 
  CheckSquare, 
  FileText, 
  Users, 
  TrendingUp,
  Calendar,
  Clock,
  LogOut,
  BarChart3
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import LoadingSpinner from '../components/common/LoadingSpinner'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

const DashboardPage: React.FC = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // 업무 통계 조회
  const { data: workStats, isLoading: statsLoading } = useQuery(
    'workStats',
    () => apiService.getWorkStats(),
    {
      refetchInterval: 30000, // 30초마다 갱신
      refetchOnWindowFocus: true, // 창 포커스 시 갱신
      staleTime: 0, // 항상 최신 데이터로 간주
    }
  )

  // 사용자 업무 현황 조회
  const { data: userStatus, isLoading: statusLoading } = useQuery(
    'userWorkStatus',
    () => apiService.getUserWorkStatus(),
    {
      refetchInterval: 30000,
      refetchOnWindowFocus: true, // 창 포커스 시 갱신
      staleTime: 0, // 항상 최신 데이터로 간주
    }
  )

  // 엑셀 파일 목록 조회 (관리자만)
  const { data: excelFiles, isLoading: filesLoading } = useQuery(
    'excelFiles',
    () => apiService.getExcelFiles({ limit: 5 }),
    {
      refetchInterval: 60000, // 1분마다 갱신
      enabled: user?.role === 'admin' // 관리자만 조회
    }
  )

  const isLoading = statsLoading || statusLoading || (user?.role === 'admin' && filesLoading)

  // 일반 회원용 빠른 액션
  const userQuickActions = [
    {
      id: 'search',
      title: '데이터 검색',
      description: '엑셀 데이터를 검색하고 필터링합니다',
      icon: Search,
      color: 'bg-success-500',
      path: '/excel/search'
    },
    {
      id: 'work',
      title: '오늘 업무',
      description: '오늘의 업무 현황을 확인합니다',
      icon: CheckSquare,
      color: 'bg-warning-500',
      path: '/work/today'
    }
  ]

  // 관리자용 빠른 액션
  const adminQuickActions = [
    {
      id: 'upload',
      title: '엑셀 업로드',
      description: '새로운 엑셀 파일을 업로드합니다',
      icon: Upload,
      color: 'bg-primary-500',
      path: '/excel/upload'
    },
    {
      id: 'search',
      title: '데이터 검색',
      description: '엑셀 데이터를 검색하고 필터링합니다',
      icon: Search,
      color: 'bg-success-500',
      path: '/excel/search'
    },
    {
      id: 'work',
      title: '오늘 업무',
      description: '오늘의 업무 현황을 확인합니다',
      icon: CheckSquare,
      color: 'bg-warning-500',
      path: '/work/today'
    }
  ]

  const quickActions = user?.role === 'admin' ? adminQuickActions : userQuickActions

  const handleQuickAction = (path: string) => {
    navigate(path)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="page-content">
          <LoadingSpinner size="lg" message="대시보드 로딩 중..." />
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-content">
        {/* 헤더 */}
        <div className="mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              안녕하세요, {user?.name}님!
            </h1>
            <p className="text-gray-600">
              {format(new Date(), 'yyyy년 MM월 dd일 EEEE', { locale: ko })}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors duration-200"
          >
            <LogOut className="w-4 h-4 mr-2" />
            <span className="text-sm font-medium">로그아웃</span>
          </button>
        </div>

        {/* 사용자 업무 현황 */}
        {userStatus?.data && (
          <div className="card mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">내 업무 현황</h2>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-600 mb-2">
                {userStatus.data.completedItems}
              </div>
              <div className="text-sm text-gray-600">완료된 업무</div>
            </div>
          </div>
        )}

        {/* 전체 통계 */}
        {workStats?.data && (
          <div className="card mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">전체 통계</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center">
                <div className="p-2 bg-success-100 rounded-lg mr-3">
                  <TrendingUp className="w-5 h-5 text-success-600" />
                </div>
                <div>
                  <div className="text-lg font-semibold text-gray-900">
                    {workStats.data.summary.totalCompleted}
                  </div>
                  <div className="text-sm text-gray-600">총 완료</div>
                </div>
              </div>
              <div className="flex items-center">
                <div className="p-2 bg-primary-100 rounded-lg mr-3">
                  <Calendar className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <div className="text-lg font-semibold text-gray-900">
                    {workStats.data.summary.todayCompleted}
                  </div>
                  <div className="text-sm text-gray-600">오늘 완료</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 빠른 액션 */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">빠른 액션</h2>
          <div className="space-y-3">
            {quickActions.map((action) => {
              const Icon = action.icon
              return (
                <button
                  key={action.id}
                  onClick={() => handleQuickAction(action.path)}
                  className="w-full flex items-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors duration-200"
                >
                  <div className={`p-2 rounded-lg mr-4 ${action.color}`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-medium text-gray-900">{action.title}</div>
                    <div className="text-sm text-gray-600">{action.description}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* 최근 엑셀 파일 (관리자만) */}
        {user?.role === 'admin' && excelFiles?.data && excelFiles.data.files.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">최근 엑셀 파일</h2>
            <div className="space-y-3">
              {excelFiles.data.files.slice(0, 3).map((file) => (
                <div
                  key={file.id}
                  className="flex items-center p-3 bg-gray-50 rounded-lg"
                >
                  <div className="p-2 bg-primary-100 rounded-lg mr-3">
                    <FileText className="w-5 h-5 text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {file.original_name}
                    </div>
                    <div className="text-sm text-gray-600">
                      {file.total_rows.toLocaleString()}행 • {file.total_columns}열
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {format(new Date(file.created_at), 'MM/dd')}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => navigate('/excel/search')}
              className="w-full mt-4 py-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              모든 파일 보기
            </button>
          </div>
        )}

        {/* 관리자 전용 섹션 */}
        {user?.role === 'admin' && (
          <div className="card mt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">관리자 메뉴</h2>
            <button
              onClick={() => navigate('/admin/pending')}
              className="w-full flex items-center p-4 bg-warning-50 rounded-xl hover:bg-warning-100 transition-colors duration-200 mb-3"
            >
              <div className="p-2 bg-warning-500 rounded-lg mr-4">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div className="text-left flex-1">
                <div className="font-medium text-gray-900">승인 대기 회원</div>
                <div className="text-sm text-gray-600">새로 가입한 회원을 관리합니다</div>
              </div>
            </button>
            
            <button
              onClick={() => navigate('/admin/work-stats')}
              className="w-full flex items-center p-4 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors duration-200"
            >
              <div className="p-2 bg-blue-500 rounded-lg mr-4">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div className="text-left flex-1">
                <div className="font-medium text-gray-900">업무 처리 통계</div>
                <div className="text-sm text-gray-600">회원별 업무 처리 현황을 확인합니다</div>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default DashboardPage 