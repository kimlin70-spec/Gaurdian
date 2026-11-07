# 숲의 수호자 — 아이패드용 도트 턴제 RPG

Grace 와 함께 만드는 게임. 빌드 도구 없이 `index.html` 하나로 돌아갑니다.
(Phaser 3.87.0, 내부 해상도 320×240, 100% 터치 조작, 한글 도트 폰트 Galmuri)

## 바로 해보기

### 1) PC 에서 로컬 서버 띄우기 (파일을 더블클릭하면 안 돼요 — ES module 때문에 서버가 필요)

```bash
cd Gaurdian
python3 -m http.server 8000
```

또는 Node 가 있으면:

```bash
npx serve . -l 8000
```

PC 브라우저에서 `http://localhost:8000` 을 열면 됩니다.

### 2) 아이패드에서 접속

1. PC 와 아이패드를 같은 Wi-Fi 에 연결
2. PC 의 IP 확인 (Mac: `ipconfig getifaddr en0`, Windows: `ipconfig` 의 IPv4 주소)
3. 아이패드 Safari 에서 `http://<PC IP>:8000` 열기
4. 가로로 돌리고, 공유 버튼 → **홈 화면에 추가** 를 하면 전체 화면으로 즐길 수 있어요.

### 3) GitHub Pages 로 배포

1. 저장소 **Settings → Pages → Build and deployment → Source** 를 **GitHub Actions** 로 변경 (한 번만)
2. `main` 브랜치에 푸시하면 `.github/workflows/pages.yml` 이 자동으로 배포
3. 주소: `https://<깃허브아이디>.github.io/Gaurdian/`

## 조작법 (전부 터치)

| 어디서 | 어떻게 |
|---|---|
| 마을 | 건물을 탭 → 그레이스가 걸어가서 들어감. 반디(여우)를 탭하면 힌트 |
| 숲(탐험) | 가고 싶은 칸을 탭 → 길을 찾아 이동. 상자/NPC/곰을 탭하면 다가가서 상호작용. 적에게 닿으면 전투 |
| 전투 | 공격 / 스킬 / 아이템 / 방어 / **정화**. 적 HP 가 팔찌 기준(처음 25%) 아래로 내려가면 정화 버튼이 분홍색으로 빛남 |
| 동물 | 공격 + 스킬 2개 + 방어 + **자동**. 상태창의 동물 이름을 탭해도 자동을 켜고 끌 수 있음 (이름 옆 `A`) |

- 정화한 **동물** → 구조되어 친구가 됨 (반짝 가방에 들어감, 3마리까지 함께 모험)
- 정화한 **식물** → 맑아져서 사라짐
- 정화한 **보스** → 숲이 회복되고 스테이지 클리어
- 지면 게임오버 없이 여관에서 깨어남 (페널티 없음)
- 자동 저장: 마을 도착, 맵 이동, 전투 후, 여관 (1슬롯, localStorage)

## 폴더 구조

```
index.html            진입점 (iPad Safari 메타 태그, 세로모드 안내)
src/
  main.js             Phaser 설정, 폰트 로딩, 씬 등록
  config.js           해상도·색·타일 범례 등 상수
  scenes/             Boot → Title → CharacterCreate → StoryIntro → Village ⇄ Field ⇄ Battle → Purify
  systems/
    Data.js           JSON 데이터 접근 + {hero} 같은 이름 치환
    GameState.js      진행 상태, 능력치 계산, 경험치/레벨, 구조/파티
    Save.js           localStorage 저장/불러오기
    Assets.js         임시 도트 그래픽 생성 (나중에 PNG 로 교체)
    UI.js             터치 버튼, 패널, 대화 상자, 확인창, 게이지
    Audio.js          웹오디오 효과음/배경음 (첫 탭에서 언락)
data/                 게임 내용 전부 (코드 수정 없이 추가/수정 가능)
assets/               진짜 도트 PNG 를 넣을 곳
vendor/               phaser.min.js (3.87.0 고정), Galmuri 폰트 (OFL)
```

