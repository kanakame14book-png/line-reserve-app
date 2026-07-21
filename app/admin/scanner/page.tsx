"use client";
import { supabase } from '../../../supabase';
import { useEffect, useState, Suspense, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Scanner } from '@yudiel/react-qr-scanner';
import { tryCloseWindow } from '../../lib/close';
import { QrTrademark } from '../../components/QrTrademark';
import { AppHeader } from '../../components/AppHeader';
import { CARD } from '../../components/formStyles';
// useRouter は不要になったので削除しました

type ScanState = 'success' | 'already' | 'unregistered' | 'error';

/**
 * reservations テーブルのうち、この画面で参照する列だけを型にしたもの。
 * LINE 登録のみで氏名未入力の場合に line_user_name を使うため任意列も含む。
 */
type Reservation = {
    id: string;
    status: string;
    last_name?: string;
    first_name?: string;
    line_user_name?: string;
    faculty: string;
    department: string;
    group_name?: string;
    attendee_count: number;
};

/**
 * 判定結果ごとの見た目と文言。色だけに頼らず記号と文言も添える。
 * 受付済みの再スキャンは失敗ではないため warn（注意）とし、成功・失敗と区別する。
 * Tailwind がクラス名を静的に拾えるよう、色は組み立てず完成した文字列で持つ。
 */
const RESULT: Record<ScanState, { circle: string; title: string; heading: string; note?: string; mark: string }> = {
    success: { circle: 'bg-ok-soft text-ok', title: 'text-ok', heading: '受付が完了しました', mark: '✓' },
    already: { circle: 'bg-warn-soft text-warn', title: 'text-warn', heading: '既に受付済みのチケットです', mark: '!' },
    unregistered: { circle: 'bg-ng-soft text-ng', title: 'text-ng', heading: '予約が完了していません', note: '（登録のみの状態です）', mark: '!' },
    error: { circle: 'bg-ng-soft text-ng', title: 'text-ng', heading: '無効なチケットです', note: '予約データが存在しないか、URLが不正です。', mark: '×' },
};

function ScannerContent() {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [isScanning, setIsScanning] = useState(false);
    const [closeHint, setCloseHint] = useState(false); // 閉じるボタンが効かない環境向け案内

    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

    const [scanResult, setScanResult] = useState<ScanState | null>(null);
    const [scannedStudent, setScannedStudent] = useState<Reservation | null>(null);

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
        } catch (err) {
            console.error('読み取りエラー:', err instanceof Error ? err.message : err);
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

    if (loading) return <div className="p-8 text-center text-ink-soft">システム起動中...</div>;

    if (!session) {
        return (
            <main className="min-h-screen bg-white text-ink">
                <AppHeader eyebrow="スタッフ用" title="QR受付" />
                <div className="mx-auto w-full max-w-md px-4 pt-5">
                    <div className={`${CARD} text-center`}>
                        <p className="mb-2 font-extrabold text-ng">⚠ 管理者ログインが必要です</p>
                        <p className="mb-6 text-sm text-ink-soft">受付を行うには管理画面から再度「QR受付」を開き直してください。</p>
                        <button
                            onClick={() => tryCloseWindow(() => setCloseHint(true))}
                            className="h-[46px] w-full rounded-[14px] border-2 border-line text-sm font-bold text-ink transition-colors hover:bg-band/50"
                        >
                            このタブを閉じる
                        </button>
                        {closeHint && (
                            <p className="mt-4 rounded-[14px] border-2 border-line bg-band/50 p-3 text-xs">
                                このタブは自動で閉じられませんでした。ブラウザの「×」ボタンで閉じてください。
                            </p>
                        )}
                    </div>
                </div>
            </main>
        );
    }

    const result = scanResult ? RESULT[scanResult] : null;

    return (
        <main className="min-h-screen bg-white text-ink">
            <AppHeader eyebrow="スタッフ用" title="QR受付" />

            <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-5 pb-10">
                {!result ? (
                    <section className={CARD}>
                        <div className="mb-4 flex items-start justify-between gap-4">
                            <p className="text-sm text-ink-soft">
                                学生のスマホに表示された受付票のQRコードを枠内にかざしてください。
                            </p>
                            <button
                                onClick={toggleCamera}
                                className="flex-none rounded-[14px] border-2 border-line px-3 py-1.5 text-sm font-bold text-ink transition-colors hover:bg-band/50"
                            >
                                🔄 {facingMode === 'user' ? '内カメ' : '外カメ'}
                            </button>
                        </div>

                        <div className="relative overflow-hidden rounded-[18px] border-4 border-band bg-black">
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
                        <div className="mt-5 animate-pulse text-center text-sm font-bold text-brand-top">
                            スキャン待機中...
                        </div>
                    </section>
                ) : (
                    <section className={`${CARD} text-center animate-fade-in`}>
                        <div className="mb-6">
                            <div className={`mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full text-4xl ${result.circle}`}>
                                {result.mark}
                            </div>
                            <h1 className={`text-xl font-extrabold ${result.title}`}>{result.heading}</h1>
                            {result.note && <p className="mt-2 text-sm text-ink-soft">{result.note}</p>}
                        </div>

                        {scannedStudent && scanResult !== 'error' && (
                            <div className="space-y-3 rounded-[14px] border-2 border-line bg-band/30 p-4 text-left">
                                <div>
                                    <p className="text-[11px] font-bold tracking-[0.09em] text-ink-soft">氏名</p>
                                    <p className="mt-0.5 text-lg font-bold">
                                        {scannedStudent.last_name ? `${scannedStudent.last_name} ${scannedStudent.first_name}` : scannedStudent.line_user_name || '未入力'}
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <p className="text-[11px] font-bold tracking-[0.09em] text-ink-soft">人数</p>
                                        <p className="mt-0.5 text-xl font-bold">{scannedStudent.attendee_count} 名</p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold tracking-[0.09em] text-ink-soft">班</p>
                                        <p className="mt-0.5 text-xl font-bold">{scannedStudent.group_name || '未定'}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3 border-t border-line pt-3">
                                    <div>
                                        <p className="text-[11px] font-bold tracking-[0.09em] text-ink-soft">学部</p>
                                        <p className="mt-0.5 text-[15px] font-bold">{scannedStudent.faculty}</p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold tracking-[0.09em] text-ink-soft">学科・コース</p>
                                        <p className="mt-0.5 text-[15px] font-bold">{scannedStudent.department}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="mt-6 text-sm font-bold text-ink-soft">
                            3秒後にカメラに戻ります...
                        </div>
                    </section>
                )}

                <footer className="text-center">
                    <QrTrademark />
                </footer>
            </div>
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