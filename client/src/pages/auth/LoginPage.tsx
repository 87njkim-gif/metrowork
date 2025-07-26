import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Eye, EyeOff, User, Lock, ArrowRight } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { toast } from 'react-hot-toast'
import LoadingSpinner from '../../components/common/LoadingSpinner'

interface LoginFormData {
  name: string
  password: string
}

const LoginPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginFormData>()

  const onSubmit = async (data: LoginFormData) => {
    console.log('=== onSubmit 함수 호출됨 ===')
    console.log('폼 데이터:', data)
    try {
      setIsLoading(true)
      console.log('로그인 시도:', data)
      
      // 모바일 환경에서 네트워크 상태 확인
      if (!navigator.onLine) {
        toast.error('인터넷 연결을 확인해주세요.')
        return
      }
      
      await login(data.name, data.password)
      console.log('로그인 성공, 대시보드로 이동')
      toast.success('로그인되었습니다!')
      navigate('/dashboard')
    } catch (error: any) {
      console.error('로그인 실패:', error)
      
      // 구체적인 에러 메시지 처리
      let errorMessage = '로그인에 실패했습니다.'
      
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        errorMessage = '서버 응답이 지연되고 있습니다. 다시 시도해주세요.'
      } else if (error.message?.includes('Network Error') || error.message?.includes('aborted')) {
        errorMessage = '네트워크 연결을 확인해주세요.'
      } else if (error.response?.status === 401) {
        errorMessage = '아이디 또는 비밀번호가 올바르지 않습니다.'
      } else if (error.response?.status === 403) {
        errorMessage = '승인 대기 중인 계정입니다. 관리자에게 문의하세요.'
      } else if (error.response?.status >= 500) {
        errorMessage = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
      } else if (error.message) {
        errorMessage = error.message
      }
      
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-content">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">MetroWork</h1>
          <p className="text-gray-600">엑셀 데이터 기반 업무 관리 시스템</p>
        </div>

        {/* 로그인 폼 */}
        <div className="card-lg">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 text-center">
            로그인
          </h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* 이름 입력 */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                이름
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  {...register('name', {
                    required: '이름을 입력해주세요.'
                  })}
                  type="text"
                  id="name"
                  className="input-field pl-10"
                  placeholder="이름을 입력하세요"
                  disabled={isLoading}
                />
              </div>
              {errors.name && (
                <p className="mt-1 text-sm text-error-600">{errors.name.message}</p>
              )}
            </div>

            {/* 비밀번호 입력 */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                비밀번호
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  {...register('password', {
                    required: '비밀번호를 입력해주세요.',
                    minLength: {
                      value: 6,
                      message: '비밀번호는 최소 6자 이상이어야 합니다.'
                    }
                  })}
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  className="input-field pl-10 pr-10"
                  placeholder="비밀번호를 입력하세요"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-error-600">{errors.password.message}</p>
              )}
            </div>

            {/* 로그인 버튼 */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center"
            >
              {isLoading ? (
                <LoadingSpinner size="sm" color="white" />
              ) : (
                <>
                  로그인
                  <ArrowRight className="ml-2 w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* 회원가입 링크 */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              계정이 없으신가요?{' '}
              <Link
                to="/register"
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                회원가입
              </Link>
            </p>
          </div>
        </div>

        {/* 추가 정보 */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            로그인함으로써{' '}
            <Link to="/terms" className="text-primary-600 hover:text-primary-700">
              이용약관
            </Link>
            과{' '}
            <Link to="/privacy" className="text-primary-600 hover:text-primary-700">
              개인정보처리방침
            </Link>
            에 동의합니다.
          </p>
        </div>
      </div>
    </div>
  )
}

export default LoginPage 