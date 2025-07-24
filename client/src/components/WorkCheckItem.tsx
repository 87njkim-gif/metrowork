import React, { useState, useEffect } from 'react'
import { useWorkCheck } from '../hooks/useWorkCheck'
import { CheckCircle, Clock, AlertCircle, Edit, Trash2, MessageSquare } from 'lucide-react'
import toast from 'react-hot-toast'

interface WorkCheckItemProps {
  taskId: number
  taskName?: string
  taskDescription?: string
  isAdmin?: boolean
}

const WorkCheckItem: React.FC<WorkCheckItemProps> = ({ 
  taskId, 
  taskName = `업무 #${taskId}`, 
  taskDescription,
  isAdmin = false 
}) => {
  const {
    workChecks,
    statistics,
    isLoading,
    checkWork,
    uncheckWork,
    getWorkCheckStatus,
    joinWorkRoom,
    leaveWorkRoom
  } = useWorkCheck()

  const [showNotes, setShowNotes] = useState(false)
  const [notes, setNotes] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<'pending' | 'in_progress' | 'completed'>('pending')
  const [isEditing, setIsEditing] = useState(false)

  // 현재 사용자의 체크 상태 찾기
  const currentUserCheck = workChecks.find(check => check.task_id === taskId)
  const currentUserId = parseInt(localStorage.getItem('userId') || '0')

  // 업무 체크 상태 로드
  useEffect(() => {
    getWorkCheckStatus(taskId)
    joinWorkRoom(taskId)

    return () => {
      leaveWorkRoom(taskId)
    }
  }, [taskId, getWorkCheckStatus, joinWorkRoom, leaveWorkRoom])

  // 체크 상태 변경 시 폼 초기화
  useEffect(() => {
    if (currentUserCheck) {
      setSelectedStatus(currentUserCheck.status)
      setNotes(currentUserCheck.notes || '')
      setIsEditing(false)
    } else {
      setSelectedStatus('pending')
      setNotes('')
      setIsEditing(false)
    }
  }, [currentUserCheck])

  const handleCheckWork = async () => {
    if (!notes.trim() && selectedStatus !== 'pending') {
      toast.error('메모를 입력해주세요.')
      return
    }

    await checkWork(taskId, selectedStatus, notes.trim() || undefined)
  }

  const handleUncheckWork = async () => {
    if (window.confirm('업무 체크를 취소하시겠습니까?')) {
      await uncheckWork(taskId)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'in_progress':
        return <Clock className="h-5 w-5 text-yellow-500" />
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '완료'
      case 'in_progress':
        return '진행 중'
      default:
        return '대기'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
      {/* 업무 정보 */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{taskName}</h3>
          {taskDescription && (
            <p className="text-sm text-gray-600 mb-2">{taskDescription}</p>
          )}
          
          {/* 통계 정보 */}
          {statistics.total > 0 && (
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>전체: {statistics.total}</span>
              <span className="text-green-600">완료: {statistics.completed}</span>
              <span className="text-yellow-600">진행: {statistics.inProgress}</span>
              <span className="text-blue-600">완료율: {statistics.completionRate}%</span>
            </div>
          )}
        </div>

        {/* 현재 상태 표시 */}
        {currentUserCheck && (
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${getStatusColor(currentUserCheck.status)}`}>
            {getStatusIcon(currentUserCheck.status)}
            <span className="text-sm font-medium">
              {getStatusText(currentUserCheck.status)}
            </span>
          </div>
        )}
      </div>

      {/* 체크된 사용자 목록 */}
      {workChecks.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">체크한 사용자</h4>
          <div className="space-y-2">
            {workChecks.map((check) => (
              <div key={check.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(check.status)}
                  <div>
                    <p className="text-sm font-medium text-gray-900">{check.user_name}</p>
                    {check.notes && (
                      <p className="text-xs text-gray-500 mt-1">{check.notes}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">
                    {new Date(check.checked_at).toLocaleString('ko-KR')}
                  </p>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${getStatusColor(check.status)}`}>
                    {getStatusText(check.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 업무 체크 폼 */}
      {!currentUserCheck || isEditing ? (
        <div className="space-y-4">
          {/* 상태 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">상태 선택</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'pending', label: '대기', icon: AlertCircle },
                { value: 'in_progress', label: '진행 중', icon: Clock },
                { value: 'completed', label: '완료', icon: CheckCircle }
              ].map((status) => {
                const Icon = status.icon
                return (
                  <button
                    key={status.value}
                    onClick={() => setSelectedStatus(status.value as any)}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors ${
                      selectedStatus === status.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-sm font-medium">{status.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 메모 입력 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              메모 <span className="text-gray-500">(선택사항)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="업무 진행 상황이나 특이사항을 입력하세요..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>

          {/* 버튼 */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleCheckWork}
              disabled={isLoading}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '처리 중...' : currentUserCheck ? '상태 업데이트' : '업무 체크'}
            </button>
            
            {currentUserCheck && (
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                취소
              </button>
            )}
          </div>
        </div>
      ) : (
        /* 현재 체크 상태 표시 */
        <div className="space-y-3">
          {currentUserCheck.notes && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="flex items-start gap-2">
                <MessageSquare className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-800">{currentUserCheck.notes}</p>
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              체크 시간: {new Date(currentUserCheck.checked_at).toLocaleString('ko-KR')}
            </p>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
              >
                <Edit className="h-4 w-4" />
                수정
              </button>
              
              <button
                onClick={handleUncheckWork}
                className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 중복 체크 경고 */}
      {workChecks.length > 0 && !currentUserCheck && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-800">이미 체크된 업무</p>
              <p className="text-sm text-yellow-700 mt-1">
                다른 사용자가 이미 이 업무를 체크했습니다. 담당자와 협의 후 진행해주세요.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default WorkCheckItem 