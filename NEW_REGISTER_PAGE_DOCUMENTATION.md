# MetroWork 새로운 회원가입 페이지 문서

## 📋 개요

새로운 회원가입 페이지는 기존 회원가입 컴포넌트와 독립적으로 구현된 고급 회원가입 기능을 제공합니다.

### 🎯 주요 기능
- **5개 필드 입력 폼**: 이름, 생년월일, 이메일, 비밀번호, 비밀번호 확인
- **실시간 중복 체크**: 이름+생년월일 조합으로 실시간 중복 확인
- **비밀번호 찾기 통합**: 중복 시 비밀번호 찾기 기능 활성화
- **모바일 최적화**: 터치 친화적인 UI/UX
- **강력한 유효성 검사**: 실시간 폼 검증

---

## 🚀 접근 방법

### URL 경로
```
http://localhost:3000/register-new
```

### 기존 회원가입과의 차이점
- **기존**: `/register` - 기본 회원가입 페이지
- **새로운**: `/register-new` - 고급 기능이 포함된 회원가입 페이지

---

## 📝 입력 필드 상세

### 1. 이름 (Name)
- **필수**: ✅
- **길이**: 2-50자
- **문자**: 한글, 영문, 공백만 허용
- **정규식**: `/^[가-힣a-zA-Z\s]+$/`
- **실시간 검증**: ✅
- **중복 체크 대상**: ✅

### 2. 생년월일 (Birth Date)
- **필수**: ✅
- **형식**: YYYY-MM-DD
- **범위**: 1900년 이후 ~ 오늘 이전
- **실시간 검증**: ✅
- **중복 체크 대상**: ✅

### 3. 이메일 (Email)
- **필수**: ✅
- **형식**: 표준 이메일 형식
- **정규식**: `/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i`
- **실시간 검증**: ✅
- **중복 체크 대상**: ❌ (이름+생년월일만 체크)

### 4. 비밀번호 (Password)
- **필수**: ✅
- **길이**: 8-100자
- **요구사항**: 영문 대소문자, 숫자, 특수문자 포함
- **정규식**: `/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/`
- **표시/숨김**: ✅
- **실시간 검증**: ✅

### 5. 비밀번호 확인 (Confirm Password)
- **필수**: ✅
- **검증**: 비밀번호와 일치 여부 확인
- **표시/숨김**: ✅
- **실시간 검증**: ✅

---

## 🔍 실시간 중복 체크

### 동작 방식
1. **디바운싱**: 이름 또는 생년월일 변경 후 1초 대기
2. **최소 조건**: 이름 2자 이상, 생년월일 입력 완료
3. **API 호출**: `/api/auth/check-duplicate` 엔드포인트
4. **시각적 피드백**: 로딩 스피너, 성공/실패 아이콘

### 중복 확인 결과
```typescript
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
```

### 시각적 표시
- **중복되지 않은 경우**: ✅ 초록색 체크 아이콘 + "사용 가능한 정보입니다"
- **중복된 경우**: ❌ 빨간색 X 아이콘 + "이미 가입된 사용자입니다"

---

## 🔐 비밀번호 찾기 통합

### 활성화 조건
- 이름+생년월일 중복 확인 결과가 중복인 경우
- 중복된 사용자의 이메일 정보가 있는 경우

### 기능
- **자동 이메일 발송**: 중복된 사용자의 이메일로 재설정 링크 전송
- **API 호출**: `/api/auth/reset-password` 엔드포인트
- **사용자 안내**: 토스트 알림으로 진행 상황 알림

### 사용자 경험
1. 중복 확인 시 파란색 알림 박스 표시
2. "비밀번호 찾기" 버튼 클릭
3. 자동으로 이메일 발송
4. 성공/실패 메시지 표시

---

## 🎨 UI/UX 특징

### 모바일 최적화
- **터치 친화적**: 최소 44px 터치 영역
- **반응형 디자인**: 모든 화면 크기 지원
- **그라데이션 배경**: 시각적 매력도 향상
- **그림자 효과**: 카드 형태의 현대적 디자인

### 시각적 피드백
- **로딩 상태**: 스피너 애니메이션
- **성공/실패**: 색상 코딩된 아이콘
- **에러 메시지**: 빨간색 텍스트로 명확한 안내
- **토스트 알림**: 상단 중앙에 알림 표시

### 접근성
- **ARIA 라벨**: 스크린 리더 지원
- **키보드 네비게이션**: Tab 키로 모든 요소 접근 가능
- **포커스 표시**: 명확한 포커스 링 표시
- **색상 대비**: WCAG 가이드라인 준수

---

## 🔧 기술적 구현

### 사용된 라이브러리
```json
{
  "react-hook-form": "^7.0.0",
  "react-router-dom": "^6.0.0",
  "lucide-react": "^0.263.0",
  "react-hot-toast": "^2.4.0"
}
```

### 상태 관리
```typescript
// 로컬 상태
const [isLoading, setIsLoading] = useState(false)
const [showPassword, setShowPassword] = useState(false)
const [showConfirmPassword, setShowConfirmPassword] = useState(false)
const [duplicateResult, setDuplicateResult] = useState<DuplicateCheckResult | null>(null)
const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false)
const [lastCheckTime, setLastCheckTime] = useState<number>(0)
```

