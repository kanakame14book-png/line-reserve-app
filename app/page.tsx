"use client";
import { supabase } from '../supabase';
import { useEffect, useState, Suspense } from 'react';
import liff from '@line/liff';
import { useSearchParams } from 'next/navigation';
import { PREFECTURES, FACULTY_DEPARTMENT_MAP, FACULTIES, ADMISSION_TYPES, MOTIVATION_LEVELS, Slot } from '../data/options';

function HomeContent() {
  const searchParams = useSearchParams();
  const urlStatus = searchParams.get('status');
  const isOfficial = urlStatus === 'official';
  const currentStatusText = isOfficial ? '本登録' : '仮登録';

  const [liffError, setLiffError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [existingReservation, setExistingReservation] = useState<any>(null);

  // 🌟 メールアドレスは本登録のみ管理（初期値空文字）
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastNameKana, setLastNameKana] = useState('');
  const [firstNameKana, setFirstNameKana] = useState('');
  const [prefecture, setPrefecture] = useState('');
  const [city, setCity] = useState('');
  const [faculty, setFaculty] = useState('');
  const [department, setDepartment] = useState('');
  const [attendeeCount, setAttendeeCount] = useState<number>(1);
  const [admissionType, setAdmissionType] = useState('');
  const [motivationLevel, setMotivationLevel] = useState('');

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFacultyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFaculty(e.target.value);
    setDepartment('');
  };

  const loadMyData = async () => {
    const { data } = await supabase
      .from('reservations')
      .select('*')
      .eq('line_user_id', liff.getContext()?.userId)
      .maybeSingle();

    if (data) {
      setExistingReservation(data);
      setLastName(data.last_name || '');
      setFirstName(data.first_name || '');
      setLastNameKana(data.last_name_kana || '');
      setFirstNameKana(data.first_name_kana || '');
      setEmail(data.email || '');
      setPhone(data.phone || '');
      setPrefecture(data.prefecture || '');
      setCity(data.city || '');
      setFaculty(data.faculty || '');
      setDepartment(data.department || '');
      setSelectedSlotId(data.slot_id || '');
      // 🌟 再送信時に来場人数・入試区分・志望度が初期値へ上書きされないよう復元する
      setAttendeeCount(data.attendee_count || 1);
      setAdmissionType(data.admission_type || '');
      setMotivationLevel(data.motivation_level || '');
    } else {
      setExistingReservation(null);
    }
  };

  useEffect(() => {
    const initApp = async () => {
      try {
        await liff.init({ liffId: '2010515590-mKz3DfbF' });
        if (!liff.isLoggedIn()) {
          liff.login();
        } else {
          const profile = await liff.getProfile();
          setDisplayName(profile.displayName);
          await loadMyData();
        }
      } catch (err: any) {
        setLiffError(err.toString());
      }
    };

    const fetchSlotsAndReservations = async () => {
      try {
        const { data: slotsData, error: slotsError } = await supabase
          .from('slots')
          .select('*')
          .order('start_time', { ascending: true });

        if (slotsError) throw slotsError;

        const { data: resData, error: resError } = await supabase
          .from('reservations')
          .select('slot_id');

        if (resError) throw resError;

        const counts: Record<string, number> = {};
        resData?.forEach((r) => {
          if (r.slot_id) counts[r.slot_id] = (counts[r.slot_id] || 0) + 1;
        });

        const now = new Date();
        const formattedSlots = (slotsData || [])
          .filter((slot: any) => new Date(slot.start_time) > now)
          .map((slot: any) => ({
            ...slot,
            reservation_count: counts[slot.id] || 0,
          }));

        setSlots(formattedSlots);
      } catch (error: any) {
        console.error('予約枠の取得に失敗しました:', error.message);
      } finally {
        setLoading(false);
      }
    };

    initApp();
    fetchSlotsAndReservations();
  }, []);

  const handleCancelReservation = async () => {
    if (!confirm(`本当にこの${existingReservation.status}をキャンセルしますか？`)) return;
    setIsSubmitting(true);
    try {
      await supabase.from('reservations').delete().eq('line_user_id', liff.getContext()?.userId);
      await liff.sendMessages([{ type: 'text', text: `【${existingReservation.status}のキャンセルが完了しました】` }]);
      alert(`${existingReservation.status}をキャンセルしました。`);
      liff.closeWindow();
    } catch (err: any) {
      alert('キャンセル失敗: ' + err.message);
      setIsSubmitting(false);
    }
  };

  const handleReserve = async () => {
    // 🌟 仮登録の必須項目から email を完全に除外
    if (!prefecture || !faculty || !department) {
      alert('必須項目(*)を入力してください');
      return;
    }

    if (isOfficial) {
      if (!selectedSlotId) {
        alert('日時を選択してください');
        return;
      }
      // 🌟 本登録のときだけ email の入力を厳格にチェック
      if (!lastName || !firstName || !lastNameKana || !firstNameKana || !email || !phone || !city) {
        alert('本登録には全必須項目を入力してください');
        return;
      }
    }

    const targetSlot = slots.find(s => s.id === selectedSlotId);
    if (isOfficial && targetSlot && targetSlot.reservation_count !== undefined && targetSlot.reservation_count >= targetSlot.capacity) {
      alert('申し訳ありません。満席になってしまいました。別の時間をお選びください。');
      return;
    }

    setIsSubmitting(true);
    const cleanData = (val: string) => (val === "" ? null : val);

    try {
      // 🌟 返ってきたレコードのID（UUID）を取得できるように .select() を末尾に追加
      const { data: insertedData, error } = await supabase.from('reservations').upsert([{
        line_user_name: displayName || '不明なユーザー',
        line_user_id: liff.getContext()?.userId || '不明なID',
        slot_id: (isOfficial && selectedSlotId) ? selectedSlotId : null,
        last_name: cleanData(lastName),
        first_name: cleanData(firstName),
        last_name_kana: cleanData(lastNameKana),
        first_name_kana: cleanData(firstNameKana),
        email: cleanData(email),
        phone: cleanData(phone),
        faculty: cleanData(faculty),
        department: cleanData(department),
        prefecture: prefecture,
        city: cleanData(city),
        attendee_count: attendeeCount,
        admission_type: admissionType || null,
        motivation_level: motivationLevel || null,
        status: currentStatusText,
      }], { onConflict: 'line_user_id' }).select().single();

      if (error) throw new Error('データベースへの保存に失敗しました: ' + error.message);

      const dateStr = targetSlot
        ? new Date(targetSlot.start_time).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '';

      // 🌟 自動生成される受付票のURL（本番環境に合わせてドメイン部分は調整してください）
      const ticketUrl = `${window.location.origin}/admin/ticket?id=${insertedData.id}`;

      // 🌟 本登録確定時に、LINEトーク画面へ受付票のURLを自動で叩き込むメッセージを構成
      const messageText = isOfficial
        ? `【来場予約（本登録）が確定しました】\n\n合格おめでとうございます！🎉\n応援センターの予約を受付いたしました。\n\n形式: ${targetSlot?.event_type || '対面'}\n日時: ${dateStr}~\nお名前: ${lastName} 様\n\n👇当日の受付票はこちら（スマホでご提示ください）\n${ticketUrl}`
        : `【仮登録が確定しました】\n\nお名前: ${displayName} 様\n\n山梨大学への合格をご祈念しております！`;

      await liff.sendMessages([{ type: 'text', text: messageText }]);
      liff.closeWindow();

    } catch (err: any) {
      alert('エラーが発生しました: ' + err.message);
      setIsSubmitting(false);
    }
  };

  // 🌟 ボタンの活性化バリデーションからも仮登録時の email 縛りを解除
  const isFormValid =
    prefecture &&
    faculty &&
    department &&
    (isOfficial ? (
      selectedSlotId &&
      lastName &&
      firstName &&
      lastNameKana &&
      firstNameKana &&
      email &&
      phone &&
      city) : true);

  if (liffError) return <div className="p-4 text-red-500">LIFFエラー: {liffError}</div>;

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-28 font-sans text-gray-800">
      <header className="mb-6 text-center">
        <h1 className="text-xl font-bold text-green-600">
          {isOfficial ? '【合格者対象】本登録フォーム' : '予約フォーム（仮登録）'}
        </h1>
      </header>

      {existingReservation && (
        <section className="mb-6 rounded-xl bg-amber-50 border border-amber-200 p-4 shadow-sm flex justify-between items-center">
          <div>
            <p className="text-sm font-bold text-amber-800">すでに【{existingReservation.status}】のデータがあります</p>
            <p className="text-xs text-gray-500 mt-0.5">変更する場合は下のフォームから再送信、取り消す場合は右のボタンを押してください。</p>
          </div>
          <button onClick={handleCancelReservation} disabled={isSubmitting} className="bg-white border border-red-200 hover:bg-red-50 text-red-500 text-xs font-bold px-3 py-2 rounded-lg whitespace-nowrap transition-all shadow-sm">
            キャンセルする
          </button>
        </section>
      )}

      {isOfficial && (
        <section className="mb-6 rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold text-gray-700">1. ご希望の日時を選択</h2>
          {loading ? (
            <p className="text-sm text-gray-500 text-center py-4">予約枠を読み込み中...</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-red-500 text-center py-4">現在、受付中の予約枠がありません。</p>
          ) : (
            <div className="flex flex-col gap-2">
              {slots.map((slot) => {
                const slotDate = new Date(slot.start_time);
                const dateStr = slotDate.toLocaleDateString('ja-JP', { weekday: 'short', month: 'short', day: 'numeric' });
                const timeStr = slotDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
                const currentResCount = slot.reservation_count || 0;
                const isFull = currentResCount >= slot.capacity;
                const remaining = slot.capacity - currentResCount;

                return (
                  <button
                    key={slot.id}
                    disabled={isFull}
                    onClick={() => setSelectedSlotId(slot.id)}
                    className={`flex items-center justify-between rounded-lg p-3 border text-left transition-all ${isFull
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      : selectedSlotId === slot.id
                        ? 'bg-green-50 border-green-500 ring-2 ring-green-500/20 text-green-900'
                        : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
                      }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${slot.event_type === 'オンライン' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {slot.event_type}
                        </span>
                      </div>
                      <div>
                        <span className="font-bold mr-2">{dateStr}</span>
                        <span className="text-lg font-semibold">{timeStr} 〜</span>
                      </div>
                    </div>
                    <div className="text-xs font-medium">
                      {isFull ? <span className="text-red-500 font-bold bg-red-50 px-2 py-1 rounded">満席</span> : <span className="text-gray-500 bg-gray-50 px-2 py-1 rounded">残り {remaining} 枠</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section className="mb-6 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-700 border-b pb-2">2. 来場者情報の入力</h2>

        {/* 🌟 本登録のときだけ名前・ふりがな・電話番号・メールアドレスを表示 */}
        {isOfficial && (
          <>
            <div className="mb-4">
              <label className="block text-sm font-bold mb-1 text-gray-600">お名前 <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-2 gap-2">
                <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="山田" className="w-full p-2 border rounded-lg" required />
                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="太郎" className="w-full p-2 border rounded-lg" required />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-bold mb-1 text-gray-600">ふりがな <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-2 gap-2">
                <input type="text" value={lastNameKana} onChange={(e) => setLastNameKana(e.target.value)} placeholder="やまだ" className="w-full p-2 border rounded-lg" required />
                <input type="text" value={firstNameKana} onChange={(e) => setFirstNameKana(e.target.value)} placeholder="たろう" className="w-full p-2 border rounded-lg" required />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-bold mb-1 text-gray-600">電話番号 <span className="text-red-500">*</span></label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="090-1234-5678" className="w-full p-2 border rounded-lg" required />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-bold mb-1 text-gray-600">メールアドレス <span className="text-red-500">*</span></label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@yamanashi.ac.jp" className="w-full p-2 border rounded-lg" required />
            </div>
          </>
        )}

        <div className="mb-4">
          <label className="block text-sm font-bold mb-1 text-gray-600">お住まいの都道府県 <span className="text-red-500">*</span></label>
          <select value={prefecture} onChange={(e) => setPrefecture(e.target.value)} className="w-full p-2 border rounded-lg bg-white" required>
            <option value="" disabled>選択してください</option>
            {PREFECTURES.map((pref) => <option key={pref} value={pref}>{pref}</option>)}
          </select>
        </div>

        {isOfficial && (
          <>
            <div className="mb-4">
              <label className="block text-sm font-bold mb-1 text-gray-600">市区町村 <span className="text-red-500">*</span></label>
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="甲府市武田" className="w-full p-2 border rounded-lg" required />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-bold mb-1 text-gray-600">来場予定人数 <span className="text-red-500">*</span></label>
              <select value={attendeeCount} onChange={(e) => setAttendeeCount(Number(e.target.value))} className="w-full p-2 border rounded-lg bg-white" required>
                {[1, 2, 3, 4, 5].map((num) => <option key={num} value={num}>{num} 名</option>)}
              </select>
            </div>
          </>
        )}

        <div className="mb-4">
          <label className="block text-sm font-bold mb-1 text-gray-600">興味のある学部 <span className="text-red-500">*</span></label>
          <select value={faculty} onChange={handleFacultyChange} className="w-full p-2 border rounded-lg bg-white" required>
            <option value="" disabled>選択してください</option>
            {FACULTIES.map((fac) => <option key={fac} value={fac}>{fac}</option>)}
          </select>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-bold mb-1 text-gray-600">興味のある学科 <span className="text-red-500">*</span></label>
          <select value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full p-2 border rounded-lg bg-white" required disabled={!faculty}>
            <option value="" disabled>{faculty ? "選択してください" : "先に学部を選択してください"}</option>
            {faculty && FACULTY_DEPARTMENT_MAP[faculty].map((dep) => <option key={dep} value={dep}>{dep}</option>)}
          </select>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-bold mb-1 text-gray-600">検討中の入試区分</label>
          <select value={admissionType} onChange={(e) => setAdmissionType(e.target.value)} className="w-full p-2 border rounded-lg bg-white">
            <option value="">選択肢にない・未定</option>
            {ADMISSION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
        <div className="mb-2">
          <label className="block text-sm font-bold mb-1 text-gray-600">現在の志望度</label>
          <select value={motivationLevel} onChange={(e) => setMotivationLevel(e.target.value)} className="w-full p-2 border rounded-lg bg-white">
            <option value="">選択肢にない・未定</option>
            {MOTIVATION_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
          </select>
        </div>
      </section>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-lg z-50">
        <button
          disabled={!isFormValid || isSubmitting}
          onClick={handleReserve}
          className={`w-full rounded-xl py-4 text-center font-bold text-white transition-all ${isFormValid && !isSubmitting ? 'bg-green-600 hover:bg-green-700 active:scale-95 shadow-md' : 'bg-gray-300 cursor-not-allowed'}`}
        >
          {isSubmitting ? '予約を送信中...' : isFormValid ? `この内容で${currentStatusText}を確定する` : '日時と必要事項を入力してください'}
        </button>
      </div>
      <div className="h-24"></div>
    </main>
  );
}

export default function Home() {
  return <Suspense fallback={<div>Loading...</div>}><HomeContent /></Suspense>;
}