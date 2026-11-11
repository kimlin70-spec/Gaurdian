# 4배 원본을 절반으로 줄여 게임용(PX=4 밀도) PNG 를 만든다. 사용: python3 -I build_assets.py <src4x> <animation_data.json> <repo>
import sys, os, json, glob
from PIL import Image
src, jpath, repo = sys.argv[1], sys.argv[2], sys.argv[3]
out = os.path.join(repo, 'assets')
for f in glob.glob(os.path.join(out, '*.png')):
    if os.path.basename(f) != 'template_sheet.png': os.remove(f)
meta = json.load(open(jpath, encoding='utf-8-sig'))
ov = {}
for f in sorted(glob.glob(os.path.join(src, '*.png'))):
    name = os.path.basename(f); key = name[:-4]
    im = Image.open(f).convert('RGBA')
    if key.startswith('bg_battle_'):
        res = im.convert('RGB')                      # 1280x960 그대로 (불투명)
    else:
        w, h = im.size
        res = im.convert('RGBa').resize((w // 2, h // 2), Image.BOX).convert('RGBA')  # 알파 곱 상태로 2x2 평균
    res.save(os.path.join(out, name), optimize=True)
    sheet = meta['sheets'].get(name)
    if sheet: ov[key] = {'type': 'spritesheet', 'file': f'assets/{name}', 'frameWidth': sheet['frame_width'] * 2, 'frameHeight': sheet['frame_height'] * 2}
    elif key.startswith('tiles'): ov[key] = {'type': 'spritesheet', 'file': f'assets/{name}', 'frameWidth': 64, 'frameHeight': 64}
    else: ov[key] = {'type': 'image', 'file': f'assets/{name}'}
ap = os.path.join(repo, 'data', 'assets.json')
d = json.load(open(ap))
d['_comment'] = '진짜 그림 목록. 모든 그림은 논리 크기의 4배(PX=4)입니다 (타일 64x64, 동물 64x64, 주인공 96x128, 전투 배경 1280x960). 여기 적힌 키는 코드가 임시 도트를 만들지 않고 파일을 읽습니다.'
d.pop('_example', None)
d['overrides'] = ov
json.dump(d, open(ap, 'w'), ensure_ascii=False, indent=1)
# 주인공 애니메이션 수치 (assets 픽셀 = 논리 픽셀의 2배 기준)
p = meta['player']
json.dump({'_comment': '주인공 프레임별 머리 이동량과 손 위치, 무기 손잡이 위치. 단위는 논리 픽셀의 2배(프레임 48x64 기준).',
           'frame': p['frame_size'], 'hairOffset': p['hair_offset_xy_by_frame'], 'hand': p['right_hand_xy_by_frame'],
           'grip': {k[:-4]: v for k, v in p['weapon_grip_xy'].items()},
           'seq': {'idle': [0, 1], 'walk': [2, 3, 4, 5], 'attack': [6, 7], 'hurt': [8], 'happy': [9]}},
          open(os.path.join(repo, 'data', 'heroanim.json'), 'w'), ensure_ascii=False, indent=1)
print(len(ov), 'assets')
