"use client";
import { supabase } from '../../../supabase';
import { useEffect, useState, Suspense, useRef } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { tryCloseWindow } from '../../lib/close';
import { QrTrademark } from '../../components/QrTrademark';
// 🌟 useRouter は不要になったので削除しました！

function ScannerContent() {
    const [session, setSession] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isScanning, setIsScanning] = useState(false);
    const [closeHint, setCloseHint] = useState(false); // 閉じるボタンが効かない環境向け案内

    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

    const [scanResult, setScanResult] = useState<'success' | 'already' | 'unregistered' | 'error' | null>(null);
    const [scannedStudent, setScannedStudent] = useState<any>(null);

    // 効果音のmp3ファイル。差し替えたい場合は public/sounds/ 内の同名ファイルを置き換えてください。
    const successAudioRef = useRef<HTMLAudioElement | null>(null);
    const errorAudioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        successAudioRef.current = new Audio('/sounds/success.mp3');
        errorAudioRef.current = new Audio('/sounds/error.mp3');
    }, []);

    // 指定した音声を頭出しして再生する共通関数
    const playSound = (audio: HTMLAudioElement | null) => {
        if (!audio) return;
        audio.currentTime = 0;
        audio.play().catch((e) => console.error('効果音の再生に失敗しました', e));
    };

    // 読み取り成功時の「ピロリン♪」音
    const playSuccessSound = () => playSound(successAudioRef.current);

    // 読み取り失敗時の「ブブッ」音
    const playErrorSound = () => playSound(errorAudioRef.current);

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
                playErrorSound();
                setScanResult('error');
            } else {
                setScannedStudent(data);

                if (data.status === '受付済') {
                    playSuccessSound();
                    setScanResult('already');
                } else if (data.status === '登録') {
                    playErrorSound();
                    setScanResult('unregistered');
                } else {
                    const { error: updateError } = await supabase.from('reservations').update({ status: '受付済' }).eq('id', targetId);
                    if (updateError) throw updateError;

                    playSuccessSound();
                    setScanResult('success');
                }
            }
        } catch (err: any) {
            console.error('読み取りエラー:', err.message);
            playErrorSound();
            setScanResult('error');
        }

        setTimeout(() => {
            setScanResult(null);
            setScannedStudent(null);
            setIsScanning(false);
        }, 3000);
    };

    const toggleCamera = () => {
        setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    };

    if (loading) return <div className="p-8 text-center text-gray-500">システム起動中...</div>;

    if (!session) {
        return (
            <main className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-sm text-center">
                    <p className="text-red-500 font-bold mb-4">⚠ 受付を行うには管理者ログインが必要です</p>
                    <p className="text-sm text-gray-500 mb-6">管理画面から再度「QR受付」を開き直してください。</p>
                    <button
                        onClick={() => tryCloseWindow(() => setCloseHint(true))}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2.5 px-6 rounded-lg transition-all w-full"
                    >
                        このタブを閉じる
                    </button>
                    {closeHint && (
                        <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                            このタブは自動で閉じられませんでした。ブラウザの「×」ボタンで閉じてください。
                        </p>
                    )}
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gray-100 flex flex-col p-6 font-sans text-gray-800">
            <header className="mb-6 flex justify-center items-center bg-white p-4 rounded-xl shadow-sm max-w-lg w-full mx-auto">
                <h1 className="text-xl font-bold text-gray-900">📷 QRコード受付システム</h1>
            </header>

            <div className="flex-1 flex flex-col items-center justify-center">
                {!scanResult ? (
                    <section className="bg-white rounded-xl shadow-sm overflow-hidden p-6 w-full max-w-lg">
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
                                key={facingMode}
                                constraints={{ facingMode: facingMode }}
                                onScan={(result) => {
                                    if (result && result.length > 0) {
                                        handleScanQR(result[0].rawValue);
                                    }
                                }}
                                onError={(error) => console.log(error?.message)}
                            />
                        </div>
                        <div className="mt-6 text-center text-sm font-bold text-blue-600 animate-pulse">
                            スキャン待機中...
                        </div>
                    </section>
                ) : (
                    <section className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6 text-center border-t-8 border-blue-600 animate-fade-in">

                        {scanResult === 'success' && (
                            <div className="mb-6">
                                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-3">✓</div>
                                <h1 className="text-2xl font-bold text-green-600">受付が完了しました</h1>
                            </div>
                        )}

                        {scanResult === 'already' && (
                            <div className="mb-6">
                                <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-3">!</div>
                                <h1 className="text-xl font-bold text-amber-600">既に受付済みのチケットです</h1>
                            </div>
                        )}

                        {scanResult === 'unregistered' && (
                            <div className="mb-6">
                                <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-3">!</div>
                                <h1 className="text-xl font-bold text-red-600">予約が完了していません</h1>
                                <p className="text-sm text-gray-500 mt-2">（登録のみの状態です）</p>
                            </div>
                        )}

                        {scanResult === 'error' && (
                            <div className="mb-6">
                                <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-3">×</div>
                                <h1 className="text-xl font-bold text-red-600">無効なチケットです</h1>
                                <p className="text-sm text-gray-500 mt-2">予約データが存在しないか、URLが不正です。</p>
                            </div>
                        )}

                        {scannedStudent && scanResult !== 'error' && (
                            <div className="bg-gray-50 rounded-xl p-4 text-left border border-gray-100 space-y-3 text-sm">
                                <div>
                                    <span className="text-gray-400 font-semibold block text-xs">氏名</span>
                                    <p className="text-lg font-bold text-gray-900">
                                        {scannedStudent.last_name ? `${scannedStudent.last_name} ${scannedStudent.first_name}` : scannedStudent.line_user_name || '未入力'}
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <span className="text-gray-400 font-semibold block text-xs">人数</span>
                                        <p className="font-bold text-xl text-blue-600">{scannedStudent.attendee_count} 名</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-400 font-semibold block text-xs">班</span>
                                        <p className="font-bold text-xl text-indigo-600">{scannedStudent.group_name || '未定'}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200">
                                    <div>
                                        <span className="text-gray-400 font-semibold block text-xs">学部</span>
                                        <p className="font-medium text-gray-800">{scannedStudent.faculty}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-400 font-semibold block text-xs">学科・コース</span>
                                        <p className="font-medium text-gray-800">{scannedStudent.department}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="mt-6 text-sm font-bold text-gray-400">
                            3秒後にカメラに戻ります...
                        </div>
                    </section>
                )}
            </div>
            <footer className="mt-6 text-center">
                <QrTrademark />
            </footer>
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