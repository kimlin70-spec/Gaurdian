#!/usr/bin/env python3
"""그림 묶음(zip 을 푼 폴더)을 게임용 그림으로 변환한다.

사용 (저장소 맨 위 폴더에서):
  python3 tools/build_assets.py <묶음 폴더> [<묶음 폴더> ...]           새 그림 추가 / 같은 이름은 덮어쓰기
  python3 tools/build_assets.py --reset <묶음 폴더> [<묶음 폴더> ...]   assets/*.png 를 지우고 다시 만들기

각 묶음 폴더에는 그림 폴더가 하나 있어야 한다.
  high_resolution_4x/  논리 크기의 8배 원본 → 절반으로 줄인다 (가장 좋음)
  template_x2/         논리 크기의 2배 그림 → 픽셀을 두 배로 키운다 (high_resolution_4x 가 없을 때)
게임은 논리 크기의 4배 밀도(PX=4)로 그린다. 화면 전체 배경(bg_, cut_, mg_bg_)은 1280x960 으로 맞춘다.
결과는 assets/ 와 data/assets.json 의 overrides, data/anim.json 에 쓴다.
모든 묶음을 먼저 읽고 임시 폴더에 다 변환한 뒤에야 assets/ 를 바꾸므로, 중간에 실패하면 아무것도 바뀌지 않는다.

data/anim.json (자동으로 만듦. 손질 값은 data/anim_tweaks.json 에)
  sheets    : 애니메이션 시트의 한 프레임 크기 (assets 픽셀)
  hero      : 주인공 정면 10프레임. 머리 이동량, 손 위치, 무기 각도 (48x64 템플릿 픽셀)
  heroSide  : 주인공 옆모습 14프레임. 같은 단위
  unitSide  : 동물/적 옆모습 14프레임의 동작 번호
  hit       : 공격 프레임에서 타격이 닿는 지점 (템플릿 픽셀, 오른쪽 보기 기준)
묶음 맨 위의 animation_data*.json 을 읽는다 (본편, 옆모습, 캐릭터 한 마리 형식). 읽지 못하는 JSON 은 경고만 하고 건너뛴다.
"""
import sys, os, json, glob, shutil, tempfile
from PIL import Image

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(REPO, 'assets')
ANIM = os.path.join(REPO, 'data', 'anim.json')
ASSETS_JSON = os.path.join(REPO, 'data', 'assets.json')

# 화면 전체를 덮는 그림: 1280x960 (320x240 의 4배)
KEEP_SIZE_PREFIX = ('bg_', 'cut_', 'mg_bg_')
SCREEN = (1280, 960)

# 동작 이름 → 프레임 번호 (0부터)
HERO_FRONT_POSES = {'attack_ready': 6, 'attack': 7, 'attack_end': 7, 'hurt': 8, 'knockback': 8, 'guard': 0, 'down': 8, 'happy': 9}
HERO_FRONT_ANGLE = [0, 0, 0, 0, 0, 0, -35, 70, -10, 0]
SIDE_POSES = {'attack_ready': 6, 'attack': 7, 'attack_end': 8, 'hurt': 9, 'knockback': 10, 'guard': 11, 'down': 12, 'happy': 13}
SOURCES = (('high_resolution_4x', 'half'), ('template_x2', 'double'))


def warn(*a):
    print('경고:', *a)


def load_json(path, default):
    try:
        with open(path, encoding='utf-8-sig') as f:
            return json.load(f)
    except FileNotFoundError:
        return default


def source_of(pack):
    """묶음 안의 그림 폴더와 변환 방법 ('half' = 절반으로, 'double' = 두 배로)."""
    for sub, mode in SOURCES:
        d = os.path.join(pack, sub)
        if os.path.isdir(d):
            return d, mode
    return None, None


def pngs_in(d):
    return sorted(glob.glob(os.path.join(glob.escape(d), '*.png')))


