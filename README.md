# MetroWork - 모바일 전용 웹앱

React + TypeScript + Node.js + Express + MySQL을 사용한 모바일 최적화 웹앱입니다.

## 🚀 주요 기능

- **모바일 최적화**: 반응형 디자인과 터치 친화적 UI
- **PWA 지원**: Progressive Web App 기능 포함
- **회원 관리**: 관리자/일반회원 구분 및 승인 시스템
- **엑셀 데이터 관리**: 파일 업로드, 검색, 데이터 처리
- **업무 체크리스트**: 작업 관리 및 진행 상황 추적
- **보안**: JWT 인증, 비밀번호 암호화, 권한 관리

## 🛠 기술 스택

### Frontend
- **React 18** - 사용자 인터페이스
- **TypeScript** - 타입 안전성
- **Vite** - 빌드 도구
- **Tailwind CSS** - 스타일링
- **React Router** - 라우팅
- **React Query** - 서버 상태 관리
- **React Hook Form** - 폼 관리
- **Framer Motion** - 애니메이션

### Backend
- **Node.js** - 런타임 환경
- **Express.js** - 웹 프레임워크
- **MySQL** - 데이터베이스
- **JWT** - 인증
- **bcryptjs** - 비밀번호 암호화
- **Multer** - 파일 업로드
- **XLSX** - 엑셀 파일 처리

## 📱 모바일 최적화 특징

- **터치 친화적 UI**: 최소 44px 터치 타겟
- **반응형 디자인**: 모바일 우선 디자인
- **PWA 기능**: 오프라인 지원, 앱 설치 가능
- **성능 최적화**: 이미지 최적화, 코드 스플리팅
- **접근성**: 키보드 네비게이션, 스크린 리더 지원

## 🚀 빠른 시작

### 1. 저장소 클론
```bash
git clone <repository-url>
cd metrowork
```

### 2. 의존성 설치
```bash
# 모든 패키지 설치
npm run install:all

# 또는 개별 설치
npm install
cd client && npm install
cd ../server && npm install
```

### 3. 환경 변수 설정

#### 서버 환경 변수
```bash
cd server
cp env.example .env
```

`.env` 파일을 편집하여 데이터베이스 정보를 설정하세요:
```env
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:3000

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=metrowork_db

JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d
```

### 4. 데이터베이스 설정
1. MySQL 서버를 시작하세요
2. `metrowork_db` 데이터베이스를 생성하세요:
```sql
CREATE DATABASE metrowork_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 5. 개발 서버 실행
```bash
# 프론트엔드와 백엔드 동시 실행
npm run dev

# 또는 개별 실행
npm run dev:client  # 프론트엔드 (포트 3000)
npm run dev:server  # 백엔드 (포트 5000)
```

### 6. 브라우저에서 확인
- 프론트엔드: http://localhost:3000
- 백엔드 API: http://localhost:5000/api

## 📁 프로젝트 구조

```
metrowork/
├── client/                 # React 프론트엔드
│   ├── src/
│   │   ├── components/     # 재사용 가능한 컴포넌트
│   │   ├── pages/         # 페이지 컴포넌트
│   │   ├── hooks/         # 커스텀 훅
│   │   ├── api/           # API 호출 함수
│   │   ├── types/         # TypeScript 타입 정의
│   │   ├── utils/         # 유틸리티 함수
│   │   └── styles/        # 스타일 파일
│   ├── public/            # 정적 파일
│   └── package.json
├── server/                # Node.js 백엔드
│   ├── src/
│   │   ├── controllers/   # 컨트롤러
│   │   ├── middleware/    # 미들웨어
│   │   ├── models/        # 데이터 모델
│   │   ├── routes/        # 라우트 정의
│   │   ├── utils/         # 유틸리티 함수
│   │   ├── types/         # TypeScript 타입 정의
│   │   └── config/        # 설정 파일
│   ├── uploads/           # 업로드된 파일
│   └── package.json
└── package.json           # 루트 package.json
```

## 🔧 주요 스크립트

### 루트 디렉토리
```bash
npm run dev              # 개발 서버 실행 (프론트엔드 + 백엔드)
npm run build            # 프로덕션 빌드
npm run install:all      # 모든 의존성 설치
```

### 클라이언트
```bash
npm run dev              # 개발 서버 실행
npm run build            # 프로덕션 빌드
npm run preview          # 빌드 미리보기
npm run lint             # 코드 린팅
```

### 서버
```bash
npm run dev              # 개발 서버 실행
npm run build            # TypeScript 컴파일
npm run start            # 프로덕션 서버 실행
npm run lint             # 코드 린팅
```

## 📊 데이터베이스 스키마

### Users 테이블
- 사용자 정보 및 권한 관리
- 승인 상태 관리 (pending, approved, rejected)

### Excel Files 테이블
- 업로드된 엑셀 파일 정보
- 파일 메타데이터 및 태그

### Excel Data 테이블
- 엑셀 파일의 실제 데이터
- JSON 형태로 저장

### Checklists 테이블
- 체크리스트 기본 정보
- 할당 및 진행 상황 관리

### Checklist Items 테이블
- 체크리스트 항목
- 완료 상태 및 순서 관리

## 🔐 인증 및 권한

### 사용자 역할
- **Admin**: 모든 기능 접근 가능, 사용자 승인 관리
- **User**: 기본 기능 접근, 승인된 사용자만

### 승인 프로세스
1. 사용자 회원가입 (pending 상태)
2. 관리자 승인/거부
3. 승인된 사용자만 로그인 가능

## 📱 PWA 기능

- **오프라인 지원**: 서비스 워커를 통한 캐싱
- **앱 설치**: 홈 화면에 추가 가능
- **푸시 알림**: 업데이트 알림
- **반응형**: 모든 디바이스에서 최적화

## 🚀 배포

### 프로덕션 빌드
```bash
npm run build
```

### 환경 변수 설정
프로덕션 환경에서 필요한 환경 변수를 설정하세요:
- `NODE_ENV=production`
- 데이터베이스 연결 정보
- JWT 시크릿 키
- 파일 업로드 경로

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 📞 지원

문제가 있거나 질문이 있으시면 이슈를 생성해주세요. 