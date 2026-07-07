// window.close() は「スクリプトが開いた窓」以外では多くのブラウザで無視される。
// （LINEアプリ内ブラウザや、URL直開き・QR読み取りで開いたタブなど）
// そのため close を試みたうえで、閉じられなかった場合は onFail でフォールバック案内を出す。
export function tryCloseWindow(onFail: () => void) {
  window.close();
  // close が効かない環境では window は閉じないため、少し待って案内を表示する
  setTimeout(() => {
    if (!window.closed) onFail();
  }, 300);
}
