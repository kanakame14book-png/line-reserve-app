"use client";
import { supabase } from '../supabase'; // データベース（Supabase）と通信するための道具
import { useEffect, useState, Suspense } from 'react'; // Reactの基本機能（状態管理と、画面表示時の処理）
import liff from '@line/liff'; // LINEアプリの中で動かすためのLINE公式ツール
import {
  PREFECTURES,
  FACULTY_DEPARTMENT_MAP,
  FACULTIES,
  BASE_ADMISSION_TYPES,
  MEDICINE_DOCTOR_ADMISSION_TYPES,
  MEDICINE_NURSING_ADMISSION_TYPES,
  MOTIVATION_LEVELS,
  Slot,
  DETAILED_ANNOUNCEMENT_DATES
} from '../data/options';

function HomeContent() {
  // =========================================================================
  // 1. 【状態管理（State）】
  // Reactでは、画面上で変わる可能性のあるデータはすべて「useState」で管理します。
  // ここで設定した値が変わると、Reactが自動的に画面を最新の状態に書き換えてくれます。
  // =========================================================================
  const [liffError, setLiffError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null); // LINEの登録名
  const [slots, setSlots] = useState<Slot[]>([]); // データベースから取ってきた予約枠のリスト
  const [selectedSlotId, setSelectedSlotId] = useState<string>(''); // ユーザーが選んだ日時のID
  const [existingReservation, setExistingReservation] = useState<any>(null); // すでに予約済みかどうかのデータ

  // 🌟 モード管理：ここが true なら「本登録（合格後）」、false なら「仮登録」になる
  const [isOfficial, setIsOfficial] = useState<boolean>(false);
  const currentStatusText = isOfficial ? '本登録' : '仮登録';

  // フォームの入力項目を保存するためのState群
  const [faculty, setFaculty] = useState('');
  const [department, setDepartment] = useState('');
  const [admissionType, setAdmissionType] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastNameKana, setLastNameKana] = useState('');
  const [firstNameKana, setFirstNameKana] = useState('');
  const [prefecture, setPrefecture] = useState('');
  const [city, setCity] = useState('');
  const [attendeeCount, setAttendeeCount] = useState<number>(1);
  const [motivationLevel, setMotivationLevel] = useState('');

  const [loading, setLoading] = useState(true); // 画面読み込み中かどうか
  const [isSubmitting, setIsSubmitting] = useState(false); // ボタンを押して送信中かどうか（連打防止用）

  // 学部が変更されたときの処理（選ばれていた学科を一度リセットする）
  const handleFacultyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFaculty(e.target.value);
    setDepartment('');
  };

  // どの入試区分のリストを表示するかを動的に決定するロジック
  const getAdmissionOptions = () => {
    if (faculty === '医学部') {
      if (department === '医学科') return MEDICINE_DOCTOR_ADMISSION_TYPES;
      if (department === '看護学科') return MEDICINE_NURSING_ADMISSION_TYPES;
      return []; // 学部が医学部でも、学科がまだ未選択なら選択肢は空にする
    }
    // 医学部以外（工学部など）は通常の共通リストを返す
    return BASE_ADMISSION_TYPES;
  };

  const currentOptions = getAdmissionOptions();

  // =========================================================================
  // 2. 【自動切り替えロジック】 (useEffect)
  // useEffectは「特定のデータが変わったときに、自動で実行したい処理」を書く場所です。
  // 最後の配列 [faculty, department, admissionType] に入っている値のどれかが変わるたびに、この中のコードが走ります。
  // =========================================================================
  useEffect(() => {
    // 学部か入試区分のどちらかが空っぽなら、とりあえず「仮登録」にしておく
    if (!faculty || !admissionType) {
      setIsOfficial(false);
      return;
    }

    let targetDateStr = null;

    // 辞書（options.ts）から、選ばれた条件に合う「合格発表日」を探し出す
    if (department) {
      const specificKey = `${faculty}-${department}-${admissionType}`;
      targetDateStr = DETAILED_ANNOUNCEMENT_DATES[specificKey];
    }
    if (!targetDateStr) {
      const generalKey = `${faculty}-${admissionType}`;
      targetDateStr = DETAILED_ANNOUNCEMENT_DATES[generalKey];
    }

    // 辞書に載っていないイレギュラーな組み合わせだった場合は仮登録にする
    if (!targetDateStr) {
      setIsOfficial(false);
      return;
    }

    // 現在の時刻と、辞書から見つけた合格発表の時刻を比較する
    const announcementDate = new Date(targetDateStr);
    const now = new Date();

    if (now >= announcementDate) {
      setIsOfficial(true);   // 発表日を過ぎているなら【本登録モード】に切り替え！
    } else {
      setIsOfficial(false);  // まだ発表日前なら【仮登録モード】のまま！
    }
  }, [faculty, department, admissionType]);

  // =========================================================================
  // 3. 【データベース通信】 既存データの取得
  // すでに過去に予約している学生が再度開いたときのために、以前のデータを引っ張ってきます。
  // =========================================================================
  const loadMyData = async () => {
    // supabaseに対して「reservationsテーブルから、自分のLINE IDと一致するデータを1件ちょうだい」とお願いする
    const { data } = await supabase
      .from('reservations')
      .select('*')
      .eq('line_user_id', liff.getContext()?.userId)
      .maybeSingle();

    if (data) {
      // 過去のデータが見つかったら、Stateにセットして画面の入力欄を埋める
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
      setAttendeeCount(data.attendee_count || 1);
      setAdmissionType(data.admission_type || '');
      setMotivationLevel(data.motivation_level || '');
    } else {
      setExistingReservation(null);
    }
  };

  // =========================================================================
  // 4. 【初期化処理】 画面が開いた瞬間に1回だけ実行される処理
  // 空の配列 [] を渡すことで、「最初の一回だけ」という指示になります。
  // =========================================================================
  useEffect(() => {
    const initApp = async () => {
      try {
        // LINEアプリ（LIFF）を起動する
        await liff.init({ liffId: '2010515590-mKz3DfbF' });
        if (!liff.isLoggedIn()) {
          liff.login(); // ログインしていなければログイン画面へ
        } else {
          // ログインしていれば、LINEの名前を取得して、過去の予約データを読み込む
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
        // 予約枠（slotsテーブル）を時間順に並べて全部持ってくる
        const { data: slotsData, error: slotsError } = await supabase
          .from('slots')
          .select('*')
          .order('start_time', { ascending: true });

        if (slotsError) throw slotsError;

        // 次に予約データ（reservationsテーブル）を持ってきて、枠ごとに何人予約しているか数える
        const { data: resData, error: resError } = await supabase
          .from('reservations')
          .select('slot_id');

        if (resError) throw resError;

        const counts: Record<string, number> = {};
        resData?.forEach((r) => {
          if (r.slot_id) counts[r.slot_id] = (counts[r.slot_id] || 0) + 1;
        });

        const now = new Date();
        // 過去の時間は除外（filter）し、現在予約されている人数（reservation_count）を付け足す（map）
        const formattedSlots = (slotsData || [])
          .filter((slot: any) => new Date(slot.start_time) > now)
          .map((slot: any) => ({
            ...slot,
            reservation_count: counts[slot.id] || 0,
          }));

        setSlots(formattedSlots); // 完成した予約枠データを画面にセット！
      } catch (error: any) {
        console.error('予約枠の取得に失敗しました:', error.message);
      } finally {
        setLoading(false); // データが全部揃ったら、ローディング（ぐるぐる）を消す
      }
    };

    initApp();
    fetchSlotsAndReservations();
  }, []);

  // =========================================================================
  // 5. 【キャンセル処理】
  // データベースから自分のデータを削除し、LINEに通知を送る
  // =========================================================================
  const handleCancelReservation = async () => {
    if (!confirm(`本当にこの${existingReservation.status}をキャンセルしますか？`)) return;
    setIsSubmitting(true);
    try {
      // データベース（reservationsテーブル）の「line_user_id が自分のもの」を削除（delete）する
      await supabase.from('reservations').delete().eq('line_user_id', liff.getContext()?.userId);
      // LINEのトーク画面にメッセージを送る
      await liff.sendMessages([{ type: 'text', text: `【${existingReservation.status}のキャンセルが完了しました】` }]);
      alert(`${existingReservation.status}をキャンセルしました。`);
      liff.closeWindow(); // LIFF画面を閉じる
    } catch (err: any) {
      alert('キャンセル失敗: ' + err.message);
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // 6. 【登録（送信）処理】
  // =========================================================================
  const handleReserve = async () => {
    // --- バリデーション（入力漏れチェック） ---
    if (!prefecture || !faculty || !department || !admissionType) {
      alert('必須項目(*)を入力してください');
      return;
    }

    if (isOfficial) {
      if (!selectedSlotId) {
        alert('日時を選択してください');
        return;
      }
      if (!lastName || !firstName || !lastNameKana || !firstNameKana || !email || !phone || !city) {
        alert('本登録には全必須項目を入力してください');
        return;
      }
    }

    // 予約枠の満席チェック（本登録の場合のみ）
    const targetSlot = slots.find(s => s.id === selectedSlotId);
    if (isOfficial && targetSlot && targetSlot.reservation_count !== undefined && targetSlot.reservation_count >= targetSlot.capacity) {
      alert('申し訳ありません。満席になってしまいました。別の時間をお選びください。');
      return;
    }

    setIsSubmitting(true); // 送信中状態にしてボタンを押せなくする
    const cleanData = (val: string) => (val === "" ? null : val);

    try {
      // --- データベースへの保存（upsert = なければ新規作成、あれば上書き更新） ---
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
        admission_type: admissionType,
        motivation_level: isOfficial ? null : cleanData(motivationLevel),
        status: currentStatusText,
      }], { onConflict: 'line_user_id' }).select().single(); // select().single() で保存されたデータをすぐ受け取る

      if (error) throw new Error('データベースへの保存に失敗しました: ' + error.message);

      // --- LINE送信用のメッセージ作り ---
      const dateStr = targetSlot
        ? new Date(targetSlot.start_time).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '';
      const ticketUrl = `${window.location.origin}/admin/ticket?id=${insertedData.id}`;

      const messageText = isOfficial
        ? `【来場予約（本登録）が確定しました】\n\n合格おめでとうございます！🎉\n応援センターの予約を受付いたしました。\n\n形式: ${targetSlot?.event_type || '対面'}\n日時: ${dateStr}~\nお名前: ${lastName} 様\n\n👇当日の受付票はこちら（スマホでご提示ください）\n${ticketUrl}`
        : `【仮登録が確定しました】\n\nお名前: ${displayName} 様\n\n山梨大学への合格をご祈念しております！`;

      // LINEにメッセージを投下して画面を閉じる
      await liff.sendMessages([{ type: 'text', text: messageText }]);
      liff.closeWindow();

    } catch (err: any) {
      alert('エラーが発生しました: ' + err.message);
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // 7. 【UIの表示制御】 送信ボタンを押せるかどうかの判定
  // ここで isFormValid が true になれば、一番下のボタンが緑色になって押せるようになります。
  // =========================================================================
  const isFormValid =
    faculty &&
    department &&
    admissionType &&
    prefecture &&
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

  // =========================================================================
  // 8. 【画面の描画（JSX）】
  // ここから下の return (...) の中身が、実際にスマホの画面に表示されるデザイン部分です。
  // {} で囲むことで、JavaScriptの変数や、if文（三項演算子 ? : ）を使うことができます。
  // =========================================================================
  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-28 font-sans text-gray-800">
      <header className="mb-6 text-center">
        <h1 className="text-xl font-bold text-green-600">
          {/* isOfficial が trueなら左側を、falseなら右側の文字を表示する */}
          {isOfficial ? '【合格者対象】本登録フォーム' : '予約フォーム（仮登録）'}
        </h1>
        <p className="text-xs text-gray-500 mt-1">※合格発表後に自動で本登録に切り替わります</p>
      </header>

      {/* 過去に予約がある（existingReservation にデータが入っている）場合のみ、この黄色いボックスを表示する（&& の右側を描画） */}
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

      {/* 🌟 1. 判定に必要な項目を一番上に配置（必ず表示） */}
      <section className="mb-6 rounded-xl bg-white p-4 shadow-sm border-l-4 border-blue-500">
        <h2 className="mb-4 font-semibold text-gray-700 border-b pb-2">1. 志望情報（必須）</h2>
        <div className="mb-4">
          <label className="block text-sm font-bold mb-1 text-gray-600">学部 <span className="text-red-500">*</span></label>
          <select value={faculty} onChange={handleFacultyChange} className="w-full p-2 border rounded-lg bg-white" required>
            <option value="" disabled>選択してください</option>
            {FACULTIES.map((fac) => <option key={fac} value={fac}>{fac}</option>)}
          </select>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-bold mb-1 text-gray-600">学科 <span className="text-red-500">*</span></label>
          {/* 学部が選ばれていないときは disabled にして触れなくする */}
          <select value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full p-2 border rounded-lg bg-white" required disabled={!faculty}>
            <option value="" disabled>{faculty ? "選択してください" : "先に学部を選択してください"}</option>
            {/* ?? [] を付けることで、データが見つからなかったときにエラーで画面が落ちるのを防ぐ安全策 */}
            {faculty && (FACULTY_DEPARTMENT_MAP[faculty] ?? []).map((dep) => <option key={dep} value={dep}>{dep}</option>)}
          </select>
        </div>
        <div className="mb-2">
          <label className="block text-sm font-bold mb-1 text-gray-600">
            受験（予定）の入試区分 <span className="text-red-500">*</span>
          </label>
          <select
            value={admissionType}
            onChange={(e) => setAdmissionType(e.target.value)}
            className="w-full p-2 border rounded-lg bg-white"
            required
            disabled={!faculty || (faculty === '医学部' && !department)} // 🌟医学部の時は学科を選ぶまでロック
          >
            <option value="" disabled>
              {!faculty
                ? '先に学部を選択してください'
                : faculty === '医学部' && !department
                  ? '先に学科を選択してください'
                  : '選択してください'}
            </option>
            {currentOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* 🌟 2. 本登録モードのときだけ予約枠を表示する */}
      {isOfficial && (
        <section className="mb-6 rounded-xl bg-white p-4 shadow-sm animate-fade-in">
          <h2 className="mb-3 font-semibold text-gray-700">2. ご希望の日時を選択 <span className="text-red-500">*</span></h2>
          {loading ? (
            <p className="text-sm text-gray-500 text-center py-4">予約枠を読み込み中...</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-red-500 text-center py-4">現在、受付中の予約枠がありません。</p>
          ) : (
            <div className="flex flex-col gap-2">
              {/* slots（予約枠のリスト）を map を使って繰り返しボタンとして描画する */}
              {slots.map((slot) => {
                const slotDate = new Date(slot.start_time);
                const dateStr = slotDate.toLocaleDateString('ja-JP', { weekday: 'short', month: 'short', day: 'numeric' });
                const timeStr = slotDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
                const currentResCount = slot.reservation_count || 0;
                const isFull = currentResCount >= slot.capacity;
                const remaining = slot.capacity - currentResCount;

                return (
                  <button
                    key={slot.id} // 繰り返し要素には必ず一意の key を付けるのがReactのルール
                    disabled={isFull}
                    onClick={() => setSelectedSlotId(slot.id)}
                    // 選択中か、満席かによってボタンの見た目（CSS）を動的に変える
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

      {/* 🌟 3. 来場者情報の入力（名前やメアドは本登録のみ出現） */}
      <section className="mb-6 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-700 border-b pb-2">{isOfficial ? '3. 来場者情報の入力' : '2. 追加アンケート'}</h2>

        <div className="mb-4">
          <label className="block text-sm font-bold mb-1 text-gray-600">お住まいの都道府県 <span className="text-red-500">*</span></label>
          <select value={prefecture} onChange={(e) => setPrefecture(e.target.value)} className="w-full p-2 border rounded-lg bg-white" required>
            <option value="" disabled>選択してください</option>
            {PREFECTURES.map((pref) => <option key={pref} value={pref}>{pref}</option>)}
          </select>
        </div>

        {/* if-else のように三項演算子（? :）を使って、本登録なら入力項目を、仮登録なら志望度アンケートを描画する */}
        {isOfficial ? (
          <div className="animate-fade-in">
            <div className="mb-4">
              <label className="block text-sm font-bold mb-1 text-gray-600">市区町村 <span className="text-red-500">*</span></label>
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="甲府市武田" className="w-full p-2 border rounded-lg" required />
            </div>
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
            <div className="mb-4">
              <label className="block text-sm font-bold mb-1 text-gray-600">来場予定人数 <span className="text-red-500">*</span></label>
              <select value={attendeeCount} onChange={(e) => setAttendeeCount(Number(e.target.value))} className="w-full p-2 border rounded-lg bg-white" required>
                {[1, 2, 3, 4, 5].map((num) => <option key={num} value={num}>{num} 名</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div className="mb-2 animate-fade-in">
            <label className="block text-sm font-bold mb-1 text-gray-600">現在の志望度</label>
            <select value={motivationLevel} onChange={(e) => setMotivationLevel(e.target.value)} className="w-full p-2 border rounded-lg bg-white">
              <option value="">選択肢にない・未定</option>
              {MOTIVATION_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
            </select>
          </div>
        )}
      </section>

      {/* 画面下部に固定（fixed）される送信ボタン */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-lg z-50">
        <button
          disabled={!isFormValid || isSubmitting}
          onClick={handleReserve}
          className={`w-full rounded-xl py-4 text-center font-bold text-white transition-all ${isFormValid && !isSubmitting ? 'bg-green-600 hover:bg-green-700 active:scale-95 shadow-md' : 'bg-gray-300 cursor-not-allowed'}`}
        >
          {isSubmitting ? '予約を送信中...' : isFormValid ? `この内容で${currentStatusText}を確定する` : '必要事項を入力してください'}
        </button>
      </div>
      <div className="h-24"></div>
    </main>
  );
}

export default function Home() {
  return <Suspense fallback={<div>Loading...</div>}><HomeContent /></Suspense>;
}