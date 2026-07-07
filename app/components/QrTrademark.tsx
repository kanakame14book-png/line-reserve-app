// 「QRコード」は株式会社デンソーウェーブの登録商標のため、QRを表示・利用する画面に注記する（Issue #25）
export function QrTrademark({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[10px] text-gray-400 leading-snug ${className}`}>
      「QRコード」は株式会社デンソーウェーブの登録商標です。
    </p>
  );
}
