"use client";
import { supabase } from '../../supabase';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function TicketContent() {
    const searchParams = useSearchParams();
    const resId = searchParams.get('id'); // URLから予約IDを取得

    const [reservation, setReservation] = useState<any>(null);
    const [slot, setSlot] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!resId) {
            setLoading(false);
            return;
        }

        const fetchTicketData = async () => {
            try {
                const { data: resData, error: resError } = await supabase
                    .from('reservations')
                    .select('*')
                    .eq('id', resId)
                    .maybeSingle(); // 🌟 安全のため maybeSingle に変更

                if (resError) throw resError;
                setReservation(resData);

                if (resData && resData.slot_id) {
                    const { data: slotData } = await supabase
                        .from('slots')
                        .select('*')
                        .eq('id', resData.slot_id)
                        .maybeSingle();
                    setSlot(slotData);
                }
            } catch (err) {
                console.error("受付票データの取得に失敗:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchTicketData();
    }, [resId]);

    const handlePrint = () => {
        window.print();
    };

    if (loading) return <div className="p-8 text-center text-gray-500">受付票を生成中...</div>;
    if (!reservation) return <div className="p-8 text-center text-red-500 font-bold">⚠️ 該当する予約データが見つかりません。</div>;

    // 🌟 より高速で安定したQRコード生成APIに変更（サイズも200x200にアップ）
    const qrValue = encodeURIComponent(`https://your-domain.com/admin/checkin?id=${reservation.id}`);
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrValue}`;

    const isOfficial = reservation.status === '本登録';

    return (
        <main className="min-h-screen bg-gray-50 py-10 px-4 flex flex-col items-center justify-start font-sans text-gray-800 print:bg-white print:py-0">

            <div className="w-full max-w-md flex justify-between mb-6 print:hidden">
                <button onClick={() => window.close()} className="text-sm text-gray-500 hover:text-gray-700 font-medium">
                    ← 閉じる
                </button>
                <button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-lg shadow-sm transition-all">
                    🖨️ このページを印刷 / PDF保存
                </button>
            </div>

            <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-sm p-6 relative print:border-0 print:shadow-none">
                <div className="absolute inset-4 border-2 border-dashed border-gray-100 pointer-events-none rounded-xl print:border-gray-300"></div>

                <div className="text-center mb-6 relative">
                    <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full mb-2 ${isOfficial ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                        来場受付票（{reservation.status}）
                    </span>
                    <h1 className="text-xl font-bold text-gray-900 tracking-wider">山梨大学 工学部</h1>
                    <p className="text-xs text-gray-400 mt-1">Orientation & Laboratory Tour</p>
                </div>

                <div className="space-y-4 border-t border-b border-gray-100 py-4 mb-6 relative print:border-gray-300">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">お名前</label>
                        <p className="text-lg font-bold text-gray-900 mt-0.5">
                            {/* 🌟 firstName のタイポを first_name に完全修正 */}
                            {reservation.last_name ? `${reservation.last_name} ${reservation.first_name}` : `${reservation.line_user_name} 様`}
                            {reservation.last_name_kana && <span className="text-xs text-gray-400 font-normal ml-2">({reservation.last_name_kana})</span>}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">志望学部</label>
                            <p className="text-sm font-semibold text-gray-800 mt-0.5">{reservation.faculty}</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">志望学科</label>
                            <p className="text-sm font-semibold text-gray-800 mt-0.5">{reservation.department}</p>
                        </div>
                    </div>

                    {isOfficial && slot ? (
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">ご予約日時</label>
                            <p className="text-sm font-bold text-blue-700 mt-0.5">
                                {new Date(slot.start_time).toLocaleString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })} 〜
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">形式: {slot.event_type} / 人数: {reservation.attendee_count}名</p>
                        </div>
                    ) : (
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">ステータス</label>
                            <p className="text-sm font-semibold text-amber-700 mt-0.5">仮登録（合格発表前）</p>
                            <p className="text-xs text-gray-400 mt-0.5">※本登録移行時に日時が決定します。</p>
                        </div>
                    )}
                </div>

                <div className="flex flex-col items-center justify-center text-center relative">
                    <div className="bg-gray-50 p-2 rounded-xl border border-gray-100 mb-2 print:bg-white print:border-gray-300">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={qrSrc} alt="Check-in QR Code" className="w-32 h-32" />
                    </div>
                    <p className="text-[10px] text-gray-400 tracking-widest">ID: {reservation.id}</p>
                    <p className="text-xs text-gray-500 mt-2 font-medium">当日はこのQRコードを受付にご提示ください</p>
                </div>

            </div>
        </main>
    );
}

export default function TicketPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
            <TicketContent />
        </Suspense>
    );
}