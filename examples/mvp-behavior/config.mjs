export const roster = ['Suki', 'Franco', 'Sid', 'Jilly', 'Laura', 'Kay', 'Cora', 'Amber']
  .map((name, i) => ({ id: name.toLowerCase(), name, sprite: `f0${i + 1}` }));
export const seats = Object.freeze({
  'ttc-1': 'jilly', 'ttc-2': 'cora', 'ttc-3': 'amber', 'ttc-4': 'franco',
  'opposite-1': 'sid', 'opposite-2': 'suki', 'opposite-3': 'laura', 'opposite-4': 'kay',
});
// 权重是可调初始值；偏好内容来自用户。
export const preferences = {
  sid: { development: 10, coffee: 1, snack: 1 },
  jilly: { work: 8, phone_scroll: 3, concert: 1, coffee: 1, snack: 1 },
  cora: { work: 5, popmart: 5, coffee: 1, snack: 1 },
  amber: { work: 5, restroom: 5, coffee: 1, snack: 1 },
  franco: { work: 5, phone_call: 6, coffee: 1, snack: 1 },
  kay: { work: 6, gym: 3, coffee: 1, snack: 1 },
  laura: { development: 10, coffee: 1, snack: 1 },
  suki: { work: 6, mixian: 4, coffee: 1, snack: 1 },
};
export const encounters = {
  'jilly:concert': 'zhu_zhixin', 'cora:popmart': 'buzz_lightyear',
  'amber:restroom': 'fuguidiao', 'kay:gym': 'tutu',
};
export const gifts = [
  { id: 'kay-morning', from: 'kay', to: 'sid', start: 540, end: 690 },
  { id: 'amber-afternoon', from: 'amber', to: 'sid', start: 840, end: 1020 },
];
export function shanghaiTime(now) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(now)).map(p => [p.type, p.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minute: Number(p.hour) * 60 + Number(p.minute) };
}
