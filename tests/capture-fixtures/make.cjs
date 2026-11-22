// Usage: node tests/capture-fixtures/make.cjs  (needs playwright), then
//        python3 tests/capture-fixtures/scanify.py tests/capture-fixtures/pages tests/capture-fixtures/scans  (needs Pillow)
// Render realistic letter pages (Arabic + English) and separator sheets as page images.
// A Python step then skews them and adds speckle noise like a real scan.
const { chromium } = require('playwright');
const QRCode = require('/home/user/crpd-app/node_modules/qrcode');
const fs = require('fs');
const OUT = __dirname + '/pages';
fs.mkdirSync(OUT, { recursive: true });

const page = (body, dir = 'rtl') => `<!doctype html><html lang="${dir === 'rtl' ? 'ar' : 'en'}" dir="${dir}"><head><meta charset="utf-8">
<style>body{margin:0;width:1240px;height:1754px;background:#fff;color:#111;font-family:'Noto Naskh Arabic','Noto Sans Arabic','Noto Sans',sans-serif}
.p{padding:110px 120px;font-size:30px;line-height:1.9}.h{text-align:center;font-size:36px;font-weight:bold}.meta{display:flex;justify-content:space-between;margin:40px 0}
table{border-collapse:collapse;width:100%;font-size:26px}td,th{border:2px solid #222;padding:8px 12px}.sep{display:flex;flex-direction:column;align-items:center;justify-content:center;height:1754px;font-size:48px;font-weight:bold}
.label{position:absolute;top:90px;left:120px;border:3px solid #000;padding:8px;text-align:center;font-size:20px}</style></head><body>${body}</body></html>`;

const letterA1 = `<div class="p"><div class="h">جمهورية العراق<br>وزارة العمل والشؤون الاجتماعية</div>
<div class="meta"><span>العدد: ع/٤٥٦٧</span><span>التاريخ: ٢٠٢٦/١١/١٠</span></div>
<p>إلى / لجنة حقوق الأشخاص ذوي الإعاقة</p><p><b>م / طلب تزويد ببيانات المستفيدين</b></p>
<p>تحية طيبة...</p><p>نرجو تزويدنا بقوائم المستفيدين من برامج التأهيل المهني للأشخاص ذوي الإعاقة في محافظة بغداد للعام الحالي، موزعة حسب نوع الإعاقة والفئة العمرية، وذلك لغرض إعداد خطة التشغيل الوطنية.</p>
<table><tr><th>الفئة</th><th>العدد التقديري</th></tr><tr><td>إعاقة حركية</td><td>1200</td></tr><tr><td>إعاقة بصرية</td><td>450</td></tr></table>
<p>مع التقدير.</p></div>`;
const letterA2 = `<div class="p" dir="ltr" style="text-align:left"><p><b>Annex 1 — Vocational rehabilitation programme</b></p>
<p>The Ministry of Labour and Social Affairs requests the list of beneficiaries of the vocational rehabilitation programme for persons with disabilities in Baghdad Governorate, grouped by type of disability and age group.</p>
<p>Please send the data in Excel format no later than 30 November 2026.</p></div>`;
const letterB = (labelQr) => `<div class="label"><img src="${labelQr}" width="150"><div dir="ltr">IN/D1-01/2026/0001</div></div>
<div class="p" style="padding-top:330px"><div class="h">منظمة الأمل للتأهيل</div><p><b>م / شكوى بخصوص الوصول إلى المباني الحكومية</b></p>
<p>نود إعلامكم بأن مداخل عدد من الدوائر الحكومية في محافظة البصرة ما زالت غير مهيأة لاستخدام الكراسي المتحركة، ونطلب متابعة الموضوع مع الجهات المعنية.</p></div>`;
const sep = (qr, title) => `<div class="sep"><img src="${qr}" width="520"><div style="margin-top:40px">${title}</div><div style="font-size:30px;font-weight:normal">ورقة فاصلة — لا تُؤرشف</div></div>`;

(async () => {
  const qrSepA = await QRCode.toDataURL('LAS1|SEP|t=IN&u=D1-01&urg=Urgent&conf=Normal&ref=' + encodeURIComponent('ع/٤٥٦٧'), { margin: 2, width: 520 });
  const qrSepB = await QRCode.toDataURL('LAS1|SEP|t=IN&u=D1-01&conf=Normal', { margin: 2, width: 520 });
  const qrLabel = await QRCode.toDataURL('LAS1|REC|IN/D1-01/2026/0001', { margin: 1, width: 150 });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1240, height: 1754 } });
  const shots = [['01-sepA', sep(qrSepA, 'وارد — قسم الشكاوى — عاجل')], ['02-letterA1', letterA1], ['03-letterA2', letterA2, 'ltr'], ['04-sepB', sep(qrSepB, 'وارد — قسم الشكاوى')], ['05-letterB', letterB(qrLabel)]];
  for (const [name, html, dir] of shots) {
    await p.setContent(page(html, dir || 'rtl'), { waitUntil: 'networkidle' });
    await p.screenshot({ path: `${OUT}/${name}.png` });
  }
  await b.close();
  console.log('pages:', fs.readdirSync(OUT).join(' '));
})();
