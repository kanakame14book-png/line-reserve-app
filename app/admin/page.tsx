"use client";
import { supabase } from '../../supabase';
import { useEffect, useState, Suspense } from 'react';
import { Slot } from '../../data/options';

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

interface Reservation {
    id: string;
    created_at: string;
    last_name: string;
    first_name: string;
    email: string;
    phone: string;
    faculty: string;
    department: string;
    prefecture: string;
    city: string;
    status: string;
    slot_id: string;
}

function AdminContent() {
    const [session, setSession] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'users' | 'slots'>('users');

    // --- ログインフォーム用State ---
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginError, setLoginError] = useState<string | null>(null);
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    // --- 登録者一覧用State ---
    const [reservations, setReservations] = useState<Reservation[]>([]);

    // --- 予約枠作成・管理用State ---
    const [slots, setSlots] = useState<Slot[]>([]);
    const [newDate, setNewDate] = useState('');
    const [newTime, setNewTime] = useState('');
    const [capacity, setCapacity] = useState<number>(5);
    const [eventType, setEventType] = useState('対面');

    // 🌟 編集モード用のState
    const [editingSlotId, setEditingSlotId] = useState<string | null>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session) {
                fetchReservations();
                fetchSlots();
            } else {
                setLoading(false);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session) {
                fetchReservations();
                fetchSlots();
            } else {
                setReservations([]);
                setSlots([]);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchReservations = async () => {
        try {
            const { data, error } = await supabase
                .from('reservations')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            setReservations(data || []);
        } catch (err: any) {
            console.error("データ取得失敗:", err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchSlots = async () => {
        try {
            const { data, error } = await supabase
                .from('slots')
                .select('*')
                .order('start_time', { ascending: true });
            if (error) throw error;
            setSlots(data || []);
        } catch (err: any) {
            console.error('枠の取得エラー:', err.message);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoggingIn(true);
        setLoginError(null);
        const { error } = await supabase.auth.signInWithPassword({
            email: loginEmail,
            password: loginPassword,
        });
        if (error) {
            setLoginError("ログインに失敗しました。メールアドレスまたはパスワードが違います。");
            setIsLoggingIn(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    // 🌟 作成と編集（UPDATE）を兼用するハンドラー
    const handleSaveSlot = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newDate || !newTime) return;

        const startDateTime = new Date(`${newDate}T${newTime}:00`).toISOString();

        if (editingSlotId) {
            // 更新処理（UPDATE）
            const { error } = await supabase
                .from('slots')
                .update({ start_time: startDateTime, capacity: capacity, event_type: eventType })
                .eq('id', editingSlotId);

            if (error) {
                alert('枠の更新に失敗しました: ' + error.message);
            } else {
                alert('予約枠を更新しました！');
                resetForm();
                fetchSlots();
            }
        } else {
            // 新規作成処理（INSERT）
            const { error } = await supabase
                .from('slots')
                .insert([{ start_time: startDateTime, capacity: capacity, event_type: eventType }]);

            if (error) {
                alert('枠の作成に失敗しました: ' + error.message);
            } else {
                alert('新しい予約枠を作成しました！');
                resetForm();
                fetchSlots();
            }
        }
    };

    // 🌟 編集ボタンが押された時の処理（フォームにデータを詰め込む）
    const handleEditClick = (slot: Slot) => {
        const dateObj = new Date(slot.start_time);

        // YYYY-MM-DD 形式に変換
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');

        // HH:MM 形式に変換
        const hh = String(dateObj.getHours()).padStart(2, '0');
        const min = String(dateObj.getMinutes()).padStart(2, '0');

        setNewDate(`${yyyy}-${mm}-${dd}`);
        setNewTime(`${hh}:${min}`);
        setCapacity(slot.capacity);
        setEventType(slot.event_type || '対面');
        setEditingSlotId(slot.id); // 編集モードON
    };

    // フォームの入力内容をクリアする関数
    const resetForm = () => {
        setNewDate('');
        setNewTime('');
        setCapacity(5);
        setEventType('対面');
        setEditingSlotId(null); // 編集モード解除
    };

    const handleDeleteSlot = async (id: string) => {
        if (!confirm('本当にこの枠を削除しますか？')) return;
        const { error } = await supabase.from('slots').delete().eq('id', id);
        if (error) {
            alert('削除に失敗しました: ' + error.message);
        } else {
            alert('削除しました。');
            if (editingSlotId === id) resetForm();
            fetchSlots();
        }
    };

    if (loading && !session) {
        return <div className="p-8 text-center text-gray-500">システム起動中...</div>;
    }

    if (!session) {
        return (
            <main className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-md">
                    <h1 className="text-xl font-bold text-gray-900 mb-6 text-center">管理者ログイン</h1>
                    {loginError && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg font-medium">{loginError}</div>}
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-600 mb-1">メールアドレス</label>
                            <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="w-full p-2.5 border rounded-lg outline-none" placeholder="admin@example.com" required />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-600 mb-1">パスワード</label>
                            <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} className="w-full p-2.5 border rounded-lg outline-none" placeholder="••••••••" required />
                        </div>
                        <button type="submit" disabled={isLoggingIn} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg transition-all disabled:bg-gray-400">
                            {isLoggingIn ? 'ログイン中...' : 'ログイン'}
                        </button>
                    </form>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gray-100 p-6 font-sans text-gray-800">
            <header className="mb-6 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">予約・登録管理システム</h1>
                    <p className="text-sm text-gray-500 mt-1">アカウント: {session.user.email}</p>
                </div>
                <button onClick={handleLogout} className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-bold px-4 py-2 rounded-lg transition-all">
                    ログアウト
                </button>
            </header>

            <div className="flex border-b border-gray-200 mb-6 gap-2">
                <button onClick={() => setActiveTab('users')} className={`px-4 py-2.5 font-bold text-sm transition-all border-b-2 ${activeTab === 'users' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    👤 登録者一覧
                </button>
                <button onClick={() => setActiveTab('slots')} className={`px-4 py-2.5 font-bold text-sm transition-all border-b-2 ${activeTab === 'slots' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    📅 予約枠の設定
                </button>
            </div>

            {activeTab === 'users' && (
                <section className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                        <h2 className="font-semibold text-gray-700">登録者一覧 ({reservations.length}名)</h2>
                        <button onClick={fetchReservations} className="text-xs bg-white border px-3 py-1.5 rounded hover:bg-gray-50">🔄 データを更新</button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-100 text-gray-600 text-xs uppercase font-semibold border-b border-gray-200">
                                    <th className="p-3">区分</th>
                                    <th className="p-3">氏名</th>
                                    <th className="p-3">志望学部・学科</th>
                                    <th className="p-3">都道府県</th>
                                    <th className="p-3">メールアドレス</th>
                                    <th className="p-3">登録日時</th>
                                    <th className="p-3 text-center">アクション</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {reservations.length === 0 ? (
                                    <tr><td colSpan={6} className="p-8 text-center text-gray-400">登録データがまだありません。</td></tr>
                                ) : (
                                    reservations.map((res) => (
                                        <tr key={res.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-3"><span className={`px-2 py-1 rounded-md text-xs font-bold ${res.status === '本登録' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>{res.status}</span></td>
                                            <td className="p-3 font-medium text-gray-900">{res.last_name ? `${res.last_name} ${res.first_name}` : '（仮登録のため未入力）'}</td>
                                            <td className="p-3">
                                                <div className="text-gray-900">{res.faculty}</div>
                                                <div className="text-xs text-gray-500">{res.department}</div>
                                            </td>
                                            <td className="p-3 text-gray-600">{res.prefecture}</td>
                                            <td className="p-3 text-gray-600">{res.email}</td>
                                            <td className="p-3 text-xs text-gray-400">{new Date(res.created_at).toLocaleString('ja-JP')}</td>
                                            <td className="p-3 text-center">
                                                <button
                                                    onClick={() => window.open(`/admin/ticket?id=${res.id}`, '_blank')}
                                                    className="bg-white border border-gray-200 text-gray-700 font-bold text-xs px-2.5 py-1.5 rounded hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                                                >
                                                    🎫 受付票
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {activeTab === 'slots' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* 左側：入力・編集フォーム */}
                    <div className={`md:col-span-1 bg-white p-6 rounded-xl shadow-sm h-fit border transition-colors ${editingSlotId ? 'border-amber-400 ring-2 ring-amber-400/10' : 'border-transparent'}`}>
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h2 className="text-lg font-bold text-gray-800">{editingSlotId ? '📝 予約枠の編集' : '新規枠の作成'}</h2>
                            {editingSlotId && (
                                <button onClick={resetForm} className="text-xs text-gray-500 hover:text-red-500 font-medium">キャンセル</button>
                            )}
                        </div>
                        <form onSubmit={handleSaveSlot} className="flex flex-col gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-1">日付</label>
                                <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-full p-2 border rounded outline-none" required />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-1">時間</label>
                                <select value={newTime} onChange={(e) => setNewTime(e.target.value)} className="w-full p-2 border rounded bg-white outline-none" required>
                                    <option value="" disabled>選択してください</option>
                                    {TIME_OPTIONS.map((time) => <option key={time} value={time}>{time}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-1">開催形式</label>
                                <select value={eventType} onChange={(e) => setEventType(e.target.value)} className="w-full p-2 border rounded bg-white outline-none" required>
                                    <option value="対面">対面</option>
                                    <option value="オンライン">オンライン（Zoom）</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-1">定員（人数）</label>
                                <input type="number" min="1" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className="w-full p-2 border rounded outline-none" required />
                            </div>

                            {/* 🌟 状態によってボタンの色とテキストを切り替え */}
                            <button type="submit" className={`w-full font-bold py-3 rounded-lg text-white transition-colors ${editingSlotId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'
                                }`}>
                                {editingSlotId ? '変更を保存する' : '枠を追加する'}
                            </button>
                        </form>
                    </div>

                    {/* 右側：公開中の枠一覧 */}
                    <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-sm">
                        <h2 className="text-lg font-bold mb-4 border-b pb-2">公開中の予約枠</h2>
                        {slots.length === 0 ? (
                            <p className="text-gray-500">現在、公開されている枠はありません。</p>
                        ) : (
                            <ul className="flex flex-col gap-3">
                                {slots.map((slot) => {
                                    const dateObj = new Date(slot.start_time);
                                    const dateStr = dateObj.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' });
                                    const timeStr = dateObj.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
                                    const isCurrentEditing = editingSlotId === slot.id;

                                    return (
                                        <li key={slot.id} className={`flex items-center justify-between p-4 border rounded-lg transition-all ${isCurrentEditing ? 'bg-amber-50/50 border-amber-300 ring-1 ring-amber-300/30' : 'hover:bg-gray-50'
                                            }`}>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-lg font-bold text-gray-800">{dateStr} {timeStr}</p>
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${slot.event_type === 'オンライン' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {slot.event_type}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-500 mt-1">定員: {slot.capacity}名</p>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button onClick={() => handleEditClick(slot)} className="text-amber-600 hover:text-amber-800 font-bold text-sm px-3 py-1 border border-amber-200 hover:bg-amber-50 rounded">
                                                    編集
                                                </button>
                                                <button onClick={() => handleDeleteSlot(slot.id)} className="text-red-500 hover:text-red-700 font-bold text-sm px-3 py-1 border border-red-200 hover:bg-red-50 rounded">
                                                    削除
                                                </button>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </main>
    );
}

export default function AdminPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
            <AdminContent />
        </Suspense>
    );
}