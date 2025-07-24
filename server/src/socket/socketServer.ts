import { Server as SocketIOServer } from 'socket.io'
import { Server as HTTPServer } from 'http'
import jwt from 'jsonwebtoken'

let io: SocketIOServer

// Socket.IO ?œë²„ ì´ˆê¸°??
export const initializeSocketServer = (httpServer: HTTPServer): void => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true
    }
  })

  // ?¸ì¦ ë¯¸ë“¤?¨ì–´
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

  // ?°ê²° ?´ë²¤??
  io.on('connection', (socket) => {
    console.log(`?”Œ Socket connected: ${socket.id} (User: ${socket.data.user?.name})`)

    // ?¬ìš©?ë³„ ë£¸ì— ì°¸ê?
    const userId = socket.data.user?.id
    if (userId) {
      socket.join(`user_${userId}`)
      
      // ê´€ë¦¬ìž??ê²½ìš° ê´€ë¦¬ìž ë£¸ì—??ì°¸ê?
      if (socket.data.user?.role === 'admin') {
        socket.join('admin_room')
        console.log(`?‘‘ Admin joined: ${socket.data.user.name}`)
      }
    }

    // ?…ë¬´ ì²´í¬ ë£?ì°¸ê?
    socket.on('joinWorkRoom', (taskId: string) => {
      socket.join(`work_${taskId}`)
      console.log(`?“‹ User ${socket.data.user?.name} joined work room: ${taskId}`)
    })

    // ?…ë¬´ ì²´í¬ ë£??˜ê?ê¸?
    socket.on('leaveWorkRoom', (taskId: string) => {
      socket.leave(`work_${taskId}`)
      console.log(`?“‹ User ${socket.data.user?.name} left work room: ${taskId}`)
    })

    // ?¤ì‹œê°??…ë¬´ ?„í™© êµ¬ë…
    socket.on('subscribeWorkStatus', () => {
      socket.join('work_status_room')
      console.log(`?“Š User ${socket.data.user?.name} subscribed to work status`)
    })

    // ?¤ì‹œê°??…ë¬´ ?„í™© êµ¬ë… ?´ì œ
    socket.on('unsubscribeWorkStatus', () => {
      socket.leave('work_status_room')
      console.log(`?“Š User ${socket.data.user?.name} unsubscribed from work status`)
    })

    // ?°ê²° ?´ì œ
    socket.on('disconnect', () => {
      console.log(`?”Œ Socket disconnected: ${socket.id} (User: ${socket.data.user?.name})`)
    })
  })

  console.log('?? Socket.IO server initialized')
}

// Socket.IO ?¸ìŠ¤?´ìŠ¤ ?´ë³´?´ê¸°
export { io }

// ?¤ì‹œê°??Œë¦¼ ?„ì†¡ ?¨ìˆ˜??
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

// ?„ì²´ ?¬ìš©?ì—ê²??Œë¦¼
export const broadcastNotification = (data: any) => {
  if (io) {
    io.emit('broadcastNotification', {
      timestamp: new Date(),
      ...data
    })
  }
} 
