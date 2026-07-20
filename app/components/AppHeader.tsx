import Image from "next/image";
import mark from "../../public/guides-mark.png";

type Props = {
    /** 帯の1行目。画面の位置づけ（スタッフ用など）を添える場合はここに書く */
    eyebrow?: string;
    /** 帯の2行目。その画面の名前 */
    title: string;
};

/**
 * 3画面で共通のヘッダ帯。
 * ミント地に濃紫、右にシンボルマークという構成をここだけで持ち、
 * 各ページが個別に見出しを組まないようにする。
 */
export function AppHeader({ eyebrow = "入学準備会[GUIDEs]", title }: Props) {
    return (
        <header className="bg-band px-5 py-6 print:bg-white">
            <div className="mx-auto flex w-full max-w-md items-center justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-[13px] font-bold text-ink">{eyebrow}</p>
                    <p className="mt-1 text-2xl font-extrabold tracking-tight text-ink">{title}</p>
                </div>
                <Image
                    src={mark}
                    alt=""
                    aria-hidden="true"
                    width={74}
                    height={74}
                    priority
                    className="h-[74px] w-[74px] flex-none"
                />
            </div>
        </header>
    );
}
