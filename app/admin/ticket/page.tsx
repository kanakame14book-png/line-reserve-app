"use client";
import { supabase } from '../../../supabase';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { tryCloseWindow } from '../../lib/close';
import { QrTrademark } from '../../components/QrTrademark';
import { AppHeader } from '../../components/AppHeader';
import { CARD } from '../../components/formStyles';

function TicketContent() {
    const searchParams = useSearchParams();
    const resId = searchParams.get('id'); // URLから予約IDを取得します

    const [reservation, setReservation] = useState<any>(null);
    const [slot, setSlot] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [closeHint, setCloseHint] = useState(false); // 閉じるボタンが効かない環境向け案内
    const [cancelling, setCancelling] = useState(false);
    const [cancelled, setCancelled] = useState(false);

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
                    .maybeSingle();

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

    // キャンセルは app/page.tsx の handleCancelReservation と同じく行を完全に削除する。
    // 行を残すと予約枠の空き集計や管理画面の一覧から除外する対応が別途必要になるため。
    const handleCancel = async () => {
        if (!confirm(`この${reservation.status}をキャンセルします。取り消しはできません。よろしいですか？`)) return;
        setCancelling(true);
        try {
            const { error } = await supabase.from('reservations').delete().eq('id', reservation.id);
            if (error) throw error;
            setCancelled(true);
        } catch (err) {
            // エラーの詳細（テーブル名や制約名を含む）は利用者に見せず、コンソールにのみ残す
            console.error('キャンセルに失敗しました:', err);
            alert('キャンセルに失敗しました。時間をおいて再度お試しください。');
            setCancelling(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-ink-soft">受付票を生成中...</div>;
    if (!reservation) return <div className="p-8 text-center font-bold text-ng">該当する予約データが見つかりません。</div>;

    if (cancelled) {
        return (
            <main className="min-h-screen bg-white text-ink">
                <AppHeader title="来場受付票" />
                <div className="mx-auto w-full max-w-md px-4 pt-5">
                    <div className={`${CARD} text-center`}>
                        <h1 className="mb-2 text-lg font-extrabold">キャンセルが完了しました</h1>
                        <p className="mb-6 text-sm text-ink-soft">この受付票は無効になりました。再度お申し込みいただく場合はLINEのフォームからお願いします。</p>
                        <button onClick={() => tryCloseWindow(() => setCloseHint(true))} className="bg-brand h-[46px] w-full rounded-[14px] text-sm font-bold text-white">
                            閉じる
                        </button>
                        {closeHint && (
                            <p className="mt-4 rounded-[14px] border-2 border-line bg-band/50 p-3 text-xs">
                                このタブは自動で閉じられませんでした。ブラウザ（またはLINE）の「×」ボタンで閉じてください。
                            </p>
                        )}
                    </div>
                </div>
            </main>
        );
    }

    // QRには予約ID単体を埋め込む。当日の受付は /admin/scanner のカメラで読み取り、
    // scanner側がこのIDから予約を特定して受付する（旧 /admin/checkin ページは廃止済み）。
    const qrValue = reservation.id;

    // 受付後（受付済）も予約確定者なので、予約と同様に予約日時を表示する（Issue #14）
    const isOfficial = reservation.status === '予約' || reservation.status === '受付済';

    return (
        <main className="min-h-screen bg-white text-ink">
            <AppHeader title="来場受付票" />

            <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-5 pb-10 print:gap-3 print:pt-3">
                <div className="flex items-center justify-between print:hidden">
                    <button onClick={() => tryCloseWindow(() => setCloseHint(true))} className="text-sm font-semibold text-ink-soft hover:text-ink">
                        ← 閉じる
                    </button>
                    <button onClick={handlePrint} className="bg-brand rounded-[14px] px-4 py-2.5 text-sm font-bold text-white">
                        このページを印刷 / PDF保存
                    </button>
                </div>
                {closeHint && (
                    <p className="rounded-[14px] border-2 border-line bg-band/50 p-3 text-center text-xs print:hidden">
                        このタブは自動で閉じられませんでした。ブラウザ（またはLINE）の「×」ボタンで閉じてください。
                    </p>
                )}

                {/* 印刷時は影が出ないブラウザがあるため、枠線に置き換える */}
                <div className={`${CARD} print:border print:border-line print:shadow-none`}>
                    {/* 状態は色だけでなく文言でも分かるようにする */}
                    <span className={`mb-4 inline-block rounded-full px-3 py-1 text-xs font-bold ${isOfficial ? 'bg-band text-ink' : 'bg-accent-soft text-accent'}`}>
                        {isOfficial ? `予約が確定しています（${reservation.status}）` : '登録（合格発表前）'}
                    </span>

                    <div className="flex flex-col gap-4">
                        <div>
                            <p className="text-[11px] font-bold tracking-[0.09em] text-ink-soft">お名前</p>
                            <p className="mt-0.5 text-lg font-bold">
                                {reservation.last_name ? `${reservation.last_name} ${reservation.first_name}` : `${reservation.line_user_name} 様`}
                                {reservation.last_name_kana && <span className="ml-2 text-xs font-normal text-ink-soft">({reservation.last_name_kana})</span>}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-[11px] font-bold tracking-[0.09em] text-ink-soft">志望学部</p>
                                <p className="mt-0.5 text-[15px] font-bold">{reservation.faculty}</p>
                            </div>
                            <div>
                                <p className="text-[11px] font-bold tracking-[0.09em] text-ink-soft">志望学科</p>
                                <p className="mt-0.5 text-[15px] font-bold">{reservation.department}</p>
                            </div>
                        </div>

                        {isOfficial && slot ? (
                            <div>
                                <p className="text-[11px] font-bold tracking-[0.09em] text-ink-soft">ご予約日時</p>
                                <p className="mt-0.5 text-[15px] font-bold">
                                    {new Date(slot.start_time).toLocaleString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })} 〜
                                </p>
                                <p className="mt-0.5 text-xs text-ink-soft">{slot.event_type} / {reservation.attendee_count}名</p>
                            </div>
                        ) : (
                            <div>
                                <p className="text-[11px] font-bold tracking-[0.09em] text-ink-soft">ステータス</p>
                                <p className="mt-0.5 text-[15px] font-bold">登録（合格発表前）</p>
                                <p className="mt-0.5 text-xs text-ink-soft">※予約移行時に日時が決定します。</p>
                            </div>
                        )}
                    </div>

                    {/* 破線は印刷したときの切り取り線も兼ねる */}
                    <div className="mt-5 flex flex-col items-center gap-2.5 border-t border-dashed border-line pt-5 text-center">
                        {/* QRはブラウザ内で生成する。外部APIに予約IDを送らず、オフラインでも表示できる */}
                        <QRCodeSVG value={qrValue} size={132} title="受付用QRコード" fgColor="#3b0471" className="h-[132px] w-[132px]" />
                        {/* 予約IDは端末幅が狭いと1行に収まらないため折り返しを許す */}
                        <p className="break-all text-[10.5px] tracking-[0.08em] text-ink-soft tabular-nums">ID: {reservation.id}</p>
                        <p className="text-xs font-semibold">当日はこのQRコードを受付にご提示ください</p>
                        <QrTrademark />
                    </div>
                </div>

                {/* 受付済みは来場実績が消えてしまうためキャンセルさせない */}
                {reservation.status !== '受付済' && (
                    <div className="text-center print:hidden">
                        <button onClick={handleCancel} disabled={cancelling} className="h-11 w-full rounded-[14px] border-2 border-ng/30 text-[13.5px] font-bold text-ng transition-colors hover:bg-ng-soft disabled:opacity-50">
                            {cancelling ? 'キャンセル処理中...' : `この${reservation.status}をキャンセルする`}
                        </button>
                        <p className="mt-2 text-[11px] text-ink-soft">キャンセルすると元に戻せません。</p>
                    </div>
                )}
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