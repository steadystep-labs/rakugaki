"""ゲームで使う文字だけを抜き出したフォント（assets/fonts/rakugaki.woff）を作る。
文字列を追加・変更したら必ず実行する：python tools/subset_font.py
元フォント：Klee One SemiBold（SIL Open Font License 1.1）tools/fonts-src/KleeOne-SemiBold.ttf
"""
import pathlib, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'tools' / 'fonts-src' / 'KleeOne-SemiBold.ttf'
OUT = ROOT / 'assets' / 'fonts' / 'rakugaki.woff'

chars = set(chr(c) for c in range(0x20, 0x7f))
chars |= set('、。・ー「」『』（）！？：…〜●○◆＋－×％／')
import re
for p in list((ROOT / 'src').rglob('*.js')) + [ROOT / 'index.html']:
    text = p.read_text(encoding='utf-8')
    if p.suffix == '.js':
        # コメントの文字は画面に出ないので数えない（フォントが無駄に大きくなるため）。URL内の // は ASCII なので影響しない
        text = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
        text = re.sub(r'(^|[^:])//[^
]*', r'', text)
    for ch in text:
        if ord(ch) > 0x7f:
            chars.add(ch)
text = ''.join(sorted(chars))
(ROOT / 'tools' / 'fonts-src' / 'chars.txt').write_text(text, encoding='utf-8')
subprocess.run([sys.executable, '-m', 'fontTools.subset', str(SRC),
                f'--text-file={ROOT / "tools" / "fonts-src" / "chars.txt"}',
                '--flavor=woff', f'--output-file={OUT}', '--layout-features=*'], check=True)
print(f'{len(chars)} chars -> {OUT} ({OUT.stat().st_size // 1024} KB)')
