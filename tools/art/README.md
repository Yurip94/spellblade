# 그림 도구 (개발용)

Mod 는 이 파일들을 쓰지 않는다(실행 중에는 생성물 `hooks/lib/art3.ts` 만 쓴다).

**3차(지금)**
- `art3.py` — 마검사 44×48 · 장비 12단계 원본(재질 글자) · 미리보기 · `art3.ts` 생성. 몬스터 · 장면 재료를 모아 함께 내보낸다.
  - `python3 tools/art/art3.py ts plugins/spellblade/hooks/lib/art3.ts`
  - `python3 tools/art/art3.py preview docs` → `preview-v3.png`(README) · `preview-v3-hero.png` · `preview-v3-monsters.png` · `preview-v3-scene.png`
  - `python3 tools/art/art3.py check` → 단계 1 · idle 이 시안 7판과 점 하나까지 같은지
- `art3_monsters.py` — 몬스터 12종(서기 · 숨쉬기 · 공격 프레임)
- `art3_scene.py` — 효과 13종 · 글꼴(데미지 · 작은 · 큰) · 배경(낮 · 밤 160×64)
- `v3-mock/` — 3차 시안(버린 그림, 기록용)

**지난 판(기록용)**
- `art32.py` — 2차 32×32 그림 원본(2.x 의 `art.ts` 를 만들던 스크립트)
- `v2.py` — 2차 시안 비교 PNG
- `art.py` · `gen_ts.py` — 1차 20×16 그림

**기타**
- `ansi2png.py` — `tmux capture-pane -e` 결과를 PNG 로(터미널에서 실제로 보이는 모습 확인)
