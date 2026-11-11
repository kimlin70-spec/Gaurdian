#!/usr/bin/env python3
"""그림 묶음(zip 을 푼 폴더)을 게임용 그림으로 변환한다.

사용 (저장소 맨 위 폴더에서):
  python3 tools/build_assets.py <묶음 폴더> [<묶음 폴더> ...]           새 그림 추가 / 같은 이름은 덮어쓰기
  python3 tools/build_assets.py --reset <묶음 폴더> [<묶음 폴더> ...]   assets/*.png 를 지우고 다시 만들기

각 묶음 폴더에는 high_resolution_4x/ 폴더가 있어야 한다 (논리 크기의 8배 원본).
그것을 절반으로 줄여 assets/ 에 저장하고 (게임은 논리 크기의 4배 밀도, PX=4),
data/assets.json 의 overrides 와 data/anim.json 을 갱신한다.

data/anim.json
  sheets    : 애니메이션 시트의 한 프레임 크기 (assets 픽셀)
  hero      : 주인공 정면 10프레임. 머리 이동량, 손 위치, 무기 각도 (48x64 템플릿 픽셀)
  heroSide  : 주인공 옆모습 14프레임. 같은 단위
  unitSide  : 동물/적 옆모습 14프레임의 동작 번호
  hit       : 공격 프레임에서 타격이 닿는 지점 (템플릿 픽셀, 오른쪽 보기 기준)
묶음에 들어 있는 JSON 은 animation_data*.json 형식 세 가지(본편, 옆모습, 단일 캐릭터)를 읽는다.
"""
import sys, os, json, glob
from PIL import Image

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(REPO, 'assets')
ANIM = os.path.join(REPO, 'data', 'anim.json')
ASSETS_JSON = os.path.join(REPO, 'data', 'assets.json')

# 화면 전체를 덮는 배경은 묶음에 이미 4배 밀도(1280x960)로 들어 있어 줄이지 않는다
KEEP_SIZE_PREFIX = ('bg_', 'cut_', 'mg_bg_')

# 동작 이름 → 프레임 번호 (0부터)
HERO_FRONT_POSES = {'attack_ready': 6, 'attack': 7, 'attack_end': 7, 'hurt': 8, 'knockback': 8, 'guard': 0, 'down': 8, 'happy': 9}
HERO_FRONT_ANGLE = [0, 0, 0, 0, 0, 0, -35, 70, -10, 0]
SIDE_POSES = {'attack_ready': 6, 'attack': 7, 'attack_end': 8, 'hurt': 9, 'knockback': 10, 'guard': 11, 'down': 12, 'happy': 13}


def load_json(path, default):
    try:
        with open(path, encoding='utf-8-sig') as f:
            return json.load(f)
    except FileNotFoundError:
        return default


