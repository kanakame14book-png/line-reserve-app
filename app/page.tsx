'use client';

import { useEffect, useState } from 'react';
import liff from '@line/liff';

export default function Home() {
  const [liffError, setLiffError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    // LINEのミニアプリ（LIFF）を起動する設定
    liff
      .init({
        liffId: 'ここに後でLINEのIDを入れます', 
      })
      .then(() => {
        // LINEアプリ内で開かれているかチェック
        if (!liff.isLoggedIn()) {
          // もしログインしていなければログイン画面を出す
          liff.login();
        } else {
          // ログインが成功していたら、ユーザーの情報を取得する
          const profile = liff.getProfile();
          profile.then((user) => {
            setUserId(user.userId);
            setDisplayName(user.displayName);
          });
        }
      })
      .catch((err) => {
        setLiffError(err.toString());
      });
  }, []);

  return (
    <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1>LINE来場予約システム</h1>
      <p style={{ color: '#06C755', fontWeight: 'bold' }}>LINE連携テスト中</p>

      <div style={{ marginTop: '30px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', textAlign: 'left', display: 'inline-block' }}>
        <h3>【取得したLINE情報】</h3>
        <p><strong>お名前:</strong> {displayName || '読み込み中...'}</p>
        <p><strong>ユーザーID:</strong> {userId || '読み込み中...'}</p>
      </div>

      {liffError && (
        <p style={{ color: 'red', marginTop: '20px' }}>
          エラー（※パソコンのブラウザではまだエラーが出て正常です）: {liffError}
        </p>
      )}
    </div>
  );
}