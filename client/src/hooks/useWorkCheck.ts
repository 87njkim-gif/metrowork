import { useState, useEffect, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import toast from 'react-hot-toast'

interface WorkCheck {
  id: number
  task_id: number
  user_id: number
  status: 'pending' | 'in_progress' | 'completed'
  notes?: string
  checked_at: string
  user_name: string
  user_email: string
}

interface WorkStatistics {
  total: number
  completed: number
  inProgress: number
  completionRate: number
}

interface RealTimeStatus {
  today: string
  statistics: {
    total: number
    completed: number
    inProgress: number
  }
  userStatistics: Array<{
    user_id: number
    user_name: string
    user_email: string
    totalChecks: number
    completedChecks: number
    inProgressChecks: number
  }>
  recentChecks: WorkCheck[]
}

interface UseWorkCheckReturn {
  // 상태
  workChecks: WorkCheck[]
  statistics: WorkStatistics
  realTimeStatus: RealTimeStatus | null
  isLoading: boolean
  error: string | null
  socket: Socket | null
  
  // 함수
  checkWork: (taskId: number, status: string, notes?: string) => Promise<void>
  uncheckWork: (taskId: number) => Promise<void>
  getWorkCheckStatus: (taskId: number) => Promise<void>
  getRealTimeStatus: () => Promise<void>
  getAllWorkCheckStatus: (date?: string, userId?: number) => Promise<void>
  joinWorkRoom: (taskId: number) => void
  leaveWorkRoom: (taskId: number) => void
  subscribeWorkStatus: () => void
  unsubscribeWorkStatus: () => void
}

export const useWorkCheck = (): UseWorkCheckReturn => {
  const [workChecks, setWorkChecks] = useState<WorkCheck[]>([])
  const [statistics, setStatistics] = useState<WorkStatistics>({
    total: 0,
    completed: 0,
    inProgress: 0,
    completionRate: 0
  })
  const [realTimeStatus, setRealTimeStatus] = useState<RealTimeStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [socket, setSocket] = useState<Socket | null>(null)

  // Socket.IO 연결
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    const newSocket = io(process.env.REACT_APP_API_URL || 'http://localhost:5000', {
      auth: { token },
      transports: ['websocket', 'polling']
    })

    newSocket.on('connect', () => {
      console.log('🔌 Socket.IO connected')
      setError(null)
    })

    newSocket.on('disconnect', () => {
      console.log('🔌 Socket.IO disconnected')
      setError('실시간 연결이 끊어졌습니다.')
    })

    newSocket.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error)
      setError('실시간 연결에 실패했습니다.')
    })

    // 실시간 업무 체크 알림
    newSocket.on('workCheckCreated', (data) => {
      console.log('📋 New work check:', data)
      toast.success(data.message)
      
      // 실시간 상태 업데이트
      getRealTimeStatus()
    })

    newSocket.on('workCheckUpdated', (data) => {
      console.log('📋 Work check updated:', data)
      toast.success(data.message)
      
      // 실시간 상태 업데이트
      getRealTimeStatus()
    })

    newSocket.on('workCheckDeleted', (data) => {
      console.log('📋 Work check deleted:', data)
      toast.success(data.message)
      
      // 실시간 상태 업데이트
      getRealTimeStatus()
    })

    // 실시간 업무 현황 업데이트
    newSocket.on('workStatusUpdate', (data) => {
      console.log('📊 Work status update:', data)
      setRealTimeStatus(prev => ({
        ...prev!,
        ...data
      }))
    })

    setSocket(newSocket)

    return () => {
      newSocket.close()
    }
  }, [])

  // 업무 체크
  const checkWork = useCallback(async (taskId: number, status: string, notes?: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/work-check/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ taskId, status, notes })
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 409) {
          // 이미 체크된 업무
          toast.error(data.message)
          if (data.data?.existingCheck) {
            toast.info(`${data.data.existingCheck.userName}님이 이미 체크했습니다.`)
          }
        } else {
          throw new Error(data.message || '업무 체크에 실패했습니다.')
        }
        return
      }

      toast.success(data.message)
      
      // 실시간 상태 업데이트
      getRealTimeStatus()
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '업무 체크 중 오류가 발생했습니다.'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 업무 체크 취소
  const uncheckWork = useCallback(async (taskId: number) => {
    setIsLoading(true)
    setError(null)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/work-check/uncheck/${taskId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || '업무 체크 취소에 실패했습니다.')
      }

      toast.success(data.message)
      
      // 실시간 상태 업데이트
      getRealTimeStatus()
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '업무 체크 취소 중 오류가 발생했습니다.'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 특정 업무의 체크 상태 조회
  const getWorkCheckStatus = useCallback(async (taskId: number) => {
    setIsLoading(true)
    setError(null)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/work-check/status/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || '업무 체크 상태 조회에 실패했습니다.')
      }

      setWorkChecks(data.data.checks)
      setStatistics(data.data.statistics)
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '업무 체크 상태 조회 중 오류가 발생했습니다.'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 실시간 업무 현황 조회
  const getRealTimeStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/work-check/real-time-status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || '실시간 업무 현황 조회에 실패했습니다.')
      }

      setRealTimeStatus(data.data)
      
    } catch (err) {
      console.error('Real-time status error:', err)
      // 실시간 상태 조회 실패는 토스트로 표시하지 않음 (백그라운드 작업)
    }
  }, [])

  // 전체 업무 체크 현황 조회 (관리자용)
  const getAllWorkCheckStatus = useCallback(async (date?: string, userId?: number) => {
    setIsLoading(true)
    setError(null)

    try {
      const token = localStorage.getItem('token')
      const params = new URLSearchParams()
      if (date) params.append('date', date)
      if (userId) params.append('userId', userId.toString())

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/work-check/all-status?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || '전체 업무 체크 현황 조회에 실패했습니다.')
      }

      setWorkChecks(data.data.checks)
      setStatistics(data.data.statistics)
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '전체 업무 체크 현황 조회 중 오류가 발생했습니다.'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Socket.IO 룸 관리
  const joinWorkRoom = useCallback((taskId: number) => {
    if (socket) {
      socket.emit('joinWorkRoom', taskId.toString())
      console.log(`📋 Joined work room: ${taskId}`)
    }
  }, [socket])

  const leaveWorkRoom = useCallback((taskId: number) => {
    if (socket) {
      socket.emit('leaveWorkRoom', taskId.toString())
      console.log(`📋 Left work room: ${taskId}`)
    }
  }, [socket])

  const subscribeWorkStatus = useCallback(() => {
    if (socket) {
      socket.emit('subscribeWorkStatus')
      console.log('📊 Subscribed to work status')
    }
  }, [socket])

  const unsubscribeWorkStatus = useCallback(() => {
    if (socket) {
      socket.emit('unsubscribeWorkStatus')
      console.log('📊 Unsubscribed from work status')
    }
  }, [socket])

  // 초기 실시간 상태 로드
  useEffect(() => {
    getRealTimeStatus()
    subscribeWorkStatus()
  }, [getRealTimeStatus, subscribeWorkStatus])

  return {
    // 상태
    workChecks,
    statistics,
    realTimeStatus,
    isLoading,
    error,
    socket,
    
    // 함수
    checkWork,
    uncheckWork,
    getWorkCheckStatus,
    getRealTimeStatus,
    getAllWorkCheckStatus,
    joinWorkRoom,
    leaveWorkRoom,
    subscribeWorkStatus,
    unsubscribeWorkStatus
  }
} 