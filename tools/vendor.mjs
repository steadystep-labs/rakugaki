// node_modules の Phaser を vendor/ にコピーする（CDNは使わない）
import { copyFileSync, mkdirSync } from 'node:fs';
mkdirSync('vendor', { recursive: true });
copyFileSync('node_modules/phaser/dist/phaser.esm.min.js', 'vendor/phaser.esm.min.js');
copyFileSync('node_modules/phaser/LICENSE.md', 'vendor/PHASER-LICENSE.md');
console.log('vendored phaser');
