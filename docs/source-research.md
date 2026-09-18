# Source research and backend boundary

The seed corpus contains selected rendered Chinese Wikisource witnesses for six public-domain works: `淵海子平`, `三命通會`, `滴天髓`, `五行大義`, `窮通寶鑑`, and `紫微斗數全書`. Each raw record stores the download date, source URL, asserted historical author/editor, language, rights note, SHA-256 of the fetched HTML, SHA-256 of normalized text, and normalized text. The fetched HTML itself is not retained. Exact downloaded page titles appear in `coverage.selectedPageTitles`.

These are uncollated partial witnesses, not critical editions. Retrieval chunks are marked `source-text-candidate`; maintenance and navigation blocks are filtered, but editorial matter may remain. Textual fidelity also does not establish scientific predictive accuracy.

The Duan Jianye branch is deliberately metadata-only:

- `盲派命理`, 段建業, 時輪造化有限公司, 2005, ISBN 9789810548766 ([publisher/bookshop catalog](https://www.chinyuan.com.tw/all_book/more?id=1228)).
- `段氏理象學：盲派命理研究`, 段建業, 中國商業出版社, 2011, ISBN 9787504474575, 244 pages ([Xinhua Bookstore catalog](https://item.xhsd.com/items/1010000103122040)).

No copyrighted Duan full text is stored. The backend requires `lineage=duan-jianye` and returns `insufficient_sources` until licensed text is installed; generic Saju passages cannot silently stand in for Duan's 體用, 賓主, or 做功 method.

Run `node scripts/research-ingest.mjs` to refresh the public corpus and `node --test tests/backend-research.test.mjs` for provenance, retrieval, bounded-input, and lineage-gate checks.

## Provider and cost boundary

The adapter uses the Responses API with `gpt-5.6-luna`, one request, a 45-second timeout, and at most 900 output tokens. OpenAI's current model catalog lists Luna at USD 0.20 per million input tokens and USD 1.20 per million output tokens: <https://developers.openai.com/api/docs/models>. The backend records actual provider token usage without logging birth data or the question. Before real traffic, measure representative Korean/Chinese requests; character counts are only a guard and cannot prove token cost.

There is currently no Jami Blossom OpenAI secret. The IAM-only Lambda returns a dry-run prompt compilation and citations. Paid generation is code-locked even if a key appears. It never exposes the ignored `server/prompt-templates.ts` file. In-memory cache and in-flight coalescing are single-Lambda-process optimizations; durable cross-instance idempotency, owner cache, and spend quotas require DynamoDB and tests before removing the lock.
