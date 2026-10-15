import * as Phaser from '../vendor/phaser.esm.min.js';
import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { GameScene } from './scenes/GameScene.js';
import { ResultScene } from './scenes/ResultScene.js';
import { ShopScene } from './scenes/ShopScene.js';
import { NoteScene } from './scenes/NoteScene.js';
import { SettingsScene } from './scenes/SettingsScene.js';
import { installTestHooks } from './test/hooks.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 720,
  height: 1280,
  backgroundColor: '#FDFEFF',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { antialias: true },
  input: { activePointers: 3 },
  disableContextMenu: true,
  banner: false,
  scene: [BootScene, TitleScene, GameScene, ResultScene, ShopScene, NoteScene, SettingsScene],
});

installTestHooks(game);