def convert(src_png, mode, out_dir):
    name = os.path.basename(src_png)
    im = Image.open(src_png).convert('RGBA')
    if name.startswith(KEEP_SIZE_PREFIX):
        res = im.convert('RGB')
        if res.size != SCREEN:
            exact = SCREEN[0] % res.width == 0 and SCREEN[1] % res.height == 0
            res = res.resize(SCREEN, Image.NEAREST if exact else Image.LANCZOS)
    elif mode == 'half':
        w, h = im.size
        # 알파를 곱한 상태로 2x2 평균 → 가장자리가 부드럽고 색 번짐이 없다
        res = im.convert('RGBa').resize((w // 2, h // 2), Image.BOX).convert('RGBA')
    else:
        w, h = im.size
        res = im.resize((w * 2, h * 2), Image.NEAREST)  # 도트를 그대로 두 배
    res.save(os.path.join(out_dir, name), optimize=True)
    return name[:-4]


def in_range(lst, n):
    return isinstance(lst, list) and lst and all(isinstance(i, int) and 0 <= i < n for i in lst)


def side_poses(seqs, extra, n):
    """옆모습 JSON 의 sequences/extra_poses 에서 동작 번호를 정한다. 없거나 이상하면 기본값."""
    p = dict(SIDE_POSES)
    att, hurt = seqs.get('attack') or [], seqs.get('hurt') or []
    if len(att) >= 1: p['attack_ready'] = att[0]
    if len(att) >= 2: p['attack'] = att[1]; p['attack_end'] = att[2] if len(att) >= 3 else att[1]
    if len(hurt) >= 1: p['hurt'] = hurt[0]; p['knockback'] = hurt[1] if len(hurt) >= 2 else hurt[0]
    for src, dst in (('defend', 'guard'), ('guard', 'guard'), ('down', 'down'), ('happy', 'happy')):
        if isinstance(extra.get(src), int):
            p[dst] = extra[src]
    bad = {k: v for k, v in p.items() if not (isinstance(v, int) and 0 <= v < n)}
    if bad:
        warn('옆모습 동작 번호가 프레임 범위를 벗어나 기본값을 씁니다:', bad)
        p.update({k: SIDE_POSES[k] for k in bad})
    if p != SIDE_POSES:
        print('알림: 옆모습 동작 번호가 기본과 다릅니다:', p)
    return p


def read_main(meta, anim, sheets):
    """1) 본편 묶음: sheets{ "x_anim.png": {frame_width,...} }, player{...}"""
    for fname, sh in meta['sheets'].items():
        if isinstance(sh, dict) and 'frame_width' in sh and fname.endswith('.png'):
            sheets[fname[:-4]] = [int(sh['frame_width']) * 2, int(sh['frame_height']) * 2]
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


def read_side(meta, anim, sheets):
    """2) 옆모습 묶음: characters{ rabbit{sheet, frame_size, attack_hit_point}, player{frames[...]} }"""
    cs = meta.get('coordinate_system') if isinstance(meta.get('coordinate_system'), dict) else {}
    base = meta.get('frame_index_base', cs.get('frame_index_base', 1))
    n = meta.get('frame_count', 14)
    seqs = {k: [i - base for i in v] for k, v in (meta.get('sequences') or {}).items()
            if isinstance(v, list) and all(isinstance(i, int) for i in v)}
    extra = {k: v - base for k, v in (meta.get('extra_poses') or {}).items() if isinstance(v, int)}
    idle = seqs.get('idle') if in_range(seqs.get('idle'), n) else [0, 1]
    walk = seqs.get('walk') if in_range(seqs.get('walk'), n) else [2, 3, 4, 5]
    unit_side = {'seq': {'idle': idle, 'move': walk}, 'poses': side_poses(seqs, extra, n)}
    if anim.get('unitSide') and anim['unitSide'] != unit_side:
        print('알림: 옆모습 동작 순서(unitSide)를 이 묶음 값으로 바꿉니다.')
    anim['unitSide'] = unit_side
    hit = anim.setdefault('hit', {})
    for key, ch in meta['characters'].items():
        try:
            fw, fh = ch.get('frame_size') or meta['frame_size']
            if 'sheet' in ch:
                sheets[os.path.basename(ch['sheet'])[:-4]] = [fw * 2, fh * 2]
            if 'attack_hit_point' in ch:
                hit[key] = ch['attack_hit_point']
            if key == 'player':
                for s in (ch.get('body_sheet'), ch.get('clothes_sheet')):
                    if s:
                        sheets[os.path.basename(s)[:-4]] = [fw * 2, fh * 2]
                frames = sorted(ch['frames'], key=lambda f: f['frame'])
                anim['heroSide'] = {
                    'frame': [fw, fh],
                    'hairOffset': [f['head_offset'] for f in frames],
                    'hand': [f['weapon_hand'] for f in frames],
                    'angle': [f['weapon_angle_deg'] for f in frames],
                    # 옆모습에만 있는 손잡이 값. 정면 값과 합친 'grip' 은 맨 끝에 만든다 (묶음 순서와 상관없게)
                    'sideGrip': {k[:-4]: v for k, v in (ch.get('weapon_grips') or {}).items()},
                    'seq': {'idle': idle, 'walk': walk},
                    'poses': unit_side['poses'],
                }
        except (KeyError, TypeError, ValueError, IndexError) as e:
            warn(f'옆모습 {key}: 형식이 예상과 달라 건너뜁니다 ({e!r})')


def read_single(meta, src_dir, k, sheets):
    """3) 캐릭터 한 마리 묶음: frame_size, frame_count, states"""
    fw, fh = meta['frame_size']
    n = meta['frame_count']
    for f in sorted(glob.glob(os.path.join(glob.escape(src_dir), '*_anim.png'))):
        w, h = Image.open(f).size
        if w == fw * k * n and h == fh * k:
            sheets[os.path.basename(f)[:-4]] = [fw * 2, fh * 2]


def ingest_meta(pack, src_dir, mode, anim):
    """묶음의 animation_data*.json 에서 프레임 크기와 주인공 좌표를 읽어 anim 에 합친다."""
    sheets = anim.setdefault('sheets', {})
    k = 4 if mode == 'half' else 1  # JSON 단위(2배 템플릿 픽셀) → 원본 PNG 배율
    for jpath in sorted(glob.glob(os.path.join(glob.escape(pack), 'animation_data*.json'))):
        name = os.path.basename(jpath)
        try:
            meta = load_json(jpath, {})
        except (ValueError, OSError) as e:
            warn(f'{name} 을(를) 읽지 못해 건너뜁니다 ({e})')
            continue
        if not isinstance(meta, dict):
            continue
        for kind, fn in (('sheets', lambda: read_main(meta, anim, sheets)),
                         ('characters', lambda: read_side(meta, anim, sheets)),
                         ('states', lambda: read_single(meta, src_dir, k, sheets))):
            if kind == 'sheets' and not isinstance(meta.get('sheets'), dict): continue
            if kind == 'characters' and not isinstance(meta.get('characters'), dict): continue
            if kind == 'states' and not ('frame_size' in meta and 'states' in meta and 'frame_count' in meta): continue
            try:
                fn()
            except (KeyError, TypeError, ValueError, IndexError) as e:
                warn(f'{name}: 형식이 예상과 달라 일부를 건너뜁니다 ({e!r})')


def frame_size_guess(key):
    """JSON 에 없는 시트: 같은 이름의 정지 그림 폭을 한 프레임으로 본다 (x_side_anim → x.png)."""
    base = key[:-5]
    w0, h = Image.open(os.path.join(OUT, key + '.png')).size
    # 주인공 몸에 겹치는 시트(옷·갑옷·장화): 정면 10프레임, 옆모습 14프레임
    if key.startswith(('player_', 'armor_', 'boots_')):
        n = 14 if base.endswith('_side') else 10
        if w0 % n == 0:
            return [w0 // n, h]
    for cand in (base, base[:-5] if base.endswith('_side') else None):
        if cand and os.path.exists(os.path.join(OUT, cand + '.png')):
            w, _ = Image.open(os.path.join(OUT, cand + '.png')).size
            return [w, h]
    return [h, h]


def main(argv):
    reset = '--reset' in argv
    packs = [a for a in argv if a != '--reset']
    if not packs:
        print(__doc__)
        return 1
    # 1) 묶음 확인: 그림 폴더와 PNG 가 있어야 한다 (아직 아무것도 지우지 않음)
    plan = []
    for p in packs:
        src, mode = source_of(p)
        if not src:
            print('그림 폴더(high_resolution_4x 또는 template_x2)가 없습니다:', p)
            return 1
        files = pngs_in(src)
        if not files:
            print('PNG 가 하나도 없습니다:', src)
            return 1
        print(f'{p}: {os.path.basename(src)} 의 PNG {len(files)}장 ({"절반으로" if mode == "half" else "두 배로"})')
        plan.append((p, src, mode, files))
    # 2) JSON 읽기 (잘못된 JSON 은 경고하고 건너뜀)
    anim = {} if reset else load_json(ANIM, {})
    for p, src, mode, _ in plan:
        ingest_meta(p, src, mode, anim)
    # 3) 임시 폴더에 전부 변환 → 다 되면 assets/ 에 반영
    tmp = tempfile.mkdtemp(prefix='guardian_assets_')
    try:
        count = 0
        for _, _, mode, files in plan:
            for f in files:
                convert(f, mode, tmp)
                count += 1
        if reset:
            for f in glob.glob(os.path.join(OUT, '*.png')):
                os.remove(f)
        for f in sorted(os.listdir(tmp)):
            shutil.move(os.path.join(tmp, f), os.path.join(OUT, f))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    # 4) 옆모습 손잡이 = 정면 손잡이 + 옆모습에만 있는 값
    if 'heroSide' in anim:
        hs = anim['heroSide']
        hs['grip'] = {**anim.get('hero', {}).get('grip', {}), **hs.get('sideGrip', {})}
    anim['_comment'] = '그림 묶음에서 자동으로 만든 파일 (tools/build_assets.py). 직접 고치지 말고 손질 값은 data/anim_tweaks.json 에.'
    # 5) overrides: assets/ 에 있는 모든 그림. 시트는 프레임 크기가 그림 크기와 맞는지 확인한다.
    ov = {}
    sheets = anim.setdefault('sheets', {})
    for f in sorted(glob.glob(os.path.join(OUT, '*.png'))):
        key = os.path.basename(f)[:-4]
        if key.startswith('tiles') and not key.endswith('_anim'):
            ov[key] = {'type': 'spritesheet', 'file': f'assets/{key}.png', 'frameWidth': 64, 'frameHeight': 64}
        elif key.endswith('_anim'):
            w, h = Image.open(f).size
            fw, fh = sheets.get(key) or frame_size_guess(key)
            if fw <= 0 or w % fw or h != fh:
                g = frame_size_guess(key)
                warn(f'{key}: 프레임 크기 {fw}x{fh} 가 그림 {w}x{h} 와 맞지 않아 {g[0]}x{g[1]} 로 봅니다')
                fw, fh = g
            sheets[key] = [fw, fh]
            ov[key] = {'type': 'spritesheet', 'file': f'assets/{key}.png', 'frameWidth': fw, 'frameHeight': fh}
        else:
            ov[key] = {'type': 'image', 'file': f'assets/{key}.png'}
    anim['sheets'] = dict(sorted(sheets.items()))
    anim = {'_comment': anim.pop('_comment'), **dict(sorted(anim.items()))}
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
