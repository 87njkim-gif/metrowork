import { Server as SocketIOServer } from 'socket.io'
import { Server as HTTPServer } from 'http'
import jwt from 'jsonwebtoken'

let io: SocketIOServer

// Socket.IO ?�버 초기??
export const initializeSocketServer = (httpServer: HTTPServer): void => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true
    }
  })

  // ?�증 미들?�어
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

  // ?�결 ?�벤??
  io.on('connection', (socket) => {
    console.log(`?�� Socket connected: ${socket.id} (User: ${socket.data.user?.name})`)

    // ?�용?�별 룸에 참�?
    const userId = socket.data.user?.id
    if (userId) {
      socket.join(`user_${userId}`)
      
      // 관리자??경우 관리자 룸에??참�?
      if (socket.data.user?.role === 'admin') {
        socket.join('admin_room')
        console.log(`?�� Admin joined: ${socket.data.user.name}`)
      }
    }

    // ?�무 체크 �?참�?
    socket.on('joinWorkRoom', (taskId: string) => {
      socket.join(`work_${taskId}`)
      console.log(`?�� User ${socket.data.user?.name} joined work room: ${taskId}`)
    })

    // ?�무 체크 �??��?�?
    socket.on('leaveWorkRoom', (taskId: string) => {
      socket.leave(`work_${taskId}`)
      console.log(`?�� User ${socket.data.user?.name} left work room: ${taskId}`)
    })

    // ?�시�??�무 ?�황 구독
    socket.on('subscribeWorkStatus', () => {
      socket.join('work_status_room')
      console.log(`?�� User ${socket.data.user?.name} subscribed to work status`)
    })

    // ?�시�??�무 ?�황 구독 ?�제
    socket.on('unsubscribeWorkStatus', () => {
      socket.leave('work_status_room')
      console.log(`?�� User ${socket.data.user?.name} unsubscribed from work status`)
    })

    // ?�결 ?�제
    socket.on('disconnect', () => {
      console.log(`?�� Socket disconnected: ${socket.id} (User: ${socket.data.user?.name})`)
    })
  })

  console.log('?? Socket.IO server initialized')
}

// Socket.IO ?�스?�스 ?�보?�기
export { io }

// ?�시�??�림 ?�송 ?�수??
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

// ?�체 ?�용?�에�??�림
export const broadcastNotification = (data: any) => {
  if (io) {
    io.emit('broadcastNotification', {
      timestamp: new Date(),
      ...data
    })
  }
} 
