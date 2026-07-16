# Finish_Future Career AI

학생의 진로와 AI·반도체 가치사슬을 연결하는 교육용 웹앱입니다. 기존 Gemini 브라우저 호출을
서버 측 OpenAI Responses API 호출로 교체했으며, 보호자 동의가 확인되기 전에는 앱과 AI 기능을
사용할 수 없습니다.

## 로컬 실행

1. `npm install`
2. `npm run dev`

AI 호출은 `/.netlify/functions/openai`를 사용하므로 전체 기능 확인에는 Netlify 개발 환경이나
배포 환경이 필요합니다. API 키를 클라이언트 `.env` 또는 Vite 변수에 넣지 마세요.

## Netlify 배포 설정

Netlify 사이트의 **Environment variables**에 다음 값을 설정한 뒤 재배포합니다.

- `OPENAI_API_KEY`: 필수, 서버 전용 비밀값
- `OPENAI_MODEL`: 선택, 기본값 `gpt-5.6-luna`

보호자 동의 증거는 브라우저 `sessionStorage`에 최대 12시간 유지되며, 각 AI 요청마다 서버가
정책 버전, 동의 시각, 세션 ID를 다시 검증합니다. 동의를 철회하면 즉시 앱이 잠깁니다.

## 개인정보 최소화

학생 이름, 주민등록번호, 연락처, 학교·학급, 주소, 건강·상담 기록, 성적 등 민감하거나 개인을
식별할 수 있는 정보는 입력하지 않습니다. 선택 과목, 희망 진로, 작성한 생각과 AI 대화는
OpenAI API로 전송·처리되며 학습 진행 기록은 현재 브라우저의 로컬 저장소에도 보관됩니다.

## 참고문헌

OpenAI. (n.d.-a). *Best practices for API key safety*. OpenAI Help Center. Retrieved July 16, 2026, from https://help.openai.com/en/articles/5112595-best-practices-for-api

OpenAI. (n.d.-b). *Data controls in the OpenAI platform*. OpenAI API. Retrieved July 16, 2026, from https://platform.openai.com/docs/models/default-usage-policies-by-endpoint
