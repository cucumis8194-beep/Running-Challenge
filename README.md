# 🏃 러닝 챌린지 앱

친구들이 각자 접속해서 달리기 기록을 입력하고, 실시간으로 순위와 진행 상황을 확인하는 웹앱입니다.

---

## 주요 기능

- **그룹별 방 만들기** — 방마다 목표 km와 벌칙을 다르게 설정
- **실시간 동기화** — 누군가 기록을 올리면 모두의 화면에 바로 반영
- **주간 리더보드** — 매주 월요일 자동 리셋, 이전 기록은 보존
- **공유 링크** — URL 하나로 어디서나 접속

---

## 배포 방법 (약 15분)

### 1단계: Supabase 설정 (무료 DB)

1. [supabase.com](https://supabase.com) 접속 → 무료 계정 생성
2. **New project** 클릭 → 프로젝트 이름, 비밀번호 입력
3. 프로젝트 생성 완료 후 **SQL Editor** 탭 클릭
4. `supabase-schema.sql` 파일 내용을 전체 복사 → 붙여넣기 → **Run** 실행
5. **Project Settings → API** 탭에서:
   - `Project URL` 복사 → `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL`에 붙여넣기
   - `anon public` 키 복사 → `NEXT_PUBLIC_SUPABASE_ANON_KEY`에 붙여넣기

### 2단계: GitHub에 코드 올리기

```bash
# 이 폴더에서 실행
git init
git add .
git commit -m "첫 배포"
# GitHub에서 새 repository 생성 후:
git remote add origin https://github.com/your-id/running-challenge.git
git push -u origin main
```

### 3단계: Vercel 배포 (무료 호스팅)

1. [vercel.com](https://vercel.com) 접속 → GitHub 계정으로 로그인
2. **Add New Project** → 방금 만든 GitHub repository 선택
3. **Environment Variables** 섹션에 두 가지 추가:
   - `NEXT_PUBLIC_SUPABASE_URL` = Supabase Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Supabase anon key
4. **Deploy** 클릭 → 1~2분 후 완료

배포가 끝나면 `https://your-app.vercel.app` 링크가 생깁니다.  
이 링크를 카카오톡으로 공유하면 끝!

---

## 사용법

### 방 만들기 (방장)
1. 링크 접속 → 닉네임 입력
2. **방 만들기** 탭 선택
3. 방 이름, 목표 거리(km), 벌칙 입력 → 방 만들기
4. 생성된 **방 코드(6자리)** 를 친구들에게 카톡으로 공유

### 참가하기 (친구들)
1. 동일 링크 접속 → 닉네임 입력
2. 받은 방 코드 입력 → 참가하기

### 기록 입력
- 달린 날짜 선택 → km 입력 → 추가 (또는 Enter)
- 같은 날에 여러 번 추가 가능 (누적됨)
- 잘못 입력했으면 내 기록에서 삭제 가능

---

## 규칙
- 매주 월요일 00:00 기준으로 새 주차 시작
- 일요일 자정까지 목표 km를 채우면 미션 성공
- 못 채우면 설정한 벌칙 적용

---

## 로컬 개발 (선택사항)

```bash
npm install
cp .env.local.example .env.local
# .env.local에 Supabase 키 입력 후:
npm run dev
# http://localhost:3000 접속
```
