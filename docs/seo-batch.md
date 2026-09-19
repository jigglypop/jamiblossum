# Search Console SEO batch

`pnpm seo:analyze`는 Search Console의 확정 데이터만 읽어 최근 28일과 직전 28일을 비교한다. 날짜는 Search Console 기준인 미국 태평양 시간으로 계산하며 최근 3일은 제외한다. 페이지 합계와 `query/page/country/device` 상세 행을 따로 조회하고 25,000행씩 페이지를 넘긴다. 익명 검색어와 상위 행 제한 때문에 상세 행의 합은 페이지 합계와 다를 수 있다.

## 인증

다음 중 하나가 필요하다.

- `GSC_ACCESS_TOKEN`: `webmasters.readonly` 범위의 단기 OAuth 토큰
- `GSC_SERVICE_ACCOUNT_JSON`: 서비스 계정 JSON 원문
- `GOOGLE_APPLICATION_CREDENTIALS`: 서비스 계정 JSON 파일 경로

서비스 계정 이메일에는 Search Console의 `sc-domain:jamiblossom.com` 읽기 권한을 별도로 부여한다. 저장소에는 키를 넣지 않는다. GitHub Actions에서는 `GSC_SERVICE_ACCOUNT_JSON` 저장소 secret을 사용한다. secret과 Search Console 권한이 없으면 작업은 `missing-credentials`로 실패하며 0회 노출로 처리하지 않는다.

## 실행과 안전 조건

```powershell
pnpm seo:analyze
node scripts/seo-batch.mjs --apply --deploy
```

일반 실행은 비공개 보고서만 `artifacts/seo-private/`에 쓴다. 원문 검색어는 콘솔 로그에 출력하지 않는다. `--input` 자료로는 운영 배포가 금지된다.

자동 적용은 허용된 세 URL의 `<title>`, description, Open Graph와 Twitter 제목·설명만 바꾼다. 현재·직전 기간 모두 페이지 노출 300 이상, 동일 query/page/country/device 행 노출 100 이상, 평균 순위 변화 1 이내, 현재 순위 12 이내, CTR 하락 0.5%p 이상 및 20% 이상을 모두 충족해야 한다. 미수집 행은 0으로 간주하지 않는다. 한 번에 한 페이지만 적용하고 성공 후 28일 동안 다시 적용하지 않는다.

배포는 운영 HTML을 기준으로 `</head>` 뒤의 바이트가 같은지 확인한다. S3 ETag 조건부 쓰기로 동시 배포를 거부하고 원본 HTML과 `version.json`을 백업한다. 대상 HTML과 manifest를 함께 갱신하지 못하면 새 HTML을 조건부 원복한다. 검색어가 포함된 보고서는 실행 머신의 `artifacts/seo-private/`에만 만들며 공개 저장소의 Actions artifact에는 올리지 않는다. 콘솔에는 상태, 파일 경로, 적용 페이지와 미리 정의된 변형 ID만 기록한다.

워크플로는 저장소 변수 `SEO_AUTOMATION_ENABLED`가 정확히 `true`일 때만 실행된다. GitHub OIDC 역할, Search Console secret과 속성 권한을 모두 준비하고 연결 검증을 마친 뒤 이 변수를 설정한다. 현재처럼 변수가 없으면 예약·수동 실행 모두 job 단계에서 건너뛴다.
