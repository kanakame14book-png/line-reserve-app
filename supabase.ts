import { createClient } from '@supabase/supabase-js';

// Vercelとローカル（.env.local）の両方から確実に文字を引っぱってくる設定
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 【チェック用】もし万が一、鍵が空っぽのまま動いていたら強制的にエラーを出してビルドを止める
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('SupabaseのURLまたは鍵がプログラム側に正しく読み込まれていません！');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);