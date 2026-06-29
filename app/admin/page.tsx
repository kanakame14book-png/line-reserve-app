"use client";
import { supabase } from '../../supabase';
import { useEffect, useState } from 'react';

interface Slot {
    id: string;
    start_time: string;
    capacity: number;
    event_type: string; // 🌟 型定義に追加
}

const generateTimeOptions = () => {
    const options = [];
    for (let h = 9; h <= 18; h++) {
        for (let m = 0; m < 60; m += 15) {
            if (h === 18 && m > 0) break;
            const hour = String(h).padStart(2, '0');
            const minute = String(m).padStart(2, '0');
            options.push(`${hour}:${minute}`);
        }
    }
    return options;
};

const TIME_OPTIONS = generateTimeOptions();

export default function AdminPage() {
    const [slots, setSlots] = useState<Slot[]>([]);
    const [newDate, setNewDate] = useState('');
    const [newTime, setNewTime] = useState('');
    const [capacity, setCapacity] = useState<number>(5);
    const [eventType, setEventType] = useState('対面'); // 🌟 形式のState（初期値：対面）
    const [loading, setLoading] = useState(true);

    const fetchSlots = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('slots')
            .select('*')
            .order('start_time', { ascending: true });

        if (error) {
            console.error('枠の取得エラー:', error.message || error);
        } else {
            setSlots(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchSlots();
    }, []);

    const handleCreateSlot = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newDate || !newTime) return;

        const startDateTime = new Date(`${newDate}T${newTime}:00`).toISOString();

        // 🌟 保存するデータに event_type を追加
        const { error } = await supabase
            .from('slots')
            .insert([
                {
                    start_time: startDateTime,
                    capacity: capacity,
                    event_type: eventType
                }
            ]);

        if (error) {
            alert('枠の作成に失敗しました: ' + error.message);
        } else {
            alert('新しい予約枠を作成しました！');
            setNewDate('');
            setNewTime('');
            setCapacity(5);
            setEventType('対面');
            fetchSlots();
        }
    };

    const handleDeleteSlot = async (id: string) => {
        if (!confirm('本当にこの枠を削除しますか？')) return;
        const { error } = await supabase.from('slots').delete().eq('id', id);
        if (error) {
            alert('削除に失敗しました: ' + error.message);
        } else {
            alert('削除しました。');
            fetchSlots();
        }
    };

    return (
        <main className="min-h-screen bg-gray-100 p-8 font-sans text-gray-800">
            <div className="max-w-4xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-2xl font-bold text-blue-700">予約管理ダッシュボード</h1>
                    <p className="text-gray-600 mt-2">来場者向けの予約枠の追加と管理を行います。</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* 左側：入力フォーム */}
                    <div className="md:col-span-1 bg-white p-6 rounded-xl shadow-sm h-fit">
                        <h2 className="text-lg font-bold mb-4 border-b pb-2">新規枠の作成</h2>
                        <form onSubmit={handleCreateSlot} className="flex flex-col gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-1">日付</label>
                                <input
                                    type="date"
                                    value={newDate}
                                    onChange={(e) => setNewDate(e.target.value)}
                                    className="w-full p-2 border rounded outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-1">時間</label>
                                <select
                                    value={newTime}
                                    onChange={(e) => setNewTime(e.target.value)}
                                    className="w-full p-2 border rounded bg-white outline-none"
                                    required
                                >
                                    <option value="" disabled>選択してください</option>
                                    {TIME_OPTIONS.map((time) => (
                                        <option key={time} value={time}>{time}</option>
                                    ))}
                                </select>
                            </div>

                            {/* 🌟 開催形式の選択を追加 */}
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-1">開催形式</label>
                                <select
                                    value={eventType}
                                    onChange={(e) => setEventType(e.target.value)}
                                    className="w-full p-2 border rounded bg-white outline-none"
                                    required
                                >
                                    <option value="対面">対面</option>
                                    <option value="オンライン">オンライン（Zoom）</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-1">定員（人数）</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={capacity}
                                    onChange={(e) => setCapacity(Number(e.target.value))}
                                    className="w-full p-2 border rounded outline-none"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                枠を追加する
                            </button>
                        </form>
                    </div>

                    {/* 右側：一覧 */}
                    <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-sm">
                        <h2 className="text-lg font-bold mb-4 border-b pb-2">公開中の予約枠</h2>
                        {loading ? (
                            <p className="text-gray-500">読み込み中...</p>
                        ) : slots.length === 0 ? (
                            <p className="text-gray-500">現在、公開されている枠はありません。</p>
                        ) : (
                            <ul className="flex flex-col gap-3">
                                {slots.map((slot) => {
                                    const dateObj = new Date(slot.start_time);
                                    const dateStr = dateObj.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' });
                                    const timeStr = dateObj.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

                                    return (
                                        <li key={slot.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-lg font-bold text-gray-800">{dateStr} {timeStr}</p>
                                                    {/* 🌟 形式のバッジを表示 */}
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${slot.event_type === 'オンライン'
                                                        ? 'bg-purple-100 text-purple-700'
                                                        : 'bg-blue-100 text-blue-700'
                                                        }`}>
                                                        {slot.event_type}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-500 mt-1">定員: {slot.capacity}名</p>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteSlot(slot.id)}
                                                className="text-red-500 hover:text-red-700 font-bold text-sm px-3 py-1 border border-red-200 hover:bg-red-50 rounded"
                                            >
                                                削除
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}