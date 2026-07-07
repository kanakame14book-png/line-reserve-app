"use client";
import { supabase } from '../../supabase';
import { useEffect, useState, Suspense } from 'react';
import { Slot, FACULTIES } from '../../data/options';
import { useRouter } from 'next/navigation'; // 🌟 画面遷移用のルーターを追加

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
    last_name_kana: string;
    first_name_kana: string;
    email: string;
    phone: string;
    faculty: string;
    department: string;
    prefecture: string;
    city: string;
    status: string;
    slot_id: string;
    group_name?: string;
    attendee_count: number;
}

function AdminContent() {
    const router = useRouter(); // 🌟 追加
    const [session, setSession] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'users' | 'slots' | 'reception'>('users'); // qrを削除

    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginError, setLoginError] = useState<string | null>(null);
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const [reservations, setReservations] = useState<Reservation[]>([]);

    const [filterSlotId, setFilterSlotId] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterFaculty, setFilterFaculty] = useState<string>('all');

    const [receptionSlotId, setReceptionSlotId] = useState<string>('all');

    const [slots, setSlots] = useState<Slot[]>([]);
    const [newDate, setNewDate] = useState('');
    const [newTime, setNewTime] = useState('');
    const [capacity, setCapacity] = useState<number>(5);
    const [eventType, setEventType] = useState('対面');
    const [editingSlotId, setEditingSlotId] = useState<string | null>(null);

    const [isAssigning, setIsAssigning] = useState(false);

    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'created_at', direction: 'desc' });

    // 🌟 useEffect のコールバックから参照するため、先に宣言しておく（宣言前アクセス回避）
    const fetchReservations = async () => {
        try {
            const { data, error } = await supabase
                .from('reservations')
                .select('*');
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

    const handleSaveSlot = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newDate || !newTime) return;

        const startDateTime = new Date(`${newDate}T${newTime}:00`).toISOString();

        if (editingSlotId) {
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

    const handleEditClick = (slot: Slot) => {
        const dateObj = new Date(slot.start_time);
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        const hh = String(dateObj.getHours()).padStart(2, '0');
        const min = String(dateObj.getMinutes()).padStart(2, '0');

        setNewDate(`${yyyy}-${mm}-${dd}`);
        setNewTime(`${hh}:${min}`);
        setCapacity(slot.capacity);
        setEventType(slot.event_type || '対面');
        setEditingSlotId(slot.id);
    };

    const resetForm = () => {
        setNewDate('');
        setNewTime('');
        setCapacity(5);
        setEventType('対面');
        setEditingSlotId(null);
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

    const formatSlotTime = (slotId: string | null) => {
        if (!slotId) return '未選択';
        const slot = slots.find(s => s.id === slotId);
        if (!slot) return '不明な枠';
        const d = new Date(slot.start_time);
        return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };

    const handleAssignGroups = async (slotId: string) => {
        if (!confirm('この枠の本登録者を学部ごとに【A班・B班・C班】の3班に自動で振り分けます。\nよろしいですか？')) return;

        setIsAssigning(true);
        try {
            const targetUsers = reservations.filter(res => res.slot_id === slotId && (res.status === '本登録' || res.status === '受付済'));

            if (targetUsers.length === 0) {
                alert('この枠には対象者がいません。');
                setIsAssigning(false);
                return;
            }

            const byFaculty: Record<string, Reservation[]> = {};
            targetUsers.forEach(user => {
                if (!byFaculty[user.faculty]) byFaculty[user.faculty] = [];
                byFaculty[user.faculty].push(user);
            });

            const updates: any[] = [];
            const groupNames = ['A班', 'B班', 'C班'];

            for (const fac in byFaculty) {
                const students = byFaculty[fac];
                students.sort((a, b) => (a.department || '').localeCompare(b.department || ''));

                students.forEach((student, index) => {
                    const groupName = groupNames[index % 3];
                    updates.push(
                        supabase
                            .from('reservations')
                            .update({ group_name: groupName })
                            .eq('id', student.id)
                    );
                });
            }

            await Promise.all(updates);
            alert('班分けが完了しました！');
            fetchReservations();

        } catch (error: any) {
            alert('班分け処理中にエラーが発生しました: ' + error.message);
        } finally {
            setIsAssigning(false);
        }
    };

    const handleUpdateGroup = async (id: string, newGroup: string) => {
        try {
            const { error } = await supabase.from('reservations').update({ group_name: newGroup }).eq('id', id);
            if (error) throw error;
            setReservations(prev => prev.map(res => res.id === id ? { ...res, group_name: newGroup } : res));
        } catch (err: any) {
            alert('班の更新に失敗しました: ' + err.message);
        }
    };

    const handleUpdateAttendeeCount = async (id: string, newCount: number) => {
        try {
            const { error } = await supabase.from('reservations').update({ attendee_count: newCount }).eq('id', id);
            if (error) throw error;
            setReservations(prev => prev.map(res => res.id === id ? { ...res, attendee_count: newCount } : res));
        } catch (err: any) {
            alert('人数の更新に失敗しました: ' + err.message);
        }
    };

    const handleToggleCheckin = async (id: string, currentStatus: string) => {
        const newStatus = currentStatus === '受付済' ? '本登録' : '受付済';
        try {
            const { error } = await supabase.from('reservations').update({ status: newStatus }).eq('id', id);
            if (error) throw error;
            setReservations(prev => prev.map(res => res.id === id ? { ...res, status: newStatus } : res));
        } catch (err: any) {
            alert('ステータスの更新に失敗しました: ' + err.message);
        }
    };

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortReservations = (resList: Reservation[]) => {
        if (!sortConfig) return resList;
        return [...resList].sort((a: any, b: any) => {
            let aValue = a[sortConfig.key];
            let bValue = b[sortConfig.key];

            if (sortConfig.key === 'slot_id') {
                const slotA = slots.find(s => s.id === a.slot_id);
                const slotB = slots.find(s => s.id === b.slot_id);
                aValue = slotA ? new Date(slotA.start_time).getTime() : 0;
                bValue = slotB ? new Date(slotB.start_time).getTime() : 0;
            }
            else if (sortConfig.key === 'name') {
                aValue = a.last_name_kana || a.last_name || '';
                bValue = b.last_name_kana || b.last_name || '';
            }

            if (aValue === null || aValue === undefined) aValue = '';
            if (bValue === null || bValue === undefined) bValue = '';

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const filteredReservations = reservations.filter(res => {
        const matchSlot = filterSlotId === 'all' || (filterSlotId === 'none' ? !res.slot_id : res.slot_id === filterSlotId);
        const matchStatus = filterStatus === 'all' || res.status === filterStatus;
        const matchFaculty = filterFaculty === 'all' || res.faculty === filterFaculty;
        return matchSlot && matchStatus && matchFaculty;
    });

    const receptionReservations = reservations.filter(res => {
        const isOfficialMember = res.status === '本登録' || res.status === '受付済';
        const matchSlot = receptionSlotId === 'all' || res.slot_id === receptionSlotId;
        return isOfficialMember && matchSlot;
    });

    const sortedFilteredReservations = sortReservations(filteredReservations);
    const sortedReceptionReservations = sortReservations(receptionReservations);

    // 🌟 Issue #20対応：組数と来場人数を明確に区別するための集計
    //   ・定員（capacity）＝ 組数で満席判定（1予約=1組=1枠）
    //   ・合計人数 ＝ attendee_count の総和（当日の来場予定人数）
    const sumAttendees = (list: Reservation[]) => list.reduce((sum, r) => sum + (r.attendee_count || 0), 0);
    const totalReceptionAttendees = sumAttendees(sortedReceptionReservations);
    const totalListAttendees = sumAttendees(sortedFilteredReservations);

    // 🌟 ソート可能なテーブル見出し（TH）を作るための共通パーツ
    const SortableHeader = ({ label, sortKey, className = "p-3" }: { label: string, sortKey: string, className?: string }) => {
        const isActive = sortConfig?.key === sortKey;
        return (
            <th className={`${className} cursor-pointer hover:bg-black/5 select-none transition-colors group relative`} onClick={() => requestSort(sortKey)}>
                <div className="flex items-center gap-1">
                    {label}
                    <span className={`text-[10px] ${isActive ? 'text-blue-600' : 'text-gray-300 opacity-0 group-hover:opacity-100'}`}>
                        {isActive ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '▲▼'}
                    </span>
                </div>
            </th>
        );
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
                            <label className="block text-sm font-bold text-gray-800 mb-1">メールアドレス</label>
                            <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="w-full p-2.5 border rounded-lg outline-none text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all" placeholder="admin@example.com" required />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-800 mb-1">パスワード</label>
                            <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} className="w-full p-2.5 border rounded-lg outline-none text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all" placeholder="••••••••" required />
                        </div>
                        <button type="submit" disabled={isLoggingIn} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg transition-all disabled:bg-gray-400 mt-2">
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

            <div className="flex border-b border-gray-200 mb-6 gap-2 overflow-x-auto">
                <button onClick={() => setActiveTab('users')} className={`whitespace-nowrap px-4 py-2.5 font-bold text-sm transition-all border-b-2 ${activeTab === 'users' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    👤 登録者一覧
                </button>
                <button onClick={() => setActiveTab('slots')} className={`whitespace-nowrap px-4 py-2.5 font-bold text-sm transition-all border-b-2 ${activeTab === 'slots' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    📅 予約枠の設定
                </button>
                <button onClick={() => setActiveTab('reception')} className={`whitespace-nowrap px-4 py-2.5 font-bold text-sm transition-all border-b-2 ${activeTab === 'reception' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    📋 受付表（当日用）
                </button>
                {/* 🌟 修正：クリックしたら別ページ（/admin/scanner）に飛ぶように変更 */}
                <button onClick={() => router.push('/admin/scanner')} className={`whitespace-nowrap px-4 py-2.5 font-bold text-sm transition-all border-b-2 border-transparent text-gray-500 hover:text-gray-700`}>
                    📷 QR受付
                </button>
            </div>

            {/* 🌟 1. 登録者一覧タブ */}
            {activeTab === 'users' && (
                <section className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <h2 className="font-semibold text-gray-700 whitespace-nowrap flex items-center gap-1">
                            登録者一覧
                            <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs ml-1">{sortedFilteredReservations.length}組</span>
                            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-xs">合計 {totalListAttendees}名</span>
                        </h2>

                        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="text-sm border rounded p-1.5 bg-white text-gray-600 outline-none">
                                <option value="all">すべての状態</option>
                                <option value="本登録">本登録のみ</option>
                                <option value="受付済">受付済のみ</option>
                                <option value="仮登録">仮登録のみ</option>
                            </select>

                            <select value={filterFaculty} onChange={(e) => setFilterFaculty(e.target.value)} className="text-sm border rounded p-1.5 bg-white text-gray-600 outline-none">
                                <option value="all">すべての学部</option>
                                {FACULTIES.map(fac => <option key={fac} value={fac}>{fac}</option>)}
                            </select>

                            <select value={filterSlotId} onChange={(e) => setFilterSlotId(e.target.value)} className="text-sm border rounded p-1.5 bg-white text-gray-600 outline-none max-w-[180px]">
                                <option value="all">すべての日程</option>
                                <option value="none">日程未選択 (仮登録等)</option>
                                {slots.map(slot => (
                                    <option key={slot.id} value={slot.id}>{formatSlotTime(slot.id)}</option>
                                ))}
                            </select>

                            <button onClick={fetchReservations} className="text-xs bg-white border px-3 py-1.5 rounded hover:bg-gray-50 ml-auto md:ml-2">🔄 更新</button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                                <tr className="bg-gray-100 text-gray-600 text-xs uppercase font-semibold border-b border-gray-200">
                                    <SortableHeader label="区分" sortKey="status" />
                                    <SortableHeader label="班" sortKey="group_name" />
                                    <SortableHeader label="人数" sortKey="attendee_count" className="p-3 text-center" />
                                    <SortableHeader label="予約日時" sortKey="slot_id" />
                                    <SortableHeader label="氏名" sortKey="name" />
                                    <SortableHeader label="志望学部・学科" sortKey="faculty" />
                                    <SortableHeader label="都道府県" sortKey="prefecture" />
                                    <SortableHeader label="登録日時" sortKey="created_at" />
                                    <th className="p-3 text-center">アクション</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {sortedFilteredReservations.length === 0 ? (
                                    <tr><td colSpan={9} className="p-8 text-center text-gray-400">条件に一致するデータがありません。</td></tr>
                                ) : (
                                    sortedFilteredReservations.map((res) => (
                                        <tr key={res.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-3">
                                                <span className={`px-2 py-1 rounded-md text-xs font-bold ${res.status === '受付済' ? 'bg-green-100 text-green-700' :
                                                        res.status === '本登録' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
                                                    }`}>
                                                    {res.status}
                                                </span>
                                            </td>
                                            <td className="p-3 font-bold text-gray-700">{res.group_name || '-'}</td>
                                            <td className="p-3 text-center text-gray-700">{res.attendee_count} 名</td>
                                            <td className="p-3 font-medium text-blue-900">{formatSlotTime(res.slot_id)}</td>
                                            <td className="p-3">
                                                <div className="font-medium text-gray-900">
                                                    {res.last_name ? `${res.last_name} ${res.first_name}` : '（未入力）'}
                                                </div>
                                                {res.last_name_kana && (
                                                    <div className="text-xs text-gray-500 mt-0.5">
                                                        {res.last_name_kana} {res.first_name_kana}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-3">
                                                <div className="text-gray-900">{res.faculty}</div>
                                                <div className="text-xs text-gray-500">{res.department}</div>
                                            </td>
                                            <td className="p-3 text-gray-600">{res.prefecture}</td>
                                            <td className="p-3 text-xs text-gray-400">{new Date(res.created_at).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                                            <td className="p-3 text-center">
                                                <button
                                                    onClick={() => window.open(`/admin/ticket?id=${res.id}`, '_blank')}
                                                    className="bg-white border border-gray-200 text-gray-700 font-bold text-xs px-2.5 py-1.5 rounded hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm disabled:opacity-50"
                                                    disabled={res.status === '仮登録'}
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

            {/* 🌟 2. 受付表（当日用）タブ */}
            {activeTab === 'reception' && (
                <section className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <h2 className="font-semibold text-gray-700 whitespace-nowrap flex items-center gap-1">
                            📋 当日受付表
                            <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full text-xs ml-1">{sortedReceptionReservations.length}組</span>
                            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-xs">合計 {totalReceptionAttendees}名</span>
                        </h2>

                        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                            <span className="text-sm font-bold text-gray-500">表示する枠:</span>
                            <select value={receptionSlotId} onChange={(e) => setReceptionSlotId(e.target.value)} className="text-sm border rounded p-1.5 bg-white text-gray-600 outline-none max-w-[200px] font-bold">
                                <option value="all">すべての日程</option>
                                {slots.map(slot => (
                                    <option key={slot.id} value={slot.id}>{formatSlotTime(slot.id)}</option>
                                ))}
                            </select>
                            <button onClick={fetchReservations} className="text-xs bg-white border px-3 py-1.5 rounded hover:bg-gray-50 ml-auto md:ml-2">🔄 最新データに更新</button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[700px]">
                            <thead>
                                <tr className="bg-indigo-50 text-indigo-800 text-xs uppercase font-semibold border-b border-indigo-100">
                                    <SortableHeader label="状態" sortKey="status" className="p-3 w-28" />
                                    <SortableHeader label="班" sortKey="group_name" className="p-3 w-32" />
                                    <SortableHeader label="氏名" sortKey="name" className="p-3" />
                                    <SortableHeader label="学部・学科" sortKey="faculty" className="p-3" />
                                    <SortableHeader label="都道府県" sortKey="prefecture" className="p-3 w-24" />
                                    <SortableHeader label="人数" sortKey="attendee_count" className="p-3 text-center w-28" />
                                    <th className="p-3 text-center w-32">手動受付</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {sortedReceptionReservations.length === 0 ? (
                                    <tr><td colSpan={7} className="p-8 text-center text-gray-400">表示するデータがありません。</td></tr>
                                ) : (
                                    sortedReceptionReservations.map((res) => (
                                        <tr key={res.id} className={`transition-colors ${res.status === '受付済' ? 'bg-gray-50' : 'hover:bg-blue-50'}`}>
                                            <td className="p-3">
                                                <span className={`px-2 py-1 rounded-md text-xs font-bold ${res.status === '受付済' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    {res.status}
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                <input
                                                    type="text"
                                                    defaultValue={res.group_name || ''}
                                                    onBlur={(e) => {
                                                        if (e.target.value !== (res.group_name || '')) {
                                                            handleUpdateGroup(res.id, e.target.value);
                                                        }
                                                    }}
                                                    placeholder="未定"
                                                    className="w-full p-1.5 border border-transparent hover:border-gray-300 focus:border-blue-500 rounded bg-transparent focus:bg-white transition-all text-sm font-bold text-gray-700 outline-none"
                                                />
                                            </td>
                                            <td className="p-3">
                                                <div className="font-medium text-gray-900">
                                                    {res.last_name ? `${res.last_name} ${res.first_name}` : '（未入力）'}
                                                </div>
                                                {res.last_name_kana && (
                                                    <div className="text-xs text-gray-500 mt-0.5">
                                                        {res.last_name_kana} {res.first_name_kana}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-3">
                                                <div className="text-gray-900 font-bold">{res.faculty}</div>
                                                <div className="text-xs text-gray-500">{res.department}</div>
                                            </td>
                                            <td className="p-3 text-gray-700 font-medium">
                                                {res.prefecture}
                                            </td>
                                            <td className="p-3 text-center font-bold text-gray-700 whitespace-nowrap">
                                                <select
                                                    value={res.attendee_count}
                                                    onChange={(e) => handleUpdateAttendeeCount(res.id, Number(e.target.value))}
                                                    className="w-12 p-1 bg-transparent hover:bg-white border border-transparent hover:border-gray-300 rounded outline-none cursor-pointer text-center mr-1 transition-all"
                                                >
                                                    {[1, 2, 3, 4, 5, 6, 7].map(num => (
                                                        <option key={num} value={num}>{num}</option>
                                                    ))}
                                                </select>
                                                名
                                            </td>
                                            <td className="p-3 text-center">
                                                <button
                                                    onClick={() => handleToggleCheckin(res.id, res.status)}
                                                    className={`w-full font-bold text-xs px-3 py-2 rounded transition-all shadow-sm ${res.status === '受付済' ? 'bg-gray-200 text-gray-600 hover:bg-gray-300' : 'bg-green-600 text-white hover:bg-green-700'
                                                        }`}
                                                >
                                                    {res.status === '受付済' ? '↩ 取消' : '✓ 受付する'}
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

            {/* 🌟 3. 予約枠の設定タブ */}
            {activeTab === 'slots' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
                                <label className="block text-sm font-bold text-gray-600 mb-1">定員（組数）</label>
                                <input type="number" min="1" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className="w-full p-2 border rounded outline-none" required />
                                <p className="text-xs text-gray-400 mt-1">※満席判定は「組数」で行います（1予約=1組。人数ではありません）</p>
                            </div>

                            <button type="submit" className={`w-full font-bold py-3 rounded-lg text-white transition-colors ${editingSlotId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'
                                }`}>
                                {editingSlotId ? '変更を保存する' : '枠を追加する'}
                            </button>
                        </form>
                    </div>

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

                                    // 🌟 この枠の予約状況（組数で満席判定、人数は参考表示）Issue #20
                                    const slotReservations = reservations.filter(r => r.slot_id === slot.id);
                                    const bookedGroups = slotReservations.length;
                                    const bookedPeople = sumAttendees(slotReservations);
                                    const isFull = bookedGroups >= slot.capacity;

                                    return (
                                        <li key={slot.id} className={`flex flex-col p-4 border rounded-lg transition-all ${isCurrentEditing ? 'bg-amber-50/50 border-amber-300 ring-1 ring-amber-300/30' : 'hover:bg-gray-50'
                                            }`}>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-lg font-bold text-gray-800">{dateStr} {timeStr}</p>
                                                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${slot.event_type === 'オンライン' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                            {slot.event_type}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-gray-500 mt-1">
                                                        定員: {slot.capacity}組
                                                        <span className={`ml-2 font-medium ${isFull ? 'text-red-500' : 'text-gray-700'}`}>
                                                            （予約 {bookedGroups}/{slot.capacity}組{isFull ? '・満席' : ''} / 合計 {bookedPeople}名）
                                                        </span>
                                                    </p>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => handleEditClick(slot)} className="text-amber-600 hover:text-amber-800 font-bold text-sm px-3 py-1 border border-amber-200 hover:bg-amber-50 rounded">
                                                        編集
                                                    </button>
                                                    <button onClick={() => handleDeleteSlot(slot.id)} className="text-red-500 hover:text-red-700 font-bold text-sm px-3 py-1 border border-red-200 hover:bg-red-50 rounded">
                                                        削除
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="mt-4 pt-3 border-t border-gray-200 flex justify-end">
                                                <button
                                                    onClick={() => handleAssignGroups(slot.id)}
                                                    disabled={isAssigning}
                                                    className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 font-bold text-sm px-4 py-2 rounded transition-colors"
                                                >
                                                    👥 3班構成で自動振り分けを実行
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