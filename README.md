# 자미두수 명반 - jamiblossom

![자미두수](web/public/image.jpg)

자미두수(紫微斗數) 명반을 정확하게 뽑아주는 웹 애플리케이션과 Python CLI 도구입니다.

**배포 URL**: [https://d1b19gqheurni9.cloudfront.net](https://d1b19gqheurni9.cloudfront.net)

---

## 주요 기능

### 명반 (12궁 배치)
- 4x4 그리드에 전통적인 자미두수 12궁 배치 (인묘진사오미신유술해자축)
- **주성** (자미, 천기, 태양, 무곡 등) -- 묘왕득리평불함 표시
- **보성/살성** (문창, 문곡, 좌보, 우필, 경양, 타라 등) -- 길성(cyan)/살성(rose)/도화(pink)/보조(emerald) 색상 구분
- **잡성** (천관, 천복, 삼태, 팔좌 등) -- 타입별 색상 구분
- **12신** -- 장생12, 박사12, 장전12, 태세12 각 궁에 표시
- **궁별 색상** -- 명궁, 질액궁, 천이궁, 재백궁, 관록궁 등 12궁 각각 고유 색상

### 사화 (四化)
- **록(禄)/권(權)/과(科)** = 초록색, **기(忌)** = 빨간색으로 명확하게 구분
- 비성사화 테이블 -- 12궁 각각의 사화가 어느 궁에 날아가는지 한눈에 확인

### 삼방사정
- 선택한 궁의 삼합궁(삼), 대궁(대)을 색상 하이라이트로 표시
- 사이드바에서 삼합/대궁 정보 확인

### 만세력 사주 (절기 기반)
- lunar-javascript 라이브러리 기반 정확한 절기 사주 계산
- 년주/월주/일주/시주 네기둥 표시
- 천간/지지별 오행 색상 (목=초록, 화=빨강, 토=노랑, 금=흰색, 수=파랑)

### 운한 (대한/유년/유월/유일/유시)
- 운한 날짜/시간을 입력하면 각 운한의 간지, 궁위, 사화를 표시

### 내보내기
- **텍스트 복사** -- 전체 명반 정보를 텍스트로 클립보드에 복사
- **PNG 이미지 저장** -- 명반 그리드를 고해상도 PNG로 저장
- **PDF 저장** -- A4 가로 PDF로 저장

---

## 기술 스택

### Web (React SPA)
| 항목 | 기술 |
|------|------|
| 프레임워크 | React 19 |
| 언어 | TypeScript 5.9 |
| 번들러 | Vite 7 |
| CSS | Tailwind CSS 4 |
| 명반 계산 | iztro (Web Worker) |
| 음력/사주 | lunar-javascript |
| 폰트 | Pretendard |
| 이미지 변환 | html-to-image, jsPDF |

### Python CLI
| 항목 | 기술 |
|------|------|
| 명반 계산 | iztro-py |
| 실행 | `python -m src.main` |

### 배포
| 항목 | 기술 |
|------|------|
| 호스팅 | AWS S3 (정적 사이트) |
| CDN | AWS CloudFront |
| 리전 | ap-northeast-2 (서울) |

---

## 프로젝트 구조

```
jamiblossom/
├── README.md
├── .gitignore
├── src/                    # Python CLI
│   ├── __init__.py
│   ├── main.py             # CLI 엔트리포인트
│   ├── ziwei.py            # iztro-py 기반 명반 생성
│   ├── render.py           # 차트 렌더링 (텍스트/JSON)
│   └── time.py             # 시간 파싱 및 시간 인덱스 변환
└── web/                    # React 웹 앱
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    ├── public/
    │   ├── image.jpg           # 서예 로고
    │   ├── favicon.png         # 파비콘 (192x192)
    │   ├── apple-touch-icon.png# iOS 아이콘 (180x180)
    │   └── og-image.jpg        # 소셜 미디어 썸네일 (1200x630)
    └── src/
        ├── main.tsx            # React 엔트리포인트
        ├── App.tsx             # 메인 UI 컴포넌트
        ├── App.css
        ├── index.css           # Tailwind + Pretendard 설정
        ├── vite-env.d.ts       # 타입 선언
        └── worker/
            └── py.worker.ts    # Web Worker (iztro 계산 + 사주)
```

---

## 실행 방법

### Web 개발 서버

```bash
cd web
npm install
npm run dev
```

`http://localhost:5173` 에서 확인 가능.

### Web 빌드

```bash
cd web
npm run build
npm run preview
```

### Python CLI

```bash
pip install iztro-py
python -m src.main --date 2000-8-16 --time 13:05 --gender 남
```

옵션:
- `--calendar solar|lunar` : 양력/음력 (기본: solar)
- `--date YYYY-M-D` : 생년월일
- `--time HH:MM` : 태어난 시각
- `--time-index 0~12` : 시간 인덱스 직접 지정
- `--gender male|female|남|여` : 성별
- `--language ko-KR|zh-CN|zh-TW|en-US|ja-JP` : 언어
- `--leap-month` : 음력 윤달
- `--json output.json` : JSON 파일로 결과 저장

### 배포 (AWS S3 + CloudFront)

```bash
cd web
npm run build
aws s3 sync dist/ s3://ziwei-chart-app/ --delete
aws cloudfront create-invalidation --distribution-id E2AUZ67NG6BOMV --paths "/*"
```

---

## 다국어 지원

iztro 라이브러리 기반으로 아래 언어를 지원합니다:
- 한국어 (ko-KR) -- 기본
- 简体中文 (zh-CN)
- 繁體中文 (zh-TW)
- English (en-US)
- 日本語 (ja-JP)

---

## 라이선스

MIT
