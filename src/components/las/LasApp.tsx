// Letters Archive System — application shell: navigation, keyboard shortcuts, language,
// accessibility preferences (font size, high contrast, digits) and the shared data context.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Inbox, FileInput, FileOutput, ScrollText, FileBarChart, Search, BarChart3, Settings, ShieldCheck, ArrowRight, Accessibility } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { LasContext, LasState, Me, Unit, las, Notice, Btn, Modal, Field, inputCls } from './ui';
import { IncomingForm, OutgoingForm, MutalaaForm, ReportForm } from './Forms';
import { LetterDetail } from './LetterDetail';
import { InboxView, ArchiveView, StatsView, AdminView, AuditView } from './Views';

type View = 'inbox' | 'incoming' | 'outgoing' | 'mutalaa' | 'report' | 'archive' | 'stats' | 'admin' | 'audit';
interface Prefs { fontScale: number; highContrast: boolean; westernDigits: boolean }
const PREFS_KEY = 'las_prefs_v1';
const readPrefs = (): Prefs => {
  try { return { fontScale: 100, highContrast: false, westernDigits: true, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; } catch { return { fontScale: 100, highContrast: false, westernDigits: true }; }
};

/** High-contrast theme and focus styles (AR-4, AR-5). Scoped to the archive only. */
const STYLE = `
.las-root :focus-visible { outline: 3px solid #1d4ed8; outline-offset: 2px; }
.las-hc, .las-hc .las-card, .las-hc.las-dialog { background: #fff !important; color: #000 !important; }
.las-hc .las-card, .las-hc .las-input, .las-hc .las-btn, .las-hc table, .las-hc th, .las-hc td, .las-hc fieldset, .las-hc li { border-color: #000 !important; }
.las-hc .las-input { background: #fff !important; color: #000 !important; border-width: 2px; }
.las-hc .text-slate-700, .las-hc .text-slate-600, .las-hc .text-slate-500 { color: #000 !important; }
.las-hc .las-btn { border-width: 2px; }
.las-hc a, .las-hc .underline { text-decoration: underline !important; }
.las-hc :focus-visible { outline: 4px solid #000; outline-offset: 2px; box-shadow: 0 0 0 7px #ffd400; }
@media (prefers-reduced-motion: reduce) { .las-root * { transition: none !important; animation: none !important; } }
`;

export function LasApp({ onBackToMetro }: { onBackToMetro: () => void }) {
  const { language } = useLanguage();
  const lang: 'ar' | 'en' = language === 'en' ? 'en' : 'ar';
  const ar = lang === 'ar';
  const tr = useCallback((a: string, e: string) => (ar ? a : e), [ar]);
  const [prefs, setPrefs] = useState<Prefs>(readPrefs);
  const [data, setData] = useState<{ me: Me; units: Unit[]; categories: any[]; contacts: any[]; users: any[] } | null>(null);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState<View>('inbox');
  const [openId, setOpenId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [focusSearch, setFocusSearch] = useState(0);
  const [flash, setFlash] = useState('');
  const [live, setLive] = useState('');
  const [showPrefs, setShowPrefs] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  const reload = useCallback(async () => {
    const [me, units, categories, contacts, users] = await Promise.all([las('/me'), las('/units'), las('/categories'), las('/contacts'), las('/users')]);
    if (!me.ok) { setLoadError(me.error || 'error'); return; }
    setLoadError('');
    setData({ me: me.data, units: units.data || [], categories: categories.data || [], contacts: contacts.data || [], users: users.data || [] });
  }, []);
  useEffect(() => { reload(); }, [reload]);
  // The previous archive screen stored sample documents in the browser; remove them.
  useEffect(() => { try { localStorage.removeItem('pwdsnapp_archived_docs_v1'); } catch { /* storage unavailable */ } }, []);

  // Preferences: saved per browser; font size scales the whole page (rem-based) while the archive is open.
  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    const root = document.documentElement;
    const before = root.style.fontSize;
    root.style.fontSize = `${prefs.fontScale}%`;
    return () => { root.style.fontSize = before; };
  }, [prefs]);

  const go = useCallback((v: View) => { setView(v); setFlash(''); requestAnimationFrame(() => mainRef.current?.focus()); }, []);
  // Keyboard shortcuts (AR-1): Alt+I inbox, Alt+N new incoming, Alt+O new outgoing, Alt+S search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const k = e.key.toLowerCase();
      if (k === 'i') { e.preventDefault(); go('inbox'); }
      if (k === 'n') { e.preventDefault(); go('incoming'); }
      if (k === 'o') { e.preventDefault(); go('outgoing'); }
      if (k === 's') { e.preventDefault(); go('archive'); setFocusSearch(x => x + 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  const state: LasState | null = useMemo(() => {
    if (!data) return null;
    const unitMap = new Map<number, Unit>(data.units.map(u => [u.id, u] as [number, Unit]));
    const userMap = new Map<string, string>(data.users.map(u => [u.uid, u.fullName] as [string, string]));
    const locale = ar ? (prefs.westernDigits ? 'ar-IQ-u-nu-latn' : 'ar-IQ-u-nu-arab') : 'en-GB';
    return {
      lang, ar, westernDigits: prefs.westernDigits, highContrast: prefs.highContrast, tr, ...data,
      unitById: (id) => (id ? unitMap.get(id) : undefined),
      unitName: (id) => { const u = id ? unitMap.get(id) : undefined; return u ? `${ar ? u.nameAr : u.nameEn} (${u.code})` : ''; },
      userName: (uid) => (uid ? userMap.get(uid) || uid : ''),
      categoryName: (id) => { const c = data.categories.find(x => x.id === id); return c ? (ar ? c.nameAr : c.nameEn) : ''; },
      fmtDate: (d) => { if (!d) return ''; const t = new Date(String(d).slice(0, 10) + 'T12:00:00Z'); return isNaN(t.getTime()) ? String(d) : t.toLocaleDateString(locale, { timeZone: 'Asia/Baghdad', year: 'numeric', month: '2-digit', day: '2-digit' }); },
      fmtTime: (d) => { if (!d) return ''; const t = new Date(d); return isNaN(t.getTime()) ? String(d) : t.toLocaleString(locale, { timeZone: 'Asia/Baghdad', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); },
      reload,
      openLetter: (id) => setOpenId(id),
      announce: (m) => { setLive(''); setTimeout(() => setLive(m), 50); },
    };
  }, [data, ar, lang, tr, prefs.westernDigits, prefs.highContrast, reload]);

  const rootCls = `las-root ${prefs.highContrast ? 'las-hc' : ''} min-h-full bg-slate-50 text-slate-900`;
  if (loadError) return <div className={rootCls} lang={lang} dir={ar ? 'rtl' : 'ltr'}><div className="max-w-3xl mx-auto p-6"><div role="alert" className="border border-red-700 bg-red-50 text-red-950 rounded-lg p-4 font-semibold">{loadError}</div></div></div>;
  if (!state) return <div className={rootCls} lang={lang} dir={ar ? 'rtl' : 'ltr'}><p role="status" className="p-6">{tr('جارٍ تحميل الأرشيف…', 'Loading the archive…')}</p></div>;

  const me = state.me;
  const noRole = me.roles.length === 0 && !me.isSysAdmin;
  const nav: Array<{ id: View; label: string; icon: any; show: boolean; key?: string }> = [
    { id: 'inbox', label: tr('بريدي', 'My inbox'), icon: Inbox, show: true, key: 'Alt+I' },
    { id: 'incoming', label: tr('تسجيل وارد', 'Register incoming'), icon: FileInput, show: me.registryUnits.length > 0, key: 'Alt+N' },
    { id: 'outgoing', label: tr('كتاب صادر', 'New outgoing'), icon: FileOutput, show: me.memberUnits.length + me.registryUnits.length > 0, key: 'Alt+O' },
    { id: 'mutalaa', label: tr('مطالعة', "Mutala'a"), icon: ScrollText, show: me.memberUnits.length + me.registryUnits.length > 0 },
    { id: 'report', label: tr('تقرير', 'Report'), icon: FileBarChart, show: me.memberUnits.length + me.registryUnits.length > 0 },
    { id: 'archive', label: tr('البحث والأرشيف', 'Search and archive'), icon: Search, show: true, key: 'Alt+S' },
    { id: 'stats', label: tr('لوحة المتابعة والتقارير', 'Dashboard and reports'), icon: BarChart3, show: me.viewUnits.length > 0 || me.isSysAdmin },
    { id: 'admin', label: tr('الإدارة والصلاحيات', 'Administration'), icon: Settings, show: me.isSysAdmin || me.headUnits.length > 0 || me.registryUnits.length > 0 },
    { id: 'audit', label: tr('سجل التدقيق', 'Audit log'), icon: ShieldCheck, show: me.isAuditor },
  ];
  const done = (id: number, message: string) => { setFlash(message); state.announce(message); setRefreshKey(k => k + 1); go('inbox'); setOpenId(id); };
  const titles: Record<View, string> = Object.fromEntries(nav.map(n => [n.id, n.label])) as any;

  return (
    <LasContext.Provider value={state}>
      <style>{STYLE}</style>
      <div className={rootCls} lang={lang} dir={ar ? 'rtl' : 'ltr'}>
        <a href="#las-main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:start-2 focus:bg-white focus:text-blue-900 focus:border-2 focus:border-blue-800 focus:rounded-lg focus:px-4 focus:py-2 font-bold">
          {tr('تخطَّ إلى المحتوى', 'Skip to content')}
        </a>
        <header className="bg-white border-b border-slate-300">
          <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-black">{tr('أرشيف الكتب والمراسلات', 'Letters Archive')}</h1>
              <p className="text-sm text-slate-700">{me.name}{me.roles.length ? ' — ' + [...new Set(me.roles.map(r => r.unitCode))].join('، ') : ''}{me.isSysAdmin ? tr(' — مدير النظام', ' — system administrator') : ''}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Btn onClick={() => setShowPrefs(true)}><Accessibility className="w-4 h-4" aria-hidden="true" />{tr('إعدادات العرض', 'Display settings')}</Btn>
              <Btn onClick={onBackToMetro}><ArrowRight className="w-4 h-4 ltr:-scale-x-100" aria-hidden="true" />{tr('كل التطبيقات', 'All apps')}</Btn>
            </div>
          </div>
          <nav aria-label={tr('أقسام الأرشيف', 'Archive sections')} className="max-w-7xl mx-auto px-4 pb-2">
            <ul className="flex flex-wrap gap-1.5">
              {nav.filter(n => n.show).map(n => (
                <li key={n.id}>
                  <button type="button" onClick={() => go(n.id)} aria-current={view === n.id ? 'page' : undefined} title={n.key} data-nav={n.id}
                    className={`las-btn inline-flex items-center gap-2 min-h-[42px] px-3 rounded-lg border text-sm font-bold focus:outline-none ${view === n.id ? 'bg-blue-800 text-white border-blue-900' : 'bg-white text-slate-900 border-slate-400 hover:bg-slate-100'}`}>
                    <n.icon className="w-4 h-4" aria-hidden="true" />{n.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </header>
        <main id="las-main" ref={mainRef} tabIndex={-1} className="max-w-7xl mx-auto px-4 py-5 space-y-4 focus:outline-none">
          <h2 className="text-lg font-bold">{titles[view]}</h2>
          {noRole && <Notice kind="warn">{tr('لم تُمنح صلاحية في الأرشيف بعد. يمكنك رؤية ما يُحال إليك فقط. راجع مدير النظام لإضافتك إلى وحدتك.', 'You have no archive role yet, so you only see what is referred to you. Ask the administrator to add you to your unit.')}</Notice>}
          {state.units.length === 0 && <Notice kind="warn">{tr('لا يوجد هيكل تنظيمي بعد. أضف المؤسسة والدوائر والأقسام من تطبيق «الهيكل التنظيمي» أولاً.', 'There is no organizational structure yet. Add the institution, directorates and departments in the Organizational Structure app first.')}</Notice>}
          {flash && <Notice kind="success" onClose={() => setFlash('')}>{flash}</Notice>}
          {view === 'inbox' && <InboxView refreshKey={refreshKey} />}
          {view === 'incoming' && <IncomingForm onDone={done} />}
          {view === 'outgoing' && <OutgoingForm onDone={done} />}
          {view === 'mutalaa' && <MutalaaForm onDone={done} />}
          {view === 'report' && <ReportForm onDone={done} />}
          {view === 'archive' && <ArchiveView refreshKey={refreshKey} focusSearch={focusSearch} />}
          {view === 'stats' && <StatsView />}
          {view === 'admin' && <AdminView />}
          {view === 'audit' && <AuditView />}
        </main>
        {/* Screen-reader announcements for results of actions (AR-2) */}
        <div aria-live="polite" role="status" className="sr-only">{live}</div>
        {openId !== null && <LetterDetail key={openId} id={openId} onClose={() => setOpenId(null)} onChanged={() => setRefreshKey(k => k + 1)} />}
        {showPrefs && (
          <Modal title={tr('إعدادات العرض وإمكانية الوصول', 'Display and accessibility settings')} onClose={() => setShowPrefs(false)}>
            <div className="space-y-4">
              <Field label={tr('حجم الخط', 'Text size')}>
                {(p) => <select {...p} value={prefs.fontScale} onChange={e => setPrefs({ ...prefs, fontScale: Number(e.target.value) })} className={inputCls}>{[100, 115, 130, 150, 175, 200].map(n => <option key={n} value={n}>{n}%</option>)}</select>}
              </Field>
              <label className="flex items-center gap-2 min-h-[42px] text-sm font-semibold cursor-pointer"><input type="checkbox" className="w-5 h-5 accent-blue-800" checked={prefs.highContrast} onChange={e => setPrefs({ ...prefs, highContrast: e.target.checked })} />{tr('تباين عالٍ (أسود على أبيض)', 'High contrast (black on white)')}</label>
              <label className="flex items-center gap-2 min-h-[42px] text-sm font-semibold cursor-pointer"><input type="checkbox" className="w-5 h-5 accent-blue-800" checked={!prefs.westernDigits} onChange={e => setPrefs({ ...prefs, westernDigits: !e.target.checked })} />{tr('أرقام عربية مشرقية (١٢٣) في التواريخ', 'Arabic-Indic digits (١٢٣) in dates')}</label>
              <div>
                <h3 className="font-bold mb-1">{tr('اختصارات لوحة المفاتيح', 'Keyboard shortcuts')}</h3>
                <ul className="text-sm space-y-1" dir="ltr">
                  <li><kbd className="border border-slate-500 rounded px-1">Alt</kbd> + <kbd className="border border-slate-500 rounded px-1">I</kbd> — {tr('بريدي', 'Inbox')}</li>
                  <li><kbd className="border border-slate-500 rounded px-1">Alt</kbd> + <kbd className="border border-slate-500 rounded px-1">N</kbd> — {tr('تسجيل وارد', 'Register incoming')}</li>
                  <li><kbd className="border border-slate-500 rounded px-1">Alt</kbd> + <kbd className="border border-slate-500 rounded px-1">O</kbd> — {tr('كتاب صادر', 'New outgoing')}</li>
                  <li><kbd className="border border-slate-500 rounded px-1">Alt</kbd> + <kbd className="border border-slate-500 rounded px-1">S</kbd> — {tr('البحث', 'Search')}</li>
                  <li><kbd className="border border-slate-500 rounded px-1">Esc</kbd> — {tr('إغلاق النافذة', 'Close a dialog')}</li>
                </ul>
              </div>
              <div className="flex justify-end"><Btn variant="primary" onClick={() => setShowPrefs(false)}>{tr('تم', 'Done')}</Btn></div>
            </div>
          </Modal>
        )}
      </div>
    </LasContext.Provider>
  );
}
