import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Eye, EyeOff, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import apiService from '../../services/api'
import axios from 'axios'

interface RegisterFormData {
  name: string
  birthDate: string
  email: string
  password: string
  confirmPassword: string
}

interface DuplicateCheckResult {
  isDuplicate: boolean
  message: string
  data?: {
    duplicateInfo?: {
      name: string
      email: string
      status: string
    }
    suggestion: string
    helpText?: string
  }
}

const NewRegisterPage: React.FC = () => {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [duplicateResult, setDuplicateResult] = useState<DuplicateCheckResult | null>(null)
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false)
  const [lastCheckTime, setLastCheckTime] = useState<number>(0)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
    setValue,
    trigger
  } = useForm<RegisterFormData>({
    mode: 'onChange',
    defaultValues: {
      name: '',
      birthDate: '',
      email: '',
      password: '',
      confirmPassword: ''
    }
  })

  const watchedName = watch('name')
  const watchedBirthDate = watch('birthDate')
  const watchedEmail = watch('email')

  // 실시간 중복 체크 (디바운싱)
  useEffect(() => {
    const checkDuplicate = async () => {
      if (!watchedName || !watchedBirthDate || watchedName.length < 2) {
        setDuplicateResult(null)
        return
      }

      // 디바운싱: 1초 후에 실행
      const timeoutId = setTimeout(async () => {
        setIsCheckingDuplicate(true)
        try {
          // 중복확인은 직접 axios로 호출
          const response = await axios.post('/api/duplicate/check-duplicate', {
            name: watchedName,
            birthDate: watchedBirthDate
          })
          
          setDuplicateResult(response.data)
          setLastCheckTime(Date.now())
        } catch (error: any) {
          console.error('중복 확인 오류:', error)
          if (error.response?.status === 400) {
            setDuplicateResult(null)
          }
        } finally {
          setIsCheckingDuplicate(false)
        }
      }, 1000)

      return () => clearTimeout(timeoutId)
    }

    checkDuplicate()
  }, [watchedName, watchedBirthDate])

  // 비밀번호 재설정 요청
  const handlePasswordReset = async () => {
    if (!duplicateResult?.data?.duplicateInfo?.email) {
      toast.error('이메일 정보를 찾을 수 없습니다.')
      return
    }

    setIsLoading(true)
    try {
      // 비밀번호 재설정도 직접 axios로 호출
      const response = await axios.post('/api/auth/reset-password', {
        name: watchedName,
        birthDate: watchedBirthDate,
        email: duplicateResult.data.duplicateInfo.email
      })

      if (response.data.success) {
        toast.success('비밀번호 재설정 이메일이 발송되었습니다.')
        toast.success('이메일을 확인하여 비밀번호를 재설정해주세요.')
      }
    } catch (error: any) {
      console.error('비밀번호 재설정 오류:', error)
      const message = error.response?.data?.message || '비밀번호 재설정에 실패했습니다.'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  // 회원가입 제출
  const onSubmit = async (data: RegisterFormData) => {
    if (duplicateResult?.isDuplicate) {
      toast.error('이미 가입된 사용자입니다. 비밀번호 찾기를 이용해주세요.')
      return
    }

    setIsLoading(true)
    try {
      // 회원가입은 apiService의 register 메서드 사용
      const response = await apiService.register({
        name: data.name,
        email: data.email,
        password: data.password,
        confirmPassword: data.confirmPassword
        // phone, department, position 등 필요시 추가
      })

      if (response.success) {
        toast.success('회원가입이 완료되었습니다!')
        toast.success('관리자 승인 후 로그인이 가능합니다.')
        navigate('/login')
      }
    } catch (error: any) {
      console.error('회원가입 오류:', error)
      const message = error.response?.data?.message || '회원가입에 실패했습니다.'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const isDuplicate = duplicateResult?.isDuplicate
  const canShowPasswordReset = isDuplicate && duplicateResult?.data?.duplicateInfo?.email

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">회원가입</h1>
          <p className="text-gray-600">MetroWork에 오신 것을 환영합니다</p>
        </div>

        {/* 회원가입 폼 */}
        <div className="bg-white rounded-2xl shadow-xl p-6 space-y-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* 이름 입력 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                이름 *
              </label>
              <div className="relative">
                <input
                  type="text"
                  {...register('name', {
                    required: '이름을 입력해주세요.',
                    minLength: { value: 2, message: '이름은 2자 이상이어야 합니다.' },
                    maxLength: { value: 50, message: '이름은 50자 이하여야 합니다.' },
                    pattern: {
                      value: /^[가-힣a-zA-Z\s]+$/,
                      message: '이름은 한글, 영문, 공백만 입력 가능합니다.'
                    }
                  })}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                    errors.name ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="홍길동"
                />
                {isCheckingDuplicate && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                  </div>
                )}
                {duplicateResult && !isCheckingDuplicate && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    {isDuplicate ? (
                      <XCircle className="w-5 h-5 text-red-500" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                  </div>
                )}
              </div>
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            {/* 생년월일 입력 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                생년월일 *
              </label>
              <input
                type="date"
                {...register('birthDate', {
                  required: '생년월일을 입력해주세요.',
                  validate: (value) => {
                    const date = new Date(value)
                    const today = new Date()
                    const minDate = new Date('1900-01-01')
                    
                    if (isNaN(date.getTime())) {
                      return '유효하지 않은 날짜입니다.'
                    }
                    
                    if (date > today) {
                      return '생년월일은 오늘 날짜보다 이전이어야 합니다.'
                    }
                    
                    if (date < minDate) {
                      return '생년월일은 1900년 이후여야 합니다.'
                    }
                    
                    return true
                  }
                })}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                  errors.birthDate ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {errors.birthDate && (
                <p className="mt-1 text-sm text-red-600">{errors.birthDate.message}</p>
              )}
            </div>

            {/* 이메일 입력 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                이메일 *
              </label>
              <input
                type="email"
                {...register('email', {
                  required: '이메일을 입력해주세요.',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: '유효한 이메일 주소를 입력해주세요.'
                  }
                })}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                  errors.email ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="example@email.com"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            {/* 비밀번호 입력 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                비밀번호 *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  {...register('password', {
                    required: '비밀번호를 입력해주세요.',
                    minLength: { value: 8, message: '비밀번호는 8자 이상이어야 합니다.' },
                    maxLength: { value: 100, message: '비밀번호는 100자 이하여야 합니다.' },
                    pattern: {
                      value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
                      message: '비밀번호는 영문 대소문자, 숫자, 특수문자를 포함해야 합니다.'
                    }
                  })}
                  className={`w-full px-4 py-3 pr-12 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                    errors.password ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            {/* 비밀번호 확인 입력 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                비밀번호 확인 *
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  {...register('confirmPassword', {
                    required: '비밀번호를 다시 입력해주세요.',
                    validate: (value) => {
                      const password = watch('password')
                      return value === password || '비밀번호가 일치하지 않습니다.'
                    }
                  })}
                  className={`w-full px-4 py-3 pr-12 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                    errors.confirmPassword ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
              )}
            </div>

            {/* 중복 확인 결과 */}
            {duplicateResult && (
              <div className={`p-4 rounded-lg border ${
                isDuplicate 
                  ? 'bg-red-50 border-red-200' 
                  : 'bg-green-50 border-green-200'
              }`}>
                <div className="flex items-start space-x-3">
                  {isDuplicate ? (
                    <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${
                      isDuplicate ? 'text-red-800' : 'text-green-800'
                    }`}>
                      {duplicateResult.message}
                    </p>
                    {duplicateResult.data?.suggestion && (
                      <p className={`text-sm mt-1 ${
                        isDuplicate ? 'text-red-700' : 'text-green-700'
                      }`}>
                        {duplicateResult.data.suggestion}
                      </p>
                    )}
                    {duplicateResult.data?.helpText && (
                      <p className="text-sm text-red-600 mt-1">
                        {duplicateResult.data.helpText}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 비밀번호 찾기 버튼 (중복 시에만 표시) */}
            {canShowPasswordReset && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-800">
                      이미 가입된 계정입니다
                    </p>
                    <p className="text-sm text-blue-600 mt-1">
                      비밀번호를 잊으셨나요?
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    disabled={isLoading}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoading ? (
                      <div className="flex items-center space-x-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>처리 중...</span>
                      </div>
                    ) : (
                      '비밀번호 찾기'
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* 회원가입 버튼 */}
            <button
              type="submit"
              disabled={!isValid || isDuplicate || isLoading}
              className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <div className="flex items-center justify-center space-x-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>처리 중...</span>
                </div>
              ) : (
                '회원가입'
              )}
            </button>
          </form>

          {/* 로그인 링크 */}
          <div className="text-center pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              이미 계정이 있으신가요?{' '}
              <Link
                to="/login"
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                로그인하기
              </Link>
            </p>
          </div>
        </div>

        {/* 추가 정보 */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            회원가입 시{' '}
            <Link to="/terms" className="text-blue-600 hover:underline">
              이용약관
            </Link>
            {' '}및{' '}
            <Link to="/privacy" className="text-blue-600 hover:underline">
              개인정보처리방침
            </Link>
            에 동의하는 것으로 간주됩니다.
          </p>
        </div>
      </div>
    </div>
  )
}

export default NewRegisterPage 