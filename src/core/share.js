// 結果のシェア。XのAPIは使わない（投稿画面を開くリンクだけ）。個人情報は含めない。

const X_INTENT = 'https://x.com/intent/post';

// ゲームのXアカウント（作成後に入れる。例：'rakugaki_yusha'）。入れると、感想や要望の投稿がこのアカウント宛てになる
export const X_HANDLE = '';

// クリアした人に「このあと、どうなってほしい？」を聞く選択肢（答えはプレイヤー自身がXに投稿する。ゲームは何も集めない）
export const AFTER_CLEAR_CHOICES = [
  'もっと強い敵とたたかいたい',
  'このままずっと遊びつづけたい',
  '新しい場所（ステージ）がみたい',
];

export function buildAfterClearText(choice, url) {
  const to = X_HANDLE ? `@${X_HANDLE} ` : '';
  const body = choice ? `クリアのあとは「${choice}」` : 'クリアのあとは「　　　」がほしい';
  return [`${to}らくがき勇者をクリアした！`, body, '#らくがき勇者', url].filter(Boolean).join('\n');
}

export function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// 1分ごとに色のマス。クリアなら最後に王冠。
export function progressBar(result) {
  const full = result.status === 'clear' ? 5 : Math.min(5, Math.floor(result.time / 60));
  return '🟦'.repeat(full) + '⬜'.repeat(5 - full) + (result.status === 'clear' ? '👑' : '');
}

export function buildShareText(result, { day, anomalyName, url }) {
  const modeLabel = result.mode === 'daily' ? `「今日のページ」${anomalyName ? `（異変：${anomalyName}）` : ''}` : '「自由帳」';
  const head = result.status === 'clear' ? `🖍️ クリア！ ${formatTime(result.time)}` : `🖍️ ${formatTime(result.time)} 生存`;
  return [
    `らくがき勇者 Day ${day}${modeLabel}`,
    `${head}（Lv${result.level}）`,
    progressBar(result),
    '#らくがき勇者',
    url,
  ].filter(Boolean).join('\n');
}

export function xIntentUrl(text) {
  return `${X_INTENT}?text=${encodeURIComponent(text)}`;
}

// スマホの共有シートで画像つき共有。できなければ false を返す。
export async function shareWithImage(text, blob) {
  try {
    if (!navigator.share || !blob) return false;
    const file = new File([blob], 'rakugaki.png', { type: 'image/png' });
    if (navigator.canShare && !navigator.canShare({ files: [file] })) return false;
    await navigator.share({ text, files: [file] });
    return true;
  } catch (e) {
    return e && e.name === 'AbortError'; // 自分でキャンセルした場合は成功扱い
  }
}
