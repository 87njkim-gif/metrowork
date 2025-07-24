import { Server as SocketIOServer } from 'socket.io'
import { Server as HTTPServer } from 'http'
import jwt from 'jsonwebtoken'

let io: SocketIOServer

// Socket.IO 서버 초기화
export const initializeSocketServer = (httpServer: HTTPServer): void => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true
    }
  })

  // 인증 미들웨어
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '')
    
    if (!token) {
      return next(new Error('Authentication error'))
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any
      socket.data.user = decoded
      next()
    } catch (error) {
      return next(new Error('Authentication error'))
    }
  })

  // 연결 이벤트
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id} (User: ${socket.data.user?.name})`)

    // 사용자별 룸에 참가
    const userId = socket.data.user?.id
    if (userId) {
      socket.join(`user_${userId}`)
      
      // 관리자인 경우 관리자 룸에도 참가
      if (socket.data.user?.role === 'admin') {
        socket.join('admin_room')
        console.log(`👑 Admin joined: ${socket.data.user.name}`)
      }
    }

    // 업무 체크 룸 참가
    socket.on('joinWorkRoom', (taskId: string) => {
      socket.join(`work_${taskId}`)
      console.log(`📋 User ${socket.data.user?.name} joined work room: ${taskId}`)
    })

    // 업무 체크 룸 나가기
    socket.on('leaveWorkRoom', (taskId: string) => {
      socket.leave(`work_${taskId}`)
      console.log(`📋 User ${socket.data.user?.name} left work room: ${taskId}`)
    })

    // 실시간 업무 현황 구독
    socket.on('subscribeWorkStatus', () => {
      socket.join('work_status_room')
      console.log(`📊 User ${socket.data.user?.name} subscribed to work status`)
    })

    // 실시간 업무 현황 구독 해제
    socket.on('unsubscribeWorkStatus', () => {
      socket.leave('work_status_room')
      console.log(`📊 User ${socket.data.user?.name} unsubscribed from work status`)
    })

    // 연결 해제
    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id} (User: ${socket.data.user?.name})`)
    })
  })

  console.log('🚀 Socket.IO server initialized')
}

// Socket.IO 인스턴스 내보내기
export { io }

// 실시간 알림 전송 함수들
export const sendWorkCheckNotification = (data: any, room: string = 'work_status_room') => {
  if (io) {
    io.to(room).emit('workCheckNotification', {
      timestamp: new Date(),
      ...data
    })
  }
}

export const sendWorkStatusUpdate = (data: any) => {
  if (io) {
    io.to('work_status_room').emit('workStatusUpdate', {
      timestamp: new Date(),
      ...data
    })
  }
}

export const sendUserNotification = (userId: number, data: any) => {
  if (io) {
    io.to(`user_${userId}`).emit('userNotification', {
      timestamp: new Date(),
      ...data
    })
  }
}

export const sendAdminNotification = (data: any) => {
  if (io) {
    io.to('admin_room').emit('adminNotification', {
      timestamp: new Date(),
      ...data
    })
  }
}

// 전체 사용자에게 알림
export const broadcastNotification = (data: any) => {
  if (io) {
    io.emit('broadcastNotification', {
      timestamp: new Date(),
      ...data
    })
  }
} 