# 그래픽 교체 안내

- 이 폴더의 PNG 가 **지금 게임에 쓰이는 진짜 그림**입니다 (`data/assets.json` 의 overrides 로 연결됨).
- 모든 그림은 **논리 크기의 2배**로 그립니다 (PX=2). 예: 타일 한 칸 32×32, 주인공 48×64, 동물 32×32, 보스 48×48, 나무 32×48, 건물 80×72.
- `template_sheet.png` : 전체 한눈에 보기. 어떤 그림을 바꾸고 싶으면 같은 파일명·같은 크기로 덮어쓰고 푸시하면 끝.

## 새 그림 넣는 법
1. 완성한 PNG를 이 `assets/` 폴더에 저장 (예: `assets/rabbit.png`). 투명 배경, 파일명은 템플릿과 같게.
2. `git add assets` → `git commit -m "그래픽"` → `git push`
3. 같은 파일명이면 바로 적용됩니다. 새 파일(새 동물 등)은 `data/assets.json` 의 `overrides` 에 한 줄 추가하면 됩니다.

```json
"overrides": {
  "rabbit": { "type": "image", "file": "assets/rabbit.png" },
  "tiles":  { "type": "spritesheet", "file": "assets/tiles.png", "frameWidth": 32, "frameHeight": 32 }
}
```

## 규칙
- 배경 투명 PNG. 캐릭터·동물·나무는 **발이 그림 맨 아래**에 닿게.
- `player_body`, `hair_0~2` 는 **흰색(밝음)·연회색(중간)·진회색(그림자) 3단계로만** 그리기. 게임이 피부색·머리색을 입힙니다. 외곽선은 검정 OK.
- `player_clothes` 는 옷·신발·눈·입·볼터치를 진짜 색으로.
- 동물·적은 1장만. 오염된 상태는 게임이 보라색을 덧입힙니다.
- `tiles.png` 는 32×32 칸을 가로로 12개 이어 붙인 1줄(384×32). 순서:
  `풀, 나무밑동(풀), 길, 물, 꽃, 오염풀, 오염나무밑동(오염풀), 바위밑동(풀), 돌바닥, 돌벽, 덤불밑동(풀), 마을흙`
- 크기를 바꾸고 싶으면 그려서 올리고 알려주세요. 코드에서 맞춥니다. 타일만 32×32 유지.

## 우선순위 (체감 큰 순서)
1. 주인공 5장 (`player_body`, `player_clothes`, `hair_0`, `hair_1`, `hair_2`)
2. 동물 5장 (`rabbit`, `squirrel`, `boar`, `deer`, `fox`) + 반디(`guide`)
3. 타일 `tiles`, 나무 `tree`, `tree_dark`, 덤불 `bush`, 바위 `rock`
4. 적 `mushroom`, `vine`, 보스 `bear`
5. 건물 7장, 가구 10장, 소품 5장
