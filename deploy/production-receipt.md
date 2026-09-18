# Production deployment receipt

- AWS account: `960243570517`
- Region for S3: `ap-northeast-2`
- Private bucket: `jamiblossom-web-960243570517`
- CloudFront distribution: `E1GZVFASVCCZI8`
- CloudFront domain: `dnyvo6ird4gvy.cloudfront.net`
- Origin access control: `EQE07ZQ2TZ3Z1`
- ACM certificate: `da972d07-4a4e-4364-9f1b-5331aa82e3a7` (`us-east-1`)
- Route 53 zone: `Z0803234Y8SYJLRHT8W2`
- DNS change: `C0196858PY2ISJPZEAAP`
- Domains: `jamiblossom.com`, `www.jamiblossom.com`

The previous apex alias is preserved in `route53-before.json`. Infrastructure inputs and the repeatable content deployment command are stored beside this receipt and in `scripts/deploy-web.ps1`.

CDN artifact verification on 2026-09-19 KST returned HTTP 200 for HTML, its referenced JavaScript, and `application/wasm`. The fetched WASM SHA-256 matched the local deployment bytes (`3005b2f9f5e2e5589202dee4920b6a5c6835201615ddfc8a26885ae9c44dd6b3`). Loading that CDN WASM in Node produced 12 palaces for solar `1990-1-1 12:00`, and normalized lunar `2024-2-30` to solar `2024-4-8`. Visual browser QA was unavailable in the current environment.
