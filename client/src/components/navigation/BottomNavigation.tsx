import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { 
  Home, 
  Upload, 
  Search, 
  CheckSquare, 
  Settings
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

const BottomNavigation: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()

  // 기본 네비게이션 아이템 (모든 사용자)
  const baseNavItems = [
    {
      id: 'dashboard',
      label: '대시보드',
      icon: Home,
      path: '/dashboard',
      requiresAuth: true
    },
    {
      id: 'search',
      label: '검색',
      icon: Search,
      path: '/excel/search',
      requiresAuth: true
    },
    {
      id: 'work',
      label: '업무',
      icon: CheckSquare,
      path: '/work/today',
      requiresAuth: true
    }
  ]

  // 관리자 전용 네비게이션 아이템
  const adminNavItems = [
    {
      id: 'upload',
      label: '업로드',
      icon: Upload,
      path: '/excel/upload',
      requiresAuth: true,
      requiresAdmin: true
    },
    {
      id: 'admin',
      label: '관리',
      icon: Settings,
      path: '/admin/pending',
      requiresAuth: true,
      requiresAdmin: true
    }
  ]

  // 사용자 역할에 따라 네비게이션 아이템 구성
  let navItems = [...baseNavItems]
  
  // 관리자인 경우 관리자 메뉴 추가
  if (user?.role === 'admin') {
    navItems = [...baseNavItems, ...adminNavItems]
  }

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  const handleNavClick = (path: string) => {
    navigate(path)
  }

  return (
    <nav className="bottom-nav safe-area-bottom">
      <div className="flex justify-around">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.path)
          
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.path)}
              className={`nav-item ${active ? 'active' : 'text-gray-500'}`}
              aria-label={item.label}
            >
              <Icon 
                className={`w-6 h-6 mb-1 ${active ? 'text-primary-600' : 'text-gray-400'}`} 
              />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export default BottomNavigation 