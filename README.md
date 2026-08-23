# 네이버-챗GPT 연동 사이트

챗GPT(Custom GPT Actions)가 네이버 검색, 네이버 URL 콘텐츠, 구글 트렌드를 조회할 수 있게 해주는 중간 API 서버입니다. Vercel Serverless Functions로 동작합니다.

## 엔드포인트

- `GET /api/search?query=검색어&type=blog` — 네이버 카테고리 검색 (blog, news, shop, kin, book, encyc, cafearticle, local, webkr, image, doc, movie)
- `GET /api/content?url=...` — 네이버 URL(주로 블로그) 본문 텍스트 확인
- `GET /api/trends?keyword=검색어&geo=KR` — 구글 트렌드 관심도 추이 (무료 비공식 방식)

## 환경변수

Vercel 프로젝트 설정 > Environment Variables에 아래 값을 등록해야 합니다.

- `NAVER_CLIENT_ID`
- `NAVER_CLIENT_SECRET`

(네이버 개발자센터/NCP 콘솔에서 발급받은 Client ID / Client Secret)

## 챗GPT Custom GPT에 연결하기

1. ChatGPT에서 새 GPT 만들기 > Configure > Actions > "Create new action"
2. `public/openapi.yaml` 내용을 붙여넣고 `servers.url`을 실제 배포 주소로 교체
3. 인증(Authentication)은 "None"으로 두면 됩니다 (API 키는 서버 환경변수에만 저장되어 있음)

## 로컬 개발

```
npm install
npm i -g vercel
vercel dev
```