## 데이터만 고쳐서 바꾸기

| 파일 | 내용 |
|---|---|
| `data/strings.json` | 게임 제목, 주인공/안내 동물/세계/마왕/가방 **이름**. 임시 이름을 여기서만 바꾸면 전체 반영 |
| `data/dialogues.json` | 인트로·엔딩·NPC·보스 대사. `{hero}` `{guide}` `{world}` `{king}` `{cage}` `{gem}` 자리표시자 사용 가능 |
| `data/player.json` | 그레이스 능력치, 시작 장비/아이템/별가루 |
| `data/animals.json` | 구조 동물 (이름, 역할, 능력치, 성장, 스킬 2개) |
| `data/enemies.json` | 적 (`kind`: plant / animal / boss, 스킬 가중치, 보상, 드롭) |
| `data/skills.json` | 스킬 (type: damage / damage_all / heal / heal_all, 레벨 1~3 수치) |
| `data/items.json` | 아이템 (heal / mp / revive / heal_all, 상점 판매 여부) |
| `data/equipment.json` | 무기·옷·팔찌 (팔찌의 `purify` = 정화 가능 HP 비율) |
| `data/stages.json` | 스테이지와 맵. `rows` 는 글자 지도 (`.`풀 `T`나무 `=`길 `~`물 `*`꽃 `d`오염 풀 `D`오염 나무 `r`바위 `s`돌바닥 `#`돌벽 `b`덤불), `objects` 는 상자/NPC/출구/보스, `enemies` 는 1~3마리 그룹 |
| `data/assets.json` | PNG 교체 목록. `overrides` 에 적은 키는 코드가 임시 도트를 만들지 않고 파일을 읽음 |

### 새 스테이지 추가 예
`data/stages.json` 의 `stage2` 에서 `"locked": true` 를 지우고 `start`, `boss`, `maps` 를 `stage1` 처럼 채우면 숲 입구 목록에서 바로 갈 수 있습니다.
`"final": true` 인 스테이지를 클리어하면 엔딩 컷신이 나옵니다.

### 진짜 도트 그래픽으로 교체
규격: 타일 16×16 (가로로 이어 붙인 스프라이트시트, 번호는 `src/config.js` 의 TILE_LEGEND 순서), 캐릭터 16×24, 동물/적 16×16, 보스 24×24.
`data/assets.json` 예:
```json
"overrides": {
  "tiles":  { "type": "spritesheet", "file": "assets/tiles.png", "frameWidth": 16, "frameHeight": 16 },
  "rabbit": { "type": "image", "file": "assets/rabbit.png" }
}
```
주인공은 `player_body`(피부, 흰색으로 그리면 tint 로 색 입힘), `player_clothes`, `hair_0`~`hair_2`(흰색) 세 겹입니다.

## 로드맵 진행 상황

- [x] Phase 1 뼈대: 씬 전환, 해상도·터치, 타이틀, 캐릭터 만들기, 마을, 저장/불러오기
- [x] Phase 2 Field: 타일맵, 탭 이동(BFS), 적 배회·접촉, 상자, NPC, 맵 전환
- [x] Phase 3 Battle: 턴제 전투, JSON 스킬, 정화·구조, 자동 전투, 승패 처리
- [x] Phase 4 스테이지 1(맵 3개 + 보스방) + 보스 + 정화 연출 + 마을 시설 전부
- [~] Phase 5: 인트로/엔딩 컷신, 효과음·BGM(간단한 칩튠) 완료. **도트 그래픽 PNG 교체는 아직** (임시 도트 사용 중)
- [ ] 스테이지 2~5 (데이터만 추가하면 됨)

## 라이선스
- Phaser: MIT (`vendor/PHASER-LICENSE.md`)
- Galmuri 폰트: SIL Open Font License 1.1 (`vendor/fonts/LICENSE.md`)
