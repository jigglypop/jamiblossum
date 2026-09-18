# Chart font subsets

The chart uses two subsets of Google Fonts' `NotoSansKR[wght].ttf`, generated on 2026-09-19 with fontTools.

- `NotoSansKR-Ganji.woff2`: the 10 heavenly stems and 12 earthly branches used at display size.
- `NotoSansKR-Chart.woff2`: deterministic Han characters used by the pillar, twelve-stage, NaYin, void, and palace fields. Its source character list is `chart-hanja.txt`.

```text
python -m fontTools.subset NotoSansKR[wght].ttf --text-file=chart-hanja.txt --flavor=woff2 --output-file=NotoSansKR-Chart.woff2 --layout-features=*
```

Both subsets are covered by the SIL Open Font License 1.1 in `NotoSansKR-OFL.txt`. Pretendard remains the primary UI font; these subsets provide matching sans-serif Han glyphs when Pretendard has no glyph.
