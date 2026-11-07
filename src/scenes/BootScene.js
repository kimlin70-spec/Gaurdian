import { W, H, FONT } from '../config.js';
import Data, { DATA_FILES } from '../systems/Data.js';
import Audio from '../systems/Audio.js';
import { generateAll, loadOverrides } from '../systems/Assets.js';

export default class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    this.add.text(W / 2, H / 2, '불러오는 중...', { fontFamily: FONT, fontSize: '11px', color: '#ffffff', resolution: 1 }).setOrigin(0.5);
    for (const f of DATA_FILES) this.load.json(f, `data/${f}.json`);
    // assets.json 이 읽히면 그 안의 PNG 들도 이어서 읽는다
    this.load.on('filecomplete-json-assets', (key, type, data) => loadOverrides(this, data));
    this.load.on('loaderror', (file) => console.warn('load error', file && file.key));
  }
  create() {
    Data.init(this.cache.json);
    Audio.init();
    generateAll(this);
    this.scene.start('Title');
  }
}
