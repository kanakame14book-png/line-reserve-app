"use client";
import { supabase } from '../supabase';
import { useEffect, useState, Suspense } from 'react';
import liff from '@line/liff';
import { useSearchParams } from 'next/navigation';
import { PREFECTURES, FACULTY_DEPARTMENT_MAP, FACULTIES, ADMISSION_TYPES, MOTIVATION_LEVELS } from '../data/options';

interface Slot {
  id: string;
  start_time: string;
  capacity: number;
  reservation_count?: number;
  event_type: string;
}

function HomeContent() {
  const searchParams = useSearchParams();
  const urlStatus = searchParams.get('status');
  const isOfficial = urlStatus === 'official';
  const currentStatusText = isOfficial ? '本登録' : '仮登録';

  const [liffError, setLiffError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');

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

  useEffect(() => {
    const initApp = async () => {
      try {
        await liff.init({ liffId: '2010515590-mKz3DfbF' });
        if (!liff.isLoggedIn()) {
          liff.login();
        } else {
          const profile = await liff.getProfile();
          setDisplayName(profile.displayName);

          // 自分のデータを読み込み
          const { data } = await supabase
            .from('reservations')
            .select('*')
            .eq('line_user_id::text', liff.getContext()?.userId)
            .single();

          if (data) {
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
          }
        }
      } catch (err: any) {
        setLiffError(err.toString());
      }
    };

    const fetchSlots = async () => {
      const { data: slotsData } = await supabase.from('slots').select('*').order('start_time', { ascending: true });
      const { data: resData } = await supabase.from('reservations').select('slot_id');
      const counts: Record<string, number> = {};
      resData?.forEach(r => counts[r.slot_id] = (counts[r.slot_id] || 0) + 1);

      const now = new Date();
      setSlots((slotsData || []).filter(s => new Date(s.start_time) > now).map(s => ({ ...s, reservation_count: counts[s.id] || 0 })));
      setLoading(false);
    };

    initApp();
    fetchSlots();
  }, []);

  const handleReserve = async () => {
    if (isOfficial && !selectedSlotId) { alert('日時を選択してください'); return; }
    if (!email || !prefecture || !faculty || !department) { alert('必須項目を入力してください'); return; }

    setIsSubmitting(true);
    try {
      await supabase.from('reservations').upsert([{
        line_user_id: liff.getContext()?.userId,
        line_user_name: displayName,
        slot_id: selectedSlotId || null,
        last_name: lastName, first_name: firstName,
        last_name_kana: lastNameKana, first_name_kana: firstNameKana,
        email, phone, faculty, department, prefecture, city,
        attendee_count: attendeeCount,
        admission_type: admissionType || null,
        motivation_level: motivationLevel || null,
        status: currentStatusText
      }], { onConflict: 'line_user_id' });

      await liff.sendMessages([{ type: 'text', text: `${currentStatusText}が確定しました！` }]);
      liff.closeWindow();
    } catch (err: any) {
      alert('エラー: ' + err.message);
      setIsSubmitting(false);
    }
  };

  const isFormValid = selectedSlotId && lastName && firstName && lastNameKana && firstNameKana && email && phone && prefecture && city && faculty && department;

  if (liffError) {
    return <div className="p-4 text-red-500">LIFFエラー: {liffError}</div>;
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-28">
      <h1 className="text-xl font-bold text-center text-green-600 mb-4">{isOfficial ? '本登録フォーム' : '仮登録フォーム'}</h1>

      {isOfficial && (
        <section className="mb-6 rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold">1. ご希望の日時を選択</h2>
          {slots.map(slot => (
            <button key={slot.id} onClick={() => setSelectedSlotId(slot.id)} className={`w-full p-3 mb-2 border rounded-lg ${selectedSlotId === slot.id ? 'bg-green-100' : 'bg-white'}`}>
              {new Date(slot.start_time).toLocaleString()}
            </button>
          ))}
        </section>
      )}

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-4 font-semibold border-b pb-2">情報入力</h2>
        {isOfficial && (
          <>
            <input type="text" placeholder="姓" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full p-2 mb-2 border rounded" />
            <input type="text" placeholder="名" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full p-2 mb-2 border rounded" />
            <input type="tel" placeholder="電話番号" value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-2 mb-2 border rounded" />
          </>
        )}
        <input type="email" placeholder="メールアドレス" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-2 mb-2 border rounded" />
        {/* 他項目もここに配置 */}
      </section>

      <button onClick={handleReserve} disabled={isSubmitting} className="fixed bottom-0 left-0 right-0 p-4 bg-green-600 text-white text-center font-bold">
        {isSubmitting ? '送信中...' : `${currentStatusText}を確定する`}
      </button>
    </main>
  );
}

export default function Home() {
  return <Suspense fallback={<div>Loading...</div>}><HomeContent /></Suspense>;
}