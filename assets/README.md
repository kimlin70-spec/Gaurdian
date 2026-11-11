# 그림 폴더 안내

- 이 폴더의 PNG 가 게임에 쓰이는 실제 그림입니다 (`data/assets.json` 의 overrides 로 연결).
- 모든 그림은 **논리 크기의 4배**입니다 (PX=4). 타일 한 칸 64×64, 동물 64×64, 보스 96×96, 주인공 96×128, 나무 64×96, 건물 160×144, 전투 배경 1280×960.
- 그림 묶음(zip)의 `high_resolution_4x` 폴더를 절반으로 줄여 만든 것입니다. 새 묶음을 받으면:

```bash
python3 tools/build_assets.py <묶음>/high_resolution_4x <묶음>/animation_data.json .
```

  이 명령이 `assets/` 를 다시 만들고 `data/assets.json`, `data/heroanim.json` 을 갱신합니다 (Pillow 필요).

## 애니메이션 시트 (`*_anim.png`)
- 동물·적·보스: 6프레임 가로 한 줄 = 서기A, 서기B, 움직이기A, 움직이기B, 공격, 아파함
- 주인공 `player_body_anim`, `player_clothes_anim`: 10프레임 = 서기 2, 걷기 4, 공격 2, 아파함, 기뻐함. 머리카락과 무기는 정지 그림을 `data/heroanim.json` 의 수치로 옮겨 붙입니다.
- `tiles_water_anim`, `tiles_ice_anim`: 물/얼음 타일 위에 덮여 반복 재생
- `fx_hit_anim`, `fx_heal_anim`, `fx_purify_anim`, `fx_star_anim`: 전투 효과 (한 번 재생)
- 시트가 없는 캐릭터는 정지 그림 한 장으로 표시됩니다.

## 아직 게임에서 쓰지 않는 그림 (준비만 됨)
- 스테이지 3~5: `tiles_swamp/fire/castle`, 새 동물·적·보스, `king`, `king_pure`, 무기 3종
- `item_*` 아이콘, `emote_*` 말풍선
- `reference_for_ai/` 는 그림을 만들 때 AI 에게 준 지시문과 위치 견본입니다.
