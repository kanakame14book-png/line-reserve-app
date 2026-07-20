/**
 * フォーム部品の見た目。値は受領したFigmaデザインの実測値。
 * 同じ見た目を各所に書き写すと少しずつずれていくため、ここに集約する。
 */

/** 白いカード。区切り線は使わず、余白と影だけで塊を作る */
export const CARD =
    "rounded-[22px] bg-white p-5 shadow-[0_10px_24px_-14px_rgba(59,4,113,0.28),0_1px_3px_rgba(59,4,113,0.06)]";

/** 入力欄の上のラベル */
export const LABEL = "mb-2 block text-sm font-semibold text-ink";

/** select と input の共通の見た目。枠線2px・角丸14px・高さ46px */
export const FIELD =
    "h-[46px] w-full rounded-[14px] border-2 border-line bg-white px-3.5 text-[15px] text-ink " +
    "placeholder:text-ink-soft focus:border-brand-top focus:outline-none focus:ring-2 focus:ring-brand-top/20 " +
    "disabled:bg-band/40 disabled:text-ink-soft";

/** 入力内容が条件を満たしていないときに FIELD へ足す */
export const FIELD_NG = "border-ng bg-ng-soft";

/** 必須項目を示す印 */
export const REQUIRED = "text-accent";