### 폼 검증
```typescript
// React Hook Form 설정
const {
  register,
  handleSubmit,
  watch,
  formState: { errors, isValid },
  setValue,
  trigger
} = useForm<RegisterFormData>({
  mode: 'onChange', // 실시간 검증
  defaultValues: {
    name: '',
    birthDate: '',
    email: '',
    password: '',
    confirmPassword: ''
  }
})
```

---

## 📱 사용 시나리오

### 시나리오 1: 새로운 사용자 회원가입
1. **이름 입력**: "홍길동" 입력
2. **생년월일 입력**: "1990-01-15" 선택
3. **중복 확인**: 1초 후 자동으로 중복 확인 실행
4. **결과 확인**: ✅ "사용 가능한 정보입니다" 표시
5. **이메일 입력**: "hong@example.com" 입력
6. **비밀번호 입력**: "MyPassword123!" 입력
7. **비밀번호 확인**: "MyPassword123!" 재입력
8. **회원가입**: "회원가입" 버튼 클릭
9. **완료**: 성공 메시지 후 로그인 페이지로 이동

### 시나리오 2: 중복 사용자 처리
1. **이름 입력**: "홍길동" 입력
2. **생년월일 입력**: "1990-01-15" 선택
3. **중복 확인**: 1초 후 자동으로 중복 확인 실행
4. **결과 확인**: ❌ "이미 가입된 사용자입니다" 표시
5. **비밀번호 찾기**: 파란색 알림 박스에 "비밀번호 찾기" 버튼 표시
6. **이메일 발송**: 버튼 클릭 시 자동으로 이메일 발송
7. **안내 메시지**: "비밀번호 재설정 이메일이 발송되었습니다" 토스트 표시

### 시나리오 3: 유효성 검사 오류
1. **잘못된 이름**: "홍" 입력 (1자)
2. **에러 표시**: "이름은 2자 이상이어야 합니다" 메시지 표시
3. **잘못된 이메일**: "invalid-email" 입력
4. **에러 표시**: "유효한 이메일 주소를 입력해주세요" 메시지 표시
5. **약한 비밀번호**: "123" 입력
6. **에러 표시**: "비밀번호는 영문 대소문자, 숫자, 특수문자를 포함해야 합니다" 메시지 표시

---

## 🔒 보안 고려사항

### 클라이언트 사이드
- **입력 검증**: 실시간 유효성 검사
- **비밀번호 표시**: 사용자 선택에 따른 표시/숨김
- **XSS 방지**: React의 기본 XSS 방지 기능 활용

### 서버 사이드
- **API 검증**: 모든 입력에 대한 서버 사이드 검증
- **중복 확인**: 이름+생년월일 조합으로 안전한 중복 확인
- **비밀번호 해싱**: bcrypt를 통한 안전한 비밀번호 저장

### 데이터 전송
- **HTTPS**: 프로덕션 환경에서 HTTPS 필수
- **토큰 관리**: JWT 토큰의 안전한 관리
- **세션 관리**: 안전한 세션 처리

---

## 🚨 에러 처리

### 네트워크 오류
- **API 호출 실패**: 사용자 친화적인 에러 메시지
- **타임아웃**: 적절한 타임아웃 설정
- **재시도**: 일시적 오류에 대한 재시도 로직

### 유효성 검사 오류
- **실시간 피드백**: 입력 중 실시간 에러 표시
- **명확한 메시지**: 구체적이고 이해하기 쉬운 에러 메시지
- **시각적 표시**: 색상과 아이콘으로 에러 상태 표시

### 사용자 경험
- **로딩 상태**: 모든 비동기 작업에 로딩 표시
- **성공 피드백**: 작업 완료 시 명확한 성공 메시지
- **안내 메시지**: 다음 단계에 대한 명확한 안내

---

## 🔄 향후 개선 계획

### 기능 확장
- **이메일 인증**: 회원가입 후 이메일 인증 추가
- **SMS 인증**: 휴대폰 번호 인증 추가
- **소셜 로그인**: Google, Facebook 등 소셜 로그인 연동

### UI/UX 개선
- **애니메이션**: 부드러운 전환 애니메이션 추가
- **다크 모드**: 다크 테마 지원
- **다국어 지원**: 다국어 인터페이스 지원

### 성능 최적화
- **코드 스플리팅**: 페이지별 코드 분할
- **캐싱**: API 응답 캐싱
- **지연 로딩**: 필요시에만 컴포넌트 로딩

---

## 📞 지원

### 개발 관련 문의
- **이슈 리포트**: GitHub Issues
- **기술 문서**: 개발자 문서
- **코드 리뷰**: Pull Request

### 사용자 지원
- **사용법 안내**: 이 문서 참조
- **문제 해결**: FAQ 섹션 확인
- **문의**: support@metrowork.com

---

## 📋 체크리스트

### 개발 완료 항목
- [x] 5개 필드 입력 폼 구현
- [x] 실시간 중복 체크 기능
- [x] 비밀번호 찾기 통합
- [x] 모바일 최적화 UI
- [x] 강력한 유효성 검사
- [x] 에러 처리 및 피드백
- [x] 접근성 고려사항
- [x] 보안 고려사항

### 테스트 필요 항목
- [ ] 다양한 브라우저 호환성
- [ ] 모바일 디바이스 테스트
- [ ] 네트워크 오류 상황 테스트
- [ ] 성능 테스트
- [ ] 보안 테스트

### 배포 준비 항목
- [ ] 환경변수 설정
- [ ] API 엔드포인트 연결
- [ ] SSL 인증서 설정
- [ ] 모니터링 설정
- [ ] 백업 전략 수립 