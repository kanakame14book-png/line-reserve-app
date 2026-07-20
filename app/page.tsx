"use client";
import { supabase } from '../supabase'; // データベース（Supabase）と通信するための道具
import { useEffect, useState, Suspense } from 'react'; // Reactの基本機能（状態管理と、画面表示時の処理）
import liff from '@line/liff'; // LINEアプリの中で動かすためのLINE公式ツール
import { AppHeader } from './components/AppHeader';
import { CARD, FIELD, FIELD_NG, LABEL, REQUIRED } from './components/formStyles';
import {
  NEARBY_PREFECTURES,
  OTHER_PREFECTURES,
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
  // =========================================================================
  const [liffError, setLiffError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null); // LINEの登録名
  const [slots, setSlots] = useState<Slot[]>([]); // データベースから取ってきた予約枠のリスト
  const [selectedSlotId, setSelectedSlotId] = useState<string>(''); // ユーザーが選んだ日時のID
  const [existingReservation, setExistingReservation] = useState<any>(null); // すでに予約済みかどうかのデータ

  // モード管理：ここが true なら「予約（合格後）」、false なら「登録」になる
  const [isOfficial, setIsOfficial] = useState<boolean>(false);
  const currentStatusText = isOfficial ? '予約' : '登録';

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

  // 学部が変更されたときの処理（選ばれていた学科・入試区分を一度リセットする）
  const handleFacultyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFaculty(e.target.value);
    setDepartment('');
    setAdmissionType(''); // 学部が変わったら入試区分も安全のためリセット
  };

  // 学科が変更されたときの処理
  const handleDepartmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDepartment(e.target.value);
    setAdmissionType(''); // 学科が変わったら入試区分も安全のためリセット
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
  // =========================================================================
  useEffect(() => {
    // 学部か入試区分のどちらかが空っぽなら、とりあえず「登録」にしておく
    if (!faculty || !admissionType) {
      setIsOfficial(false);
      return;
    }

    let targetDateStr = null;

    // 「その他・未定」の場合は、全日程の中で最も遅い日付を自動計算して適用する
    if (admissionType === 'その他・未定') {
      const allDateTimes = Object.values(DETAILED_ANNOUNCEMENT_DATES).map(date => new Date(date).getTime());
      const latestTime = Math.max(...allDateTimes);
      targetDateStr = new Date(latestTime).toISOString();
    } else {
      // 辞書（options.ts）から、選ばれた条件に合う「合格発表日」を探し出す
      if (department) {
        const specificKey = `${faculty}-${department}-${admissionType}`;
        targetDateStr = DETAILED_ANNOUNCEMENT_DATES[specificKey];
      }
      if (!targetDateStr) {
        const generalKey = `${faculty}-${admissionType}`;
        targetDateStr = DETAILED_ANNOUNCEMENT_DATES[generalKey];
      }
    }

    // 辞書に載っていないイレギュラーな組み合わせだった場合は登録にする
    if (!targetDateStr) {
      setIsOfficial(false);
      return;
    }

    // 現在の時刻と、辞書から見つけた合格発表の時刻を比較する
    const announcementDate = new Date(targetDateStr);
    const now = new Date();

    if (now >= announcementDate) {
      setIsOfficial(true);   // 発表日を過ぎているなら【予約モード】に切り替え
    } else {
      setIsOfficial(false);  // まだ発表日前なら【登録モード】のまま
    }
  }, [faculty, department, admissionType]);

  // =========================================================================
  // 3. 【データベース通信】 既存データの取得
  // =========================================================================
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
      setAttendeeCount(data.attendee_count || 1);
      setAdmissionType(data.admission_type || '');
      setMotivationLevel(data.motivation_level || '');
    } else {
      setExistingReservation(null);
    }
  };

  // =========================================================================
  // 4. 【初期化処理】
  // =========================================================================
  useEffect(() => {
    const initApp = async () => {
      try {
        await liff.init({ liffId: '2010635082-iQHjYAvx' });
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
          .filter((slot: any) => {
            // 前日21時を締切としてフィルターにかける
            const slotDate = new Date(slot.start_time);
            const deadline = new Date(slotDate);
            deadline.setDate(deadline.getDate() - 1);
            deadline.setHours(21, 0, 0, 0);

            // 現在時刻が締切より前であれば表示する
            return now < deadline;
          })
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

  // =========================================================================
  // 5. 【キャンセル処理】
  // =========================================================================
  const handleCancelReservation = async () => {
    if (!confirm(`本当にこの${existingReservation.status}をキャンセルしますか？`)) return;
    setIsSubmitting(true);
    try {
      await supabase.from('reservations').delete().eq('line_user_id', liff.getContext()?.userId);
      await liff.sendMessages([{ type: 'text', text: `【${existingReservation.status}のキャンセルが完了しました】` }]);
      alert(`${existingReservation.status}をキャンセルしました。`);
      liff.closeWindow();
    } catch (err: any) {
      // エラーの詳細（テーブル名や制約名を含む）は利用者に見せず、コンソールにのみ残す
      console.error('キャンセルに失敗しました:', err);
      alert('キャンセルに失敗しました。時間をおいて再度お試しください。');
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // 6. 【登録（送信）処理】
  // =========================================================================
  const handleReserve = async () => {
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
        alert('予約には全必須項目を入力してください');
        return;
      }
    }

    const targetSlot = slots.find(s => s.id === selectedSlotId);
    // 既に自分が同じ枠を予約済みの場合、再送信は upsert で更新されるだけで席は増えない。
    // reservation_count には自分の予約も含まれるため、この場合は満席チェックを免除する。
    const alreadyHoldsThisSlot = existingReservation?.slot_id === selectedSlotId;
    if (isOfficial && !alreadyHoldsThisSlot && targetSlot && targetSlot.reservation_count !== undefined && targetSlot.reservation_count >= targetSlot.capacity) {
      alert('申し訳ありません。満席になってしまいました。別の時間をお選びください。');
      return;
    }

    setIsSubmitting(true);
    const cleanData = (val: string) => (val === "" ? null : val);

    try {
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
      }], { onConflict: 'line_user_id' }).select().single();

      if (error) throw error;

      const dateStr = targetSlot
        ? new Date(targetSlot.start_time).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '';
      const ticketUrl = `${window.location.origin}/admin/ticket?id=${insertedData.id}`;

      const messageText = isOfficial
        ? `【来場予約が確定しました】\n\n合格おめでとうございます！🎉\n入学準備会の予約を受付いたしました。\n\n形式: ${targetSlot?.event_type || '対面'}\n日時: ${dateStr}~\nお名前: ${lastName} 様\n\n👇当日の受付票はこちら（スマホでご提示ください）\n${ticketUrl}`
        : `【登録が完了しました】\n\nお名前: ${displayName} 様\n\n山梨大学への合格をご祈念しております！`;

      await liff.sendMessages([{ type: 'text', text: messageText }]);
      liff.closeWindow();

    } catch (err: any) {
      // エラーの詳細（テーブル名や制約名を含む）は利用者に見せず、コンソールにのみ残す
      console.error(`${currentStatusText}の送信に失敗しました:`, err);
      alert(`${currentStatusText}の送信に失敗しました。時間をおいて再度お試しください。`);
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // 7. 【UIの表示制御・入力規則バリデーション】
  // =========================================================================

  // 入力規則の正規表現
  const isHiragana = (text: string) => /^[ぁ-んー]+$/.test(text);
  const isValidPhone = (text: string) => /^0\d{1,4}-?\d{1,4}-?\d{3,4}$/.test(text);
  const isValidEmail = (text: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);

  // いずれかの条件を満たさない場合、送信ボタンが押せなくなる
  const isFormValid =
    faculty &&
    department &&
    admissionType &&
    prefecture &&
    (isOfficial ? (
      selectedSlotId &&
      lastName &&
      firstName &&
      lastNameKana && isHiragana(lastNameKana) &&
      firstNameKana && isHiragana(firstNameKana) &&
      email && isValidEmail(email) &&
      phone && isValidPhone(phone) &&
      city) : true);

  if (liffError) return <div className="p-8 text-center font-bold text-ng">LIFFエラー: {liffError}</div>;

  // =========================================================================
  // 8. 【画面の描画（JSX）】
  // =========================================================================
  return (
    <main className="min-h-screen bg-white pb-32 text-ink">
      <AppHeader title={isOfficial ? '事前予約フォーム' : '事前登録フォーム'} />

      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-5">
        <p className="text-xs text-ink-soft">※合格発表後に自動で予約に切り替わります</p>

        {existingReservation && (
          <section className={`${CARD} flex items-center justify-between gap-3`}>
            <div className="min-w-0">
              <p className="text-sm font-bold">すでに【{existingReservation.status}】のデータがあります</p>
              <p className="mt-1 text-xs text-ink-soft">変更する場合は下のフォームから再送信、取り消す場合は右のボタンを押してください。</p>
            </div>
            <button onClick={handleCancelReservation} disabled={isSubmitting} className="flex-none rounded-[14px] border-2 border-ng/30 px-3 py-2 text-xs font-bold text-ng transition-colors hover:bg-ng-soft disabled:opacity-50">
              キャンセルする
            </button>
          </section>
        )}

        {/* 1. 志望情報 / 入学先情報（必須） */}
        <section className={CARD}>
          <h2 className="mb-4 text-[17px] font-extrabold">
            {/* 予約時は「入学予定の情報」、登録時は「志望情報」に切り替え */}
            {isOfficial ? '1. 入学予定の情報' : '1. 志望情報'}
          </h2>

          <div className="mb-4">
            <label className={LABEL}>学部 <span className={REQUIRED}>*</span></label>
            <select value={faculty} onChange={handleFacultyChange} className={FIELD} required>
              <option value="" disabled>選択してください</option>
              {FACULTIES.map((fac) => <option key={fac} value={fac}>{fac}</option>)}
            </select>
          </div>

          <div className="mb-4">
            <label className={LABEL}>学科・コース <span className={REQUIRED}>*</span></label>
            <select value={department} onChange={handleDepartmentChange} className={FIELD} required disabled={!faculty}>
              <option value="" disabled>{faculty ? "選択してください" : "先に学部を選択してください"}</option>
              {faculty && (FACULTY_DEPARTMENT_MAP[faculty] ?? []).map((dep) => <option key={dep} value={dep}>{dep}</option>)}
            </select>
          </div>

          <div>
            <label className={LABEL}>
              {/* 予約時は「合格した」、登録時は「受験（予定）の」に切り替え */}
              {isOfficial ? '合格した入試区分' : '受験（予定）の入試区分'} <span className={REQUIRED}>*</span>
            </label>
            <select
              value={admissionType}
              onChange={(e) => setAdmissionType(e.target.value)}
              className={FIELD}
              required
              disabled={!department}
            >
              <option value="" disabled>
                {!faculty
                  ? '先に学部を選択してください'
                  : !department
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

        {/* 2. 予約モードのときだけ予約枠を表示する */}
        {isOfficial && (
          <section className={`${CARD} animate-fade-in`}>
            <h2 className="text-[17px] font-extrabold">2. ご希望の日時を選択 <span className={REQUIRED}>*</span></h2>

            <p className="mt-2 mb-4 text-xs font-medium text-accent">
              ※新規予約・日時の変更は前日の21:00までです。<br />
              （やむを得ないキャンセルは直前まで可能です）
            </p>

            {loading ? (
              <p className="py-4 text-center text-sm text-ink-soft">予約枠を読み込み中...</p>
            ) : slots.length === 0 ? (
              <p className="py-4 text-center text-sm font-bold text-ng">現在、受付中の予約枠がありません。</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {slots.map((slot) => {
                  const slotDate = new Date(slot.start_time);
                  const dateStr = slotDate.toLocaleDateString('ja-JP', { weekday: 'short', month: 'short', day: 'numeric' });
                  const timeStr = slotDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
                  const currentResCount = slot.reservation_count || 0;
                  const isFull = currentResCount >= slot.capacity;
                  const remaining = slot.capacity - currentResCount;
                  const isPicked = selectedSlotId === slot.id;

                  return (
                    <button
                      key={slot.id}
                      type="button"
                      disabled={isFull}
                      onClick={() => setSelectedSlotId(slot.id)}
                      aria-pressed={isPicked}
                      className={`flex items-center justify-between rounded-[14px] border-2 p-3 text-left transition-all ${isFull
                        ? 'cursor-not-allowed border-line/50 bg-band/30 text-ink-soft'
                        : isPicked
                          ? 'border-brand-top bg-accent-soft/50 ring-2 ring-brand-top/20'
                          : 'border-line bg-white hover:bg-band/40'
                        }`}
                    >
                      <div>
                        <span className="mb-1 inline-block rounded-full bg-band px-2.5 py-0.5 text-[11px] font-bold text-ink">
                          {slot.event_type}
                        </span>
                        <div>
                          <span className="mr-2 font-bold">{dateStr}</span>
                          <span className="text-lg font-bold">{timeStr} 〜</span>
                        </div>
                      </div>
                      <span className="flex-none text-xs font-bold">
                        {/* 満席は色だけでなく文言でも分かるようにする */}
                        {isFull
                          ? <span className="rounded-full bg-ng-soft px-2.5 py-1 text-ng">満席</span>
                          : <span className="rounded-full bg-band px-2.5 py-1 text-ink">残り {remaining} 枠</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* 3. 来場者情報の入力（名前やメアドは予約のみ出現） */}
        <section className={CARD}>
          <h2 className="mb-4 text-[17px] font-extrabold">{isOfficial ? '3. 来場者情報の入力' : '2. 追加アンケート'}</h2>

          <div className="mb-4">
            <label className={LABEL}>お住まいの都道府県 <span className={REQUIRED}>*</span></label>
            <select value={prefecture} onChange={(e) => setPrefecture(e.target.value)} className={FIELD} required>
              <option value="" disabled>選択してください</option>
              <optgroup label="山梨県・隣接する都県">
                {NEARBY_PREFECTURES.map((pref) => <option key={pref} value={pref}>{pref}</option>)}
              </optgroup>
              <optgroup label="その他の都道府県">
                {OTHER_PREFECTURES.map((pref) => <option key={pref} value={pref}>{pref}</option>)}
              </optgroup>
            </select>
          </div>

          {isOfficial ? (
            <div className="animate-fade-in">
              <div className="mb-4">
                <label className={LABEL}>市区町村 <span className={REQUIRED}>*</span></label>
                <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="甲府市武田" className={FIELD} required />
              </div>

              <div className="mb-4">
                <label className={LABEL}>お名前 <span className={REQUIRED}>*</span></label>
                <div className="grid grid-cols-2 gap-2.5">
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="山田" className={FIELD} required />
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="太郎" className={FIELD} required />
                </div>
              </div>

              {/* ふりがなの入力欄（条件を満たさないときは枠線と背景で示す） */}
              <div className="mb-4">
                <label className={LABEL}>ふりがな <span className={REQUIRED}>*</span></label>
                <div className="grid grid-cols-2 gap-2.5">
                  <input type="text" value={lastNameKana} onChange={(e) => setLastNameKana(e.target.value)} placeholder="やまだ" className={`${FIELD} ${lastNameKana && !isHiragana(lastNameKana) ? FIELD_NG : ''}`} required />
                  <input type="text" value={firstNameKana} onChange={(e) => setFirstNameKana(e.target.value)} placeholder="たろう" className={`${FIELD} ${firstNameKana && !isHiragana(firstNameKana) ? FIELD_NG : ''}`} required />
                </div>
                {((lastNameKana && !isHiragana(lastNameKana)) || (firstNameKana && !isHiragana(firstNameKana))) && (
                  <p className="mt-1.5 text-xs font-medium text-ng">※ふりがなは「ひらがな」で入力してください</p>
                )}
              </div>

              {/* 電話番号の入力欄 */}
              <div className="mb-4">
                <label className={LABEL}>電話番号 <span className={REQUIRED}>*</span></label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="090-1234-5678" className={`${FIELD} ${phone && !isValidPhone(phone) ? FIELD_NG : ''}`} required />
                {phone && !isValidPhone(phone) && (
                  <p className="mt-1.5 text-xs font-medium text-ng">※正しい電話番号を半角で入力してください</p>
                )}
              </div>

              {/* メールアドレスの入力欄 */}
              <div className="mb-4">
                <label className={LABEL}>メールアドレス <span className={REQUIRED}>*</span></label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@yamanashi.ac.jp" className={`${FIELD} ${email && !isValidEmail(email) ? FIELD_NG : ''}`} required />
                {email && !isValidEmail(email) && (
                  <p className="mt-1.5 text-xs font-medium text-ng">※正しいメールアドレスを半角で入力してください</p>
                )}
              </div>

              <div>
                <label className={LABEL}>来場予定人数 <span className={REQUIRED}>*</span></label>
                <select value={attendeeCount} onChange={(e) => setAttendeeCount(Number(e.target.value))} className={FIELD} required>
                  {[1, 2, 3, 4, 5].map((num) => <option key={num} value={num}>{num} 名</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div className="animate-fade-in">
              <label className={LABEL}>現在の志望度</label>
              <select value={motivationLevel} onChange={(e) => setMotivationLevel(e.target.value)} className={FIELD}>
                <option value="">選択肢にない・未定</option>
                {MOTIVATION_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
              </select>
            </div>
          )}
        </section>
      </div>

      {/* 送信ボタンは画面下部に固定する。予約モードのフォームは長く、
          デザインどおり末尾に置くと入力中にボタンが見えなくなるため */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-line/40 bg-white/95 p-4 backdrop-blur">
        <button
          type="button"
          disabled={!isFormValid || isSubmitting}
          onClick={handleReserve}
          className={`relative mx-auto flex h-[54px] w-full max-w-md items-center justify-center rounded-[16px] text-[16px] font-bold text-white transition-all ${isFormValid && !isSubmitting ? 'bg-brand active:scale-[0.98]' : 'cursor-not-allowed bg-ink-soft'}`}
        >
          {isSubmitting ? '送信中...' : isFormValid ? `この内容で${currentStatusText}を確定する` : '必要事項を正しく入力してください'}
          {isFormValid && !isSubmitting && (
            <span aria-hidden="true" className="absolute right-3.5 grid h-[30px] w-[30px] place-items-center rounded-full bg-white text-[15px] font-bold text-ink">→</span>
          )}
        </button>
      </div>
    </main>
  );
}

export default function Home() {
  return <Suspense fallback={<div>Loading...</div>}><HomeContent /></Suspense>;
}