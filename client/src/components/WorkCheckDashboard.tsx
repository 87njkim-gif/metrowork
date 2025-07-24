import React, { useState, useEffect } from 'react'
import { useWorkCheck } from '../hooks/useWorkCheck'
import { CheckCircle, Clock, AlertCircle, Users, TrendingUp, Activity } from 'lucide-react'
import toast from 'react-hot-toast'

interface WorkCheckDashboardProps {
  isAdmin?: boolean
}

const WorkCheckDashboard: React.FC<WorkCheckDashboardProps> = ({ isAdmin = false }) => {
  const {
    realTimeStatus,
    statistics,
    isLoading,
    error,
    socket,
    getRealTimeStatus,
    getAllWorkCheckStatus
  } = useWorkCheck()

  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [selectedUserId, setSelectedUserId] = useState<number | undefined>()

  // 실시간 상태 자동 새로고침
  useEffect(() => {
    const interval = setInterval(() => {
      getRealTimeStatus()
    }, 30000) // 30초마다 새로고침

    return () => clearInterval(interval)
  }, [getRealTimeStatus])

  // 날짜 변경 시 데이터 새로고침
  useEffect(() => {
    if (isAdmin) {
      getAllWorkCheckStatus(selectedDate, selectedUserId)
    }
  }, [selectedDate, selectedUserId, isAdmin, getAllWorkCheckStatus])

  // Socket.IO 연결 상태 표시
  const getConnectionStatus = () => {
    if (!socket) return { status: 'disconnected', text: '연결 안됨', color: 'text-red-500' }
    if (socket.connected) return { status: 'connected', text: '실시간 연결됨', color: 'text-green-500' }
    return { status: 'connecting', text: '연결 중...', color: 'text-yellow-500' }
  }

  const connectionStatus = getConnectionStatus()

  if (isLoading && !realTimeStatus) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error && !realTimeStatus) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-red-800 mb-2">오류 발생</h3>
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => getRealTimeStatus()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          다시 시도
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">실시간 업무 현황</h2>
          <p className="text-gray-600 mt-1">
            {realTimeStatus?.today ? new Date(realTimeStatus.today).toLocaleDateString('ko-KR') : '오늘'} 기준
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* 실시간 연결 상태 */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connectionStatus.color.replace('text-', 'bg-')}`}></div>
            <span className={`text-sm ${connectionStatus.color}`}>
              {connectionStatus.text}
            </span>
          </div>
          
          {/* 새로고침 버튼 */}
          <button
            onClick={() => getRealTimeStatus()}
            disabled={isLoading}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <Activity className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* 관리자 필터 */}
      {isAdmin && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">날짜 선택</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">사용자 필터</label>
              <select
                value={selectedUserId || ''}
                onChange={(e) => setSelectedUserId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">전체 사용자</option>
                {realTimeStatus?.userStatistics.map((user) => (
                  <option key={user.user_id} value={user.user_id}>
                    {user.user_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* 전체 체크 수 */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">전체 체크</p>
              <p className="text-3xl font-bold text-gray-900">
                {realTimeStatus?.statistics.total || 0}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* 완료된 업무 */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">완료된 업무</p>
              <p className="text-3xl font-bold text-green-600">
                {realTimeStatus?.statistics.completed || 0}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        {/* 진행 중인 업무 */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">진행 중</p>
              <p className="text-3xl font-bold text-yellow-600">
                {realTimeStatus?.statistics.inProgress || 0}
              </p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>

        {/* 완료율 */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">완료율</p>
              <p className="text-3xl font-bold text-purple-600">
                {realTimeStatus?.statistics.total ? 
                  Math.round((realTimeStatus.statistics.completed / realTimeStatus.statistics.total) * 100) : 0}%
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 사용자별 통계 */}
      {realTimeStatus?.userStatistics && realTimeStatus.userStatistics.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Users className="h-5 w-5" />
              사용자별 현황
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    사용자
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    전체
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    완료
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    진행 중
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    완료율
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {realTimeStatus.userStatistics.map((user) => (
                  <tr key={user.user_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{user.user_name}</div>
                        <div className="text-sm text-gray-500">{user.user_email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.totalChecks}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {user.completedChecks}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        {user.inProgressChecks}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.totalChecks > 0 ? 
                        Math.round((user.completedChecks / user.totalChecks) * 100) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 최근 체크 내역 */}
      {realTimeStatus?.recentChecks && realTimeStatus.recentChecks.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">최근 체크 내역</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {realTimeStatus.recentChecks.slice(0, 10).map((check) => (
              <div key={check.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      {check.status === 'completed' && (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      )}
                      {check.status === 'in_progress' && (
                        <Clock className="h-5 w-5 text-yellow-500" />
                      )}
                      {check.status === 'pending' && (
                        <AlertCircle className="h-5 w-5 text-gray-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        업무 #{check.task_id} - {check.user_name}
                      </p>
                      {check.notes && (
                        <p className="text-sm text-gray-500 mt-1">{check.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-900">
                      {new Date(check.checked_at).toLocaleString('ko-KR')}
                    </p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1
                      ${check.status === 'completed' ? 'bg-green-100 text-green-800' : 
                        check.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' : 
                        'bg-gray-100 text-gray-800'}`}>
                      {check.status === 'completed' ? '완료' : 
                       check.status === 'in_progress' ? '진행 중' : '대기'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 빈 상태 */}
      {(!realTimeStatus || 
        (realTimeStatus.statistics.total === 0 && 
         (!realTimeStatus.userStatistics || realTimeStatus.userStatistics.length === 0))) && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
          <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">아직 체크된 업무가 없습니다</h3>
          <p className="text-gray-500">
            업무를 체크하면 실시간으로 현황이 업데이트됩니다.
          </p>
        </div>
      )}
    </div>
  )
}

export default WorkCheckDashboard 