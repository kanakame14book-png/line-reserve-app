"use client";
import { supabase } from '../supabase';
import { useEffect, useState } from 'react';
import liff from '@line/liff';
import { PREFECTURES, FACULTY_DEPARTMENT_MAP, FACULTIES, ADMISSION_TYPES, MOTIVATION_LEVELS } from '../data/options';

// 🔹 データベースから取得する予約枠（slots）の型定義
interface Slot {
  id: string;
  start_time: string;
  capacity: number;
  reservation_count?: number; // 現在の予約数を裏でカウントして残席計算に使います
}

export default function Home() {
  const [liffError, setLiffError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  
  // 🔹 状態管理（State）の整理
  const [slots, setSlots] = useState<Slot[]>([]);              // 取得した予約枠一覧
  const [selectedSlotId, setSelectedSlotId] = useState<string>(''); // 選択された枠のID
  const [realName, setRealName] = useState('');                 // 本名
  const [realNameKana, setRealNameKana] = useState('');         // ふりがな
  const [prefecture, setPrefecture] = useState('');             // 都道府県
  const [city, setCity] = useState('');                         // 市区町村
  const [faculty, setFaculty] = useState('');                   // 学部
  const [department, setDepartment] = useState('');             // 学科
  const [attendeeCount, setAttendeeCount] = useState<number>(1); // 来場人数
  const [admissionType, setAdmissionType] = useState('');       // 入試区分
  const [motivationLevel, setMotivationLevel] = useState('');   // 志望度
  const [loading, setLoading] = useState(true);                 // 読み込み中フラグ

  // 学部が変わったときに学科をリセットする処理
  const handleFacultyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFaculty(e.target.value);
    setDepartment(''); 
  };

  useEffect(() => {
    // 1. LINE LIFFの初期化
    liff
      .init({
        liffId: '2010515590-mKz3DfbF', // ★LIFF ID
      })
      .then(() => {
        if (!liff.isLoggedIn()) {
          liff.login();
        } else {
          liff.getProfile().then((profile) => {
            setDisplayName(profile.displayName);
          });
        }
      })
      .catch((err) => {
        setLiffError(err.toString());
      });

    // 2. 🌟 Supabaseから管理者が作った「予約枠（slots）」を自動取得する
    const fetchSlotsAndReservations = async () => {
      try {
        // 予約枠を日付の古い順（昇順）に取得
        const { data: slotsData, error: slotsError } = await supabase
          .from('slots')
          .select('*')
          .order('start_time', { ascending: true });

        if (slotsError) throw slotsError;

        // 各枠の埋まり具合（現在の予約件数）を計算するために予約データを取得
        const { data: resData, error: resError } = await supabase
          .from('reservations')
          .select('slot_id');

        if (resError) throw resError;

        // 枠ごとの予約数をカウントする辞書を作成
        const counts: Record<string, number> = {};
        resData?.forEach((r) => {
          if (r.slot_id) {
            counts[r.slot_id] = (counts[r.slot_id] || 0) + 1;
          }
        });

        // 枠データに予約数を合体させてStateに保存
        const formattedSlots = (slotsData || []).map((slot: any) => ({
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

    fetchSlotsAndReservations();
  }, []);

  // 「予約を確定する」ボタンを押したときの処理
  const handleReserve = async () => {
    if (!selectedSlotId) {
      alert('予約する枠が選択されていません');
      return;
    }
    if (!realName || !realNameKana || !prefecture || !city || !faculty || !department) {
      alert('必須項目（*マーク）が入力されていません');
      return;
    }

    // 🌟 最終判定：ボタンを押した瞬間に満席になっていないかチェック
    const targetSlot = slots.find(s => s.id === selectedSlotId);
    if (targetSlot && targetSlot.reservation_count !== undefined && targetSlot.reservation_count >= targetSlot.capacity) {
      alert('申し訳ありません。タッチの差でこの枠は満席になってしまいました。別の時間をお選びください。');
      return;
    }

    try {
      // 1. 最新の構成でデータを保存する
      const { error } = await supabase
        .from('reservations')
        .insert([
          {
            line_user_name: displayName || '不明なユーザー',
            line_user_id: liff.getContext()?.userId || '不明なID',
            slot_id: selectedSlotId, 
            real_name: realName,
            real_name_kana: realNameKana,
            faculty: faculty,
            department: department,
            prefecture: prefecture,
            city: city,
            attendee_count: attendeeCount,
            admission_type: admissionType || null,
            motivation_level: motivationLevel || null,
          },
        ]);

      if (error) {
        throw new Error('データベースへの保存に失敗しました: ' + error.message);
      }

      // LINE送信用の日時文字列を作成
      const dateStr = targetSlot 
        ? new Date(targetSlot.start_time).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '';

      // 2. LINEのトーク画面にメッセージを自動送信
      const messageText = `【来場予約が確定しました】\n\n日時: ${dateStr}~\nお名前: ${realName} 様\n来場人数: ${attendeeCount} 名\n\nご来場を心よりお待ちしております！`;
      await liff.sendMessages([
        {
          type: 'text',
          text: messageText,
        },
      ]);

      // 3. 画面を閉じる
      liff.closeWindow();

    } catch (err: any) {
      alert('エラーが発生しました: ' + err.message);
    }
  };

  if (liffError) {
    return <div className="p-4 text-red-500">LIFFエラー: {liffError}</div>;
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-28 p-4 font-sans text-gray-800">
      {/* ヘッダー */}
      <header className="mb-6 text-center">
        <h1 className="text-xl font-bold text-green-600">来場予約システム</h1>
        {displayName && (
          <p className="mt-1 text-sm text-gray-600">こんにちは、{displayName} さん</p>
        )}
      </header>

      {/* 🌟 1. 予約枠の選択（古いカレンダーと固定時間を廃止し、一つに統合！） */}
      <section className="mb-6 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold text-gray-700">1. ご希望の日時を選択</h2>
        {loading ? (
          <p className="text-sm text-gray-500 text-center py-4">予約枠を読み込み中...</p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-red-500 text-center py-4">現在、公開されている予約枠がありません。</p>
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
                  className={`flex items-center justify-between rounded-lg p-3 border text-left transition-all ${
                    isFull
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      : selectedSlotId === slot.id
                      ? 'bg-green-50 border-green-500 ring-2 ring-green-500/20 text-green-900'
                      : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div>
                    <span className="font-bold mr-2">{dateStr}</span>
                    <span className="text-lg font-semibold">{timeStr} 〜</span>
                  </div>
                  <div className="text-xs font-medium">
                    {isFull ? (
                      <span className="text-red-500 font-bold bg-red-50 px-2 py-1 rounded">満席</span>
                    ) : (
                      <span className="text-gray-500 bg-gray-50 px-2 py-1 rounded">残り {remaining} 枠</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 🌟 2. 来場者情報の入力フォーム（抜けていた項目をすべて追加！） */}
      <section className="mb-6 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-700 border-b pb-2">2. 来場者情報の入力</h2>

        {/* 本名 */}
        <div className="mb-4">
          <label className="block text-sm font-bold mb-1 text-gray-600">お名前（本名） <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={realName}
            onChange={(e) => setRealName(e.target.value)}
            placeholder="山田 太郎"
            className="w-full p-2 border rounded-lg focus:outline-none focus:border-green-500"
            required
          />
        </div>

        {/* ふりがな */}
        <div className="mb-4">
          <label className="block text-sm font-bold mb-1 text-gray-600">ふりがな <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={realNameKana}
            onChange={(e) => setRealNameKana(e.target.value)}
            placeholder="やまだ たろう"
            className="w-full p-2 border rounded-lg focus:outline-none focus:border-green-500"
            required
          />
        </div>

        {/* 都道府県 */}
        <div className="mb-4">
          <label className="block text-sm font-bold mb-1 text-gray-600">お住まいの都道府県 <span className="text-red-500">*</span></label>
          <select
            value={prefecture}
            onChange={(e) => setPrefecture(e.target.value)}
            className="w-full p-2 border rounded-lg bg-white focus:outline-none focus:border-green-500"
            required
          >
            <option value="" disabled>選択してください</option>
            {PREFECTURES.map((pref) => (
              <option key={pref} value={pref}>{pref}</option>
            ))}
          </select>
        </div>

        {/* 市区町村 */}
        <div className="mb-4">
          <label className="block text-sm font-bold mb-1 text-gray-600">市区町村 <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="甲府市武田"
            className="w-full p-2 border rounded-lg focus:outline-none focus:border-green-500"
            required
          />
        </div>

        {/* 来場予定人数 */}
        <div className="mb-4">
          <label className="block text-sm font-bold mb-1 text-gray-600">来場予定人数 <span className="text-red-500">*</span></label>
          <select
            value={attendeeCount}
            onChange={(e) => setAttendeeCount(Number(e.target.value))}
            className="w-full p-2 border rounded-lg bg-white focus:outline-none focus:border-green-500"
            required
          >
            {[1, 2, 3, 4, 5].map((num) => (
              <option key={num} value={num}>{num} 名</option>
            ))}
          </select>
        </div>

        {/* 学部 */}
        <div className="mb-4">
          <label className="block text-sm font-bold mb-1 text-gray-600">興味のある学部 <span className="text-red-500">*</span></label>
          <select
            value={faculty}
            onChange={handleFacultyChange}
            className="w-full p-2 border rounded-lg bg-white focus:outline-none focus:border-green-500"
            required
          >
            <option value="" disabled>選択してください</option>
            {FACULTIES.map((fac) => (
              <option key={fac} value={fac}>{fac}</option>
            ))}
          </select>
        </div>

        {/* 学科（連動型） */}
        <div className="mb-4">
          <label className="block text-sm font-bold mb-1 text-gray-600">興味のある学科 <span className="text-red-500">*</span></label>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="w-full p-2 border rounded-lg bg-white focus:outline-none focus:border-green-500"
            required
            disabled={!faculty}
          >
            <option value="" disabled>
              {faculty ? "選択してください" : "先に学部を選択してください"}
            </option>
            {faculty && FACULTY_DEPARTMENT_MAP[faculty].map((dep) => (
              <option key={dep} value={dep}>{dep}</option>
            ))}
          </select>
        </div>

        {/* 入試区分 */}
        <div className="mb-4">
          <label className="block text-sm font-bold mb-1 text-gray-600">検討中の入試区分</label>
          <select
            value={admissionType}
            onChange={(e) => setAdmissionType(e.target.value)}
            className="w-full p-2 border rounded-lg bg-white focus:outline-none focus:border-green-500"
          >
            <option value="">選択肢にない・未定</option>
            {ADMISSION_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        {/* 志望度 */}
        <div className="mb-2">
          <label className="block text-sm font-bold mb-1 text-gray-600">現在の志望度</label>
          <select
            value={motivationLevel}
            onChange={(e) => setMotivationLevel(e.target.value)}
            className="w-full p-2 border rounded-lg bg-white focus:outline-none focus:border-green-500"
          >
            <option value="">選択肢にない・未定</option>
            {MOTIVATION_LEVELS.map((level) => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
        </div>
      </section>

      {/* 固定の予約確定ボタンエリア */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-lg z-50">
        <button
          disabled={!selectedSlotId || !realName || !realNameKana || !prefecture || !city || !faculty || !department}
          onClick={handleReserve}
          className={`w-full rounded-xl py-4 text-center font-bold text-white transition-all ${
            selectedSlotId && realName && realNameKana && prefecture && city && faculty && department
              ? 'bg-green-600 hover:bg-green-700 active:scale-95 shadow-md'
              : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          {selectedSlotId ? 'この内容で予約を確定する' : '日時と必要事項を入力してください'}
        </button>
      </div>
      <div className="h-24"></div>
    </main>
  );
}