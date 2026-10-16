# 그림 도구 (개발용)

- `art.py` — 1차 20×16 그림 데이터와 미리보기 PNG
- `gen_ts.py` — 1차 그림을 `hooks/lib/art.ts` 로 옮기던 스크립트
- `v2.py` — 2차 32×32 시안(자동 음영 · 테두리). `python3 v2.py <폴더>` 로 비교 PNG

Mod 는 이 파일들을 쓰지 않는다(실행 중에는 `art.ts` 만 쓴다).
- `art32.py` — 2차 32×32 그림 원본(재질 글자) · 미리보기 · `art.ts` 생성. `python3 tools/art/art32.py preview <폴더>` / `python3 tools/art/art32.py ts plugins/spellblade/hooks/lib/art.ts`
- `ansi2png.py` — `tmux capture-pane -e` 결과를 PNG 로(터미널에서 실제로 보이는 모습 확인)
