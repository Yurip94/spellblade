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

**4차 — Elthen 그림 묶음**(그림은 저장소 밖)
- `import_elthen.py` — Elthen's Pixel Art Shop(elthen.itch.io) 자유가격 팩 41개를 묶음 JSON 하나로. 팩은 `~/Documents/spellblade-packs/elthen/<슬러그>/` 에 받아 둔다(받는 팩 목록은 볼트 「마검사 키우기 4차 설계」 7장). 수정해도 재배포 금지라 그림 · 묶음 · 확인 그림은 저장소에 넣지 않는다 — 이 스크립트에는 어느 팩 · 줄 · 칸인지만 있다.
  - `python3 tools/art/import_elthen.py check ~/Documents/spellblade-packs/elthen` → `ok 41`
  - `python3 tools/art/import_elthen.py build ~/Documents/spellblade-packs/elthen ~/Documents/spellblade-packs/spellblade-pack.json` → Mod 가 켤 때 읽는 묶음
  - `python3 tools/art/import_elthen.py preview <폴더> <저장소 밖 확인.png>` → 스프라이트마다 동작별 가운데 한 장
  - `python3 tools/art/import_elthen.py sheet <시트.png> <칸 폭> <칸 높이> <확인.png>` → 칸 줄을 그은 시트(줄 정할 때)

**지난 판(기록용)**
- `art32.py` — 2차 32×32 그림 원본(2.x 의 `art.ts` 를 만들던 스크립트)
- `v2.py` — 2차 시안 비교 PNG
- `art.py` · `gen_ts.py` — 1차 20×16 그림

**기타**
- `ansi2png.py` — `tmux capture-pane -e` 결과를 PNG 로(터미널에서 실제로 보이는 모습 확인)