def convert(src_png):
    name = os.path.basename(src_png)
    im = Image.open(src_png).convert('RGBA')
    if name.startswith(KEEP_SIZE_PREFIX):
        res = im.convert('RGB')
    else:
        w, h = im.size
        # 알파를 곱한 상태로 2x2 평균 → 가장자리가 부드럽고 색 번짐이 없다
        res = im.convert('RGBa').resize((w // 2, h // 2), Image.BOX).convert('RGBA')
    res.save(os.path.join(OUT, name), optimize=True)
    return name[:-4]


def ingest_meta(pack, anim):
    """묶음의 JSON 들에서 프레임 크기와 주인공 좌표를 읽어 anim 에 합친다."""
    sheets = anim.setdefault('sheets', {})
    for jpath in glob.glob(os.path.join(pack, '*.json')):
        meta = load_json(jpath, {})
        if not isinstance(meta, dict):
            continue
        # 1) 본편 묶음: sheets{ "x_anim.png": {frame_width,...} }, player{...}
        if isinstance(meta.get('sheets'), dict):
            for fname, sh in meta['sheets'].items():
                if 'frame_width' in sh:
                    sheets[fname[:-4]] = [sh['frame_width'] * 2, sh['frame_height'] * 2]
            p = meta.get('player')
            if isinstance(p, dict) and 'hair_offset_xy_by_frame' in p:
                anim['hero'] = {
                    'frame': p['frame_size'],
                    'hairOffset': p['hair_offset_xy_by_frame'],
                    'hand': p['right_hand_xy_by_frame'],
                    'angle': HERO_FRONT_ANGLE,
                    'grip': {k[:-4]: v for k, v in p['weapon_grip_xy'].items()},
                    'seq': {'idle': [0, 1], 'walk': [2, 3, 4, 5]},
                    'poses': HERO_FRONT_POSES,
                }
        # 2) 옆모습 묶음: characters{ rabbit{sheet, frame_size, attack_hit_point}, player{frames[...]} }
        if isinstance(meta.get('characters'), dict):
            base = meta.get('frame_index_base', 1)
            seqs = {k: [i - base for i in v] for k, v in meta.get('sequences', {}).items()}
            anim['unitSide'] = {'seq': {'idle': seqs.get('idle', [0, 1]), 'move': seqs.get('walk', [2, 3, 4, 5])}, 'poses': SIDE_POSES}
            hit = anim.setdefault('hit', {})
            for key, ch in meta['characters'].items():
                fw, fh = ch['frame_size']
                if 'sheet' in ch:
                    sheets[os.path.basename(ch['sheet'])[:-4]] = [fw * 2, fh * 2]
                if 'attack_hit_point' in ch:
                    hit[key] = ch['attack_hit_point']
                if key == 'player':
                    for s in (ch.get('body_sheet'), ch.get('clothes_sheet')):
                        if s:
                            sheets[os.path.basename(s)[:-4]] = [fw * 2, fh * 2]
                    frames = sorted(ch['frames'], key=lambda f: f['frame'])
                    grips = {k[:-4]: v for k, v in ch.get('weapon_grips', {}).items()}
                    front_grips = anim.get('hero', {}).get('grip', {})
                    anim['heroSide'] = {
                        'frame': ch['frame_size'],
                        'hairOffset': [f['head_offset'] for f in frames],
                        'hand': [f['weapon_hand'] for f in frames],
                        'angle': [f['weapon_angle_deg'] for f in frames],
                        'grip': {**front_grips, **grips},
                        'seq': {'idle': seqs.get('idle', [0, 1]), 'walk': seqs.get('walk', [2, 3, 4, 5])},
                        'poses': SIDE_POSES,
                    }
        # 3) 캐릭터 한 마리 묶음: frame_size, frame_count, states
        if 'frame_size' in meta and 'states' in meta and 'frame_count' in meta:
            fw, fh = meta['frame_size']
            for f in glob.glob(os.path.join(pack, 'high_resolution_4x', '*_anim.png')):
                w, h = Image.open(f).size
                if w == fw * 4 * meta['frame_count'] and h == fh * 4:
                    sheets[os.path.basename(f)[:-4]] = [fw * 2, fh * 2]


def frame_size_guess(key):
    """JSON 에 없는 시트: 같은 이름의 정지 그림 폭을 한 프레임으로 본다 (x_side_anim → x.png)."""
    base = key[:-5]
    for cand in (base, base[:-5] if base.endswith('_side') else None):
        if cand and os.path.exists(os.path.join(OUT, cand + '.png')):
            w, _ = Image.open(os.path.join(OUT, cand + '.png')).size
            _, h = Image.open(os.path.join(OUT, key + '.png')).size
            return [w, h]
    _, h = Image.open(os.path.join(OUT, key + '.png')).size
    return [h, h]


def main(argv):
    reset = '--reset' in argv
    packs = [a for a in argv if a != '--reset']
    if not packs:
        print(__doc__)
        return 1
    for p in packs:
        if not os.path.isdir(os.path.join(p, 'high_resolution_4x')):
            print('high_resolution_4x 폴더가 없습니다:', p)
            return 1
    if reset:
        for f in glob.glob(os.path.join(OUT, '*.png')):
            os.remove(f)
    anim = {} if reset else load_json(ANIM, {})
    anim['_comment'] = '그림 묶음에서 자동으로 만든 파일 (tools/build_assets.py). 직접 고치지 마세요.'
    count = 0
    for p in packs:
        ingest_meta(p, anim)
        for f in sorted(glob.glob(os.path.join(p, 'high_resolution_4x', '*.png'))):
            convert(f)
            count += 1
    # overrides: assets/ 에 있는 모든 그림
    ov = {}
    sheets = anim.setdefault('sheets', {})
    for f in sorted(glob.glob(os.path.join(OUT, '*.png'))):
        key = os.path.basename(f)[:-4]
        if key.startswith('tiles') and not key.endswith('_anim'):
            ov[key] = {'type': 'spritesheet', 'file': f'assets/{key}.png', 'frameWidth': 64, 'frameHeight': 64}
        elif key.endswith('_anim'):
            fw, fh = sheets.get(key) or frame_size_guess(key)
            sheets[key] = [fw, fh]
            ov[key] = {'type': 'spritesheet', 'file': f'assets/{key}.png', 'frameWidth': fw, 'frameHeight': fh}
        else:
            ov[key] = {'type': 'image', 'file': f'assets/{key}.png'}
    with open(ANIM, 'w', encoding='utf-8') as fp:
        json.dump(anim, fp, ensure_ascii=False, indent=1)
    data = load_json(ASSETS_JSON, {})
    data['_comment'] = ('진짜 그림 목록 (tools/build_assets.py 가 만듦). 모든 그림은 논리 크기의 4배(PX=4)입니다 '
                        '(타일 64x64, 동물 64x64, 주인공 96x128, 전투 배경 1280x960). '
                        '여기 적힌 키는 코드가 임시 도트를 만들지 않고 파일을 읽습니다.')
    data.pop('_example', None)
    data['overrides'] = ov
    with open(ASSETS_JSON, 'w', encoding='utf-8') as fp:
        json.dump(data, fp, ensure_ascii=False, indent=1)
    print(f'{count} converted, {len(ov)} in assets/, {len(sheets)} sheets')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
