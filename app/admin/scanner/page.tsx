"use client";
import { supabase } from '../../../supabase';
import { useEffect, useState, Suspense } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { useRouter } from 'next/navigation';

function ScannerContent() {
    const router = useRouter();
    const [session, setSession] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isScanning, setIsScanning] = useState(false);

    // 🌟 カメラの向きを管理するState（デフォルトを 'user' = 内カメ に設定）
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        });
    }, []);

    const handleScanQR = async (text: string) => {
        if (!text || isScanning) return;
        setIsScanning(true);

        try {
            let targetId = text;
            if (text.includes('id=')) {
                try {
                    const urlObj = new URL(text);
                    targetId = urlObj.searchParams.get('id') || text;
                } catch {
                    targetId = text.split('id=')[1]?.split('&')[0] || text;
                }
            }

            const { data, error } = await supabase.from('reservations').select('*').eq('id', targetId).maybeSingle();

            if (error || !data) {
                alert('❌ 無効なQRコードです（データが見つかりません）');
                setTimeout(() => setIsScanning(false), 2000);
                return;
            }

            if (data.status === '受付済') {
                alert(`⚠️ すでに受付済みです\n氏名: ${data.last_name} ${data.first_name}`);
            } else if (data.status === '仮登録') {
                alert(`❌ 本登録が完了していません\n氏名: ${data.line_user_name || '未入力'}`);
            } else {
                const { error: updateError } = await supabase.from('reservations').update({ status: '受付済' }).eq('id', targetId);
                if (updateError) throw updateError;

                alert(`✅ 受付完了！\n氏名: ${data.last_name} ${data.first_name}\n人数: ${data.attendee_count}名\n班: ${data.group_name || '未定'}`);
            }
        } catch (err: any) {
            alert('読み取りエラー: ' + err.message);
        }

        setTimeout(() => setIsScanning(false), 3000);
    };

    // 🌟 カメラを切り替える関数
    const toggleCamera = () => {
        setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    };

    if (loading) return <div className="p-8 text-center text-gray-500">システム起動中...</div>;

    if (!session) {
        return (
            <main className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-sm text-center">
                    <p className="text-red-500 font-bold mb-4">⚠️ 受付を行うには管理者ログインが必要です</p>
                    <button
                        onClick={() => router.push('/admin')}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-lg transition-all"
                    >
                        管理画面へ進んでログイン
                    </button>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gray-100 p-6 font-sans text-gray-800">
            <header className="mb-6 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm max-w-lg mx-auto">
                <h1 className="text-xl font-bold text-gray-900">📷 QRコード受付</h1>
                <button onClick={() => router.push('/admin')} className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-bold px-4 py-2 rounded-lg transition-all">
                    戻る
                </button>
            </header>

            <section className="bg-white rounded-xl shadow-sm overflow-hidden p-6 max-w-lg mx-auto">

                {/* 🌟 カメラ切り替えボタンと案内テキスト */}
                <div className="flex justify-between items-start mb-4 gap-4">
                    <p className="text-sm text-gray-500">
                        学生のスマホに表示された受付票のQRコードを枠内にかざしてください。
                    </p>
                    <button
                        onClick={toggleCamera}
                        className="flex-shrink-0 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors border shadow-sm flex items-center gap-1"
                    >
                        🔄 {facingMode === 'user' ? '内カメ使用中' : '外カメ使用中'}
                    </button>
                </div>

                <div className="rounded-2xl overflow-hidden border-4 border-blue-50 bg-gray-900 relative shadow-inner">
                    <Scanner
                        key={facingMode} // 🌟 カメラ切り替え時にコンポーネントを再起動させるためのKey
                        constraints={{ facingMode: facingMode }} // 🌟 ここで内カメ（user）か外カメ（environment）を指定
                        onScan={(result) => {
                            if (result && result.length > 0) {
                                handleScanQR(result[0].rawValue);
                            }
                        }}
                        onError={(error) => console.log(error?.message)}
                    />

                    {isScanning && (
                        <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 backdrop-blur-sm">
                            <div className="text-blue-600 font-bold text-lg flex items-center gap-2">
                                <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                処理中...
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-6 text-center text-sm text-gray-500">
                    読取に成功すると画面に結果が表示され、<br />3秒後に次のスキャンが可能になります。
                </div>
            </section>
        </main>
    );
}

export default function ScannerPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
            <ScannerContent />
        </Suspense>
    );
}