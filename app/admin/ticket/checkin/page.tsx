"use client";
import { supabase } from '../../../../supabase';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function CheckinContent() {
    const searchParams = useSearchParams();
    const resId = searchParams.get('id');

    const [session, setSession] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [studentInfo, setStudentInfo] = useState<any>(null);
    const [checkinStatus, setCheckinStatus] = useState<'success' | 'already' | 'error' | null>(null);

    // 1. ログイン状態の監視
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session && resId) handleCheckin(resId);
            else setLoading(false);
        });
    }, [resId]);

    // 2. チェックイン処理の本体
    const handleCheckin = async (id: string) => {
        setLoading(true);
        try {
            // 登録情報の取得
            const { data: resData, error: fetchError } = await supabase
                .from('reservations')
                .select('*')
                .eq('id', id)
                .maybeSingle();

            if (fetchError || !resData) {
                setCheckinStatus('error');
                setLoading(false);
                return;
            }

            setStudentInfo(resData);

            // すでに受付済みの場合は二重更新しない
            if (resData.status === '受付済') {
                setCheckinStatus('already');
            } else {
                // ステータスを「受付済」に更新
                const { error: updateError } = await supabase
                    .from('reservations')
                    .update({ status: '受付済' })
                    .eq('id', id);

                if (updateError) throw updateError;
                setCheckinStatus('success');
            }
        } catch (err) {
            console.error("チェックインエラー:", err);
            setCheckinStatus('error');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500 text-lg">QRコードを解析中...</div>;

    // 🌟 スタッフがログインしていない場合はログインを促す
    if (!session) {
        return (
            <main className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-sm text-center">
                    <p className="text-red-500 font-bold mb-4">⚠️ 受付を行うには管理者ログインが必要です</p>
                    <button
                        onClick={() => window.location.href = '/admin'}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-lg transition-all"
                    >
                        管理画面へ進んでログイン
                    </button>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans text-gray-800">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-6 text-center border-t-8 border-blue-600">

                {checkinStatus === 'success' && (
                    <div className="mb-6">
                        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-3">✓</div>
                        <h1 className="text-2xl font-bold text-green-600">受付が完了しました</h1>
                    </div>
                )}

                {checkinStatus === 'already' && (
                    <div className="mb-6">
                        <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-3">!</div>
                        <h1 className="text-xl font-bold text-amber-600">既に受付済みのチケットです</h1>
                    </div>
                )}

                {checkinStatus === 'error' && (
                    <div className="mb-6">
                        <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-3">×</div>
                        <h1 className="text-xl font-bold text-red-600">無効なチケットです</h1>
                        <p className="text-sm text-gray-500 mt-2">予約データが存在しないか、URLが不正です。</p>
                    </div>
                )}

                {studentInfo && (
                    <div className="bg-gray-50 rounded-xl p-4 text-left border border-gray-100 space-y-2 text-sm">
                        <div>
                            <span className="text-gray-400 font-semibold block text-xs">氏名</span>
                            <p className="text-base font-bold text-gray-900">
                                {studentInfo.last_name ? `${studentInfo.last_name} ${studentInfo.first_name}` : studentInfo.line_user_name}
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <span className="text-gray-400 font-semibold block text-xs">興味のある学部</span>
                                <p className="font-medium text-gray-800">{studentInfo.faculty}</p>
                            </div>
                            <div>
                                <span className="text-gray-400 font-semibold block text-xs">学科</span>
                                <p className="font-medium text-gray-800">{studentInfo.department}</p>
                            </div>
                        </div>
                        <div>
                            <span className="text-gray-400 font-semibold block text-xs font-bold text-blue-700">元の登録区分</span>
                            <p className="font-medium text-gray-800">{studentInfo.status}</p>
                        </div>
                    </div>
                )}

                <div className="mt-6 pt-4 border-t border-gray-100">
                    <button
                        onClick={() => window.close()}
                        className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2.5 rounded-lg transition-all"
                    >
                        この画面を閉じる
                    </button>
                </div>

            </div>
        </main>
    );
}

export default function CheckinPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
            <CheckinContent />
        </Suspense>
    );
}