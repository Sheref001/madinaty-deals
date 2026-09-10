export type ModerationResult = { allowed: true } | { allowed: false; reason: 'prohibited-content' };

// An early pre-screen; production must add classifiers, moderation and appeals.
const prohibitedTerms = [
  'drugs', 'drug', 'cocaine', 'heroin', 'fentanyl', 'marijuana', 'cannabis', 'hashish', 'weed', 'tramado',
  'مخدرات', 'مخدر', 'كوكايين', 'هيروين', 'فنتانيل', 'حشيش', 'بانجو', 'ترامادول',
  'porn', 'porno', 'pornography', 'nude', 'nudity', 'xxx', 'onlyfans', 'explicit', 'sex video',
  'اباحي', 'إباحي', 'اباحية', 'إباحية', 'عري', 'عارية', 'فيديو جنسي',
  'illegal weapon', 'firearm', 'gun for sale', 'explosive', 'قنبلة', 'سلاح غير مرخص', 'مسدس للبيع',
];

function normalize(value: string) {
  return value.toLocaleLowerCase().normalize('NFKC').replace(/[ًٌٍَُِّْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/[ى]/g, 'ي').replace(/[ؤ]/g, 'و').replace(/[ئ]/g, 'ي').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function moderateText(values: string[]): ModerationResult {
  const text = ` ${normalize(values.join(' '))} `;
  const blocked = prohibitedTerms.some((term) => text.includes(` ${normalize(term)} `));
  return blocked ? { allowed: false, reason: 'prohibited-content' } : { allowed: true };
}
