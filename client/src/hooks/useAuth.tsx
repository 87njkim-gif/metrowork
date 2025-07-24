import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import apiService from '../services/api';

interface AuthContextType {
  user: any;
  setUser: (user: any) => void;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (name: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setLoading(true);
        
        // localStorage에서 토큰 확인
        const token = localStorage.getItem('token');
        if (token) {
          // API 서비스에 토큰 설정
          apiService.setAuthToken(token);
          
          // 현재 사용자 정보 가져오기
          const res = await apiService.getCurrentUser();
          setUser(res.data.user);
        } else {
          setUser(null);
        }
      } catch (e) {
        setUser(null);
        // 토큰이 유효하지 않으면 localStorage에서 제거
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const login = async (name: string, password: string) => {
    console.log('=== useAuth login 함수 시작 ===')
    console.log('입력받은 데이터:', { name, password })
    setLoading(true);
    try {
      console.log('API 서비스 로그인 호출 시작')
      const res = await apiService.login({ name, password });
      console.log('API 응답 받음:', res)
      
      // API 서비스에 토큰 설정 (먼저 설정)
      apiService.setAuthToken(res.data.token);
      
      // 토큰과 사용자 정보를 localStorage에 저장
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('refreshToken', res.data.refreshToken);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      
      setUser(res.data.user);
      console.log('로그인 완료, 사용자 설정됨:', res.data.user)
      console.log('토큰 설정 완료:', res.data.token.substring(0, 20) + '...')
    } catch (error) {
      console.error('useAuth login 함수에서 오류 발생:', error)
      throw error;
    } finally {
      setLoading(false);
      console.log('=== useAuth login 함수 종료 ===')
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    apiService.removeAuthToken();
    apiService.logout();
  };

  const value = { 
    user, 
    setUser, 
    isLoading: loading, 
    isAuthenticated: !!user,
    login, 
    logout 
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}; 