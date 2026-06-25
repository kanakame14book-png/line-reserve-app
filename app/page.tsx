"use client";

import { useEffect, useState } from 'react';
import liff from '@line/liff';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css'; // カレンダーの基本スタイル

export default function Home() {
  const [liffError, setLiffError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // 利用可能な時間帯のリスト
  const timeSlots = ["10:00", "11:00", "13:00", "14:00", "15:00", "16:00"];

  useEffect(() => {
    liff
      .init({
        liffId: '2010515590-mKz3DfbF', // ★後で本物のLIFF IDに書き換えます
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
  }, []);

  // カレンダーの日付がクリックされた時の処理
  const handleDateChange = (value: any) => {
    setSelectedDate(value);
    setSelectedTime(null); // 日付が変わったら時間はリセット
  };

  if (liffError) {
    return <div className="p-4 text-red-500">LIFFエラー: {liffError}</div>;
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 font-sans text-gray-800">
      {/* ヘッダー */}
      <header className="mb-6 text-center">
        <h1 className="text-xl font-bold text-green-600">来場予約システム</h1>
        {displayName && (
          <p className="mt-1 text-sm text-gray-600">こんにちは、{displayName} さん</p>
        )}
      </header>

      {/* カレンダーエリア */}
      <section className="mb-6 rounded-xl bg-white p-4 shadow-sm flex flex-col items-center">
        <h2 className="mb-3 w-full text-left font-semibold text-gray-700">1. 日付を選択</h2>
        <Calendar
          onChange={handleDateChange}
          value={selectedDate}
          locale="ja-JP"
          className="border-none rounded-lg"
        />
      </section>

      {/* 時間選択エリア */}
      {selectedDate && (
        <section className="mb-6 rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold text-gray-700">
            2. 時間を選択 ({selectedDate.toLocaleDateString('ja-JP')}）
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {timeSlots.map((time) => (
              <button
                key={time}
                onClick={() => setSelectedTime(time)}
                className={`rounded-lg py-3 text-center font-medium transition-all ${
                  selectedTime === time
                    ? 'bg-green-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {time}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 予約確定ボタン */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-lg">
        <button
          disabled={!selectedDate || !selectedTime}
          className={`w-full rounded-xl py-4 text-center font-bold text-white transition-all ${
            selectedDate && selectedTime
              ? 'bg-green-600 hover:bg-green-700 active:scale-95'
              : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          {selectedTime ? `${selectedTime} で予約を確定する` : '日時を選択してください'}
        </button>
      </div>
      <div className="h-24"></div> {/* ボタンの裏被り防止用スペース */}
    </main>
  );
}