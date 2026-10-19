// Günlük su hedefi — uygulamadaki tek hesaplama (onboarding, profil ve varsayılanlar bunu kullanır).
//
// Temel kural kilo başına 35 ml. Boy, kilonun ne kadarının hesaba katılacağını belirler:
// vücut kitle indeksi 25'in üstündeki fazla kilonun yalnızca dörtte biri sayılır (yağ dokusu
// kasa göre çok daha az su ister). Böylece 100 kg / 180 cm için ~3,6 L yerine ~3 L çıkar ve
// boy, kilo ile çifte sayılmaz. Sonuç 1.500–4.000 ml aralığında ve 50 ml'ye yuvarlanır.
// Tıbbi tavsiye değildir; kullanıcı hedefini her zaman elle değiştirebilir.

export const DEFAULT_WEIGHT = 70;
export const DEFAULT_HEIGHT = 170;

const ML_PER_KG = 35;
const MIN_GOAL = 1500;
const MAX_GOAL = 4000;

export function computeGoalMl(weightKg, heightCm) {
  const w = Number(weightKg) || DEFAULT_WEIGHT;
  const h = Number(heightCm) || DEFAULT_HEIGHT;
  const m = h / 100;
  const bmi25Weight = 25 * m * m;
  const effective = w > bmi25Weight ? bmi25Weight + (w - bmi25Weight) * 0.25 : w;
  const ml = Math.round((effective * ML_PER_KG) / 50) * 50;
  return Math.max(MIN_GOAL, Math.min(MAX_GOAL, ml));
}

export const DEFAULT_GOAL = computeGoalMl(DEFAULT_WEIGHT, DEFAULT_HEIGHT);
