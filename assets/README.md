# 그림 폴더 안내

- 이 폴더의 PNG 가 게임에 쓰이는 실제 그림입니다 (`data/assets.json` 의 overrides 로 연결).
- 모든 그림은 **논리 크기의 4배**입니다 (PX=4). 타일 한 칸 64×64, 동물 64×64, 보스 96×96, 주인공 96×128, 나무 64×96, 건물 160×144, 전투 배경 1280×960.
- 그림 묶음(zip)의 `high_resolution_4x` 폴더를 절반으로 줄여 만든 것입니다. 새 묶음을 받으면 zip 을 푼 폴더를 넣어 실행합니다 (Pillow 필요):

```bash
python3 tools/build_assets.py <푼 묶음 폴더>
```

  여러 묶음을 한 번에 넣어도 되고(순서는 상관없음), 같은 이름의 그림은 새 것으로 바뀝니다. `--reset` 을 붙이면 `assets/*.png` 를 지우고 다시 만듭니다.
  `high_resolution_4x` 가 없고 `template_x2` 만 있는 묶음은 도트를 두 배로 키워서 씁니다 (조금 덜 매끈함).
  모든 묶음을 먼저 읽고 임시 폴더에 다 변환한 다음에야 `assets/` 를 바꾸므로, 중간에 실패해도 그림이 지워지지 않습니다.
  이 명령이 `data/assets.json` (그림 목록)과 `data/anim.json` (프레임 크기, 주인공 머리·손·무기 좌표)을 갱신합니다.
  묶음 맨 위의 `animation_data*.json` 을 읽어 시트의 프레임 크기를 알아내고, 없거나 그림 크기와 맞지 않으면 같은 이름의 정지 그림 폭을 한 프레임으로 봅니다(경고 표시). 읽지 못하는 JSON 은 경고만 하고 건너뜁니다.
- `data/anim.json` 은 자동으로 만들어지니 직접 고치지 말고, 손으로 다듬는 값은 `data/anim_tweaks.json` 에 적습니다 (게임이 읽을 때 덮어씀):
  옆모습 무기 각도·손잡이 위치, 정면 그림이 왼쪽을 보는 캐릭터 목록(`facesLeft`), 옆모습을 끄는 머리 모양(`heroSideHairOff`).

## 애니메이션 시트 (`*_anim.png`)
- 동물·적·보스 정면 `x_anim`: 6프레임 = 서기A, 서기B, 움직이기A, 움직이기B, 공격, 아파함
- 옆모습 `x_side_anim` (오른쪽 보기, 왼쪽은 게임이 뒤집음): 14프레임 = 서기 2, 걷기 4, 공격 준비, 공격, 마무리, 맞음, 밀려남, 방어, 주저앉음, 기뻐함.
  지금은 시범으로 `rabbit`, `mushroom`, 주인공만 있습니다. 옆모습이 없는 캐릭터는 정면 그림을 좌우로 뒤집어 씁니다.
  정면 그림이 원래 왼쪽을 보고 있는 캐릭터(밀꾸, 사슴, 다람쥐, 여우 등)는 `data/anim_tweaks.json` 의 `facesLeft` 에 적어 두면 반대로 뒤집습니다.
- 주인공 `player_body_anim`·`player_clothes_anim` (정면 10프레임), `player_body_side_anim`·`player_clothes_side_anim` (옆모습 14프레임).
  머리카락(`hair_N`, `hair_N_side`)과 무기는 정지 그림을 `data/anim.json` 의 수치로 옮겨 붙이고 돌립니다.
- 밀꾸: `milkku`(꾀죄죄) / `milkku_clean`(깨끗) 정지·6프레임, `milkku_hide`(침대 밑 꼬리)
- `tiles_water_anim`, `tiles_ice_anim`: 물/얼음 타일 위에 덮여 반복 재생
- `fx_hit_anim`, `fx_heal_anim`, `fx_purify_anim`, `fx_star_anim`: 전투 효과 (한 번 재생)
- 시트가 없는 캐릭터는 정지 그림 한 장으로 표시됩니다.

## 아직 게임에서 쓰지 않는 그림 (준비만 됨)
- 스테이지 3~5: `tiles_swamp/fire/castle`, 새 동물·적·보스, `king`, `king_pure`, 무기 3종
- `item_*` 아이콘, `emote_*` 말풍선
- `reference_for_ai/` 는 그림을 만들 때 AI 에게 준 지시문과 위치 견본입니다.
