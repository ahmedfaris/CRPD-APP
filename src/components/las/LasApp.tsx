// Letters Archive System — application shell: navigation, keyboard shortcuts, language,
// accessibility preferences (font size, high contrast, digits) and the shared data context.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Inbox, FileInput, FileOutput, ScrollText, FileBarChart, Search, BarChart3, Settings, ShieldCheck, ArrowRight, Accessibility, ScanLine, MailOpen, Send, Menu, X, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { LasContext, LasState, Me, Unit, las, Notice, Btn, Modal, Field, inputCls } from './ui';
import { IncomingForm, OutgoingForm, MutalaaForm, ReportForm } from './Forms';
import { LetterDetail } from './LetterDetail';
import { InboxView, MailboxView, ArchiveView, StatsView, AdminView, AuditView } from './Views';
import { CaptureView } from './CaptureView';

type View = 'inbox' | 'mailIn' | 'mailOut' | 'capture' | 'incoming' | 'outgoing' | 'mutalaa' | 'report' | 'archive' | 'stats' | 'admin' | 'audit';
interface Prefs { fontScale: number; highContrast: boolean; westernDigits: boolean }
const PREFS_KEY = 'las_prefs_v1';
const SIDEBAR_KEY = 'las_sidebar_collapsed_v1';
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
  // Sidebar: can shrink to icons on wide screens (remembered); on narrow screens it opens from a menu button.
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(SIDEBAR_KEY) === '1'; } catch { return false; } });
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, setPending] = useState(0);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { try { localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0'); } catch { /* storage unavailable */ } }, [collapsed]);

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

  // Moving to a section puts focus on its heading area; the search shortcut puts it in the search box instead.
  const go = useCallback((v: View, focusMain = true) => { setView(v); setFlash(''); setMenuOpen(false); if (focusMain) requestAnimationFrame(() => mainRef.current?.focus()); }, []);
  // Keyboard shortcuts (AR-1): Alt+I inbox, Alt+N new incoming, Alt+O new outgoing, Alt+S search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const k = e.key.toLowerCase();
      if (k === 'i') { e.preventDefault(); go('inbox'); }
      if (k === 'n') { e.preventDefault(); go('incoming'); }
      if (k === 'o') { e.preventDefault(); go('outgoing'); }
      if (k === 's') { e.preventDefault(); go('archive', false); setFocusSearch(x => x + 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  // Number of items waiting for the user, shown next to "My inbox" in the sidebar.
  useEffect(() => {
    if (!data) return;
    las('/inbox').then(r => { if (r.ok) { const c = r.data.counts || {}; setPending((c.referrals || 0) + (c.approvals || 0) + (c.deliveries || 0)); } });
  }, [data, refreshKey, view]);
  // Escape closes the menu on narrow screens and returns focus to its button.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('dialog[open]')) { setMenuOpen(false); menuBtnRef.current?.focus(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

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

  const rootCls = `las-root ${prefs.highContrast ? 'las-hc' : ''} flex-1 flex flex-col bg-slate-50 text-slate-900`;
  if (loadError) return <div className={rootCls} lang={lang} dir={ar ? 'rtl' : 'ltr'}><div className="max-w-3xl mx-auto p-6"><div role="alert" className="border border-red-700 bg-red-50 text-red-950 rounded-lg p-4 font-semibold">{loadError}</div></div></div>;
  if (!state) return <div className={rootCls} lang={lang} dir={ar ? 'rtl' : 'ltr'}><p role="status" className="p-6">{tr('جارٍ تحميل الأرشيف…', 'Loading the archive…')}</p></div>;

  const me = state.me;
  const noRole = me.roles.length === 0 && !me.isSysAdmin;
  const member = me.memberUnits.length + me.registryUnits.length > 0;
  type Item = { id: View; label: string; icon: any; show: boolean; key?: string; badge?: number };
  const groups: Array<{ id: string; label: string; items: Item[] }> = [
    { id: 'work', label: tr('عملي', 'My work'), items: [
      { id: 'inbox', label: tr('بريدي', 'My inbox'), icon: Inbox, show: true, key: 'Alt+I', badge: pending },
    ] },
    { id: 'mail', label: tr('البريد', 'Mail'), items: [
      { id: 'mailIn', label: tr('البريد الوارد', 'Incoming mail'), icon: MailOpen, show: true },
      { id: 'mailOut', label: tr('البريد الصادر', 'Outgoing mail'), icon: Send, show: true },
    ] },
    { id: 'new', label: tr('إدخال جديد', 'New entry'), items: [
      { id: 'capture', label: tr('المسح الضوئي والفهرسة', 'Scanning and indexing'), icon: ScanLine, show: me.registryUnits.length > 0 || me.isSysAdmin },
      { id: 'incoming', label: tr('تسجيل وارد', 'Register incoming'), icon: FileInput, show: me.registryUnits.length > 0, key: 'Alt+N' },
      { id: 'outgoing', label: tr('كتاب صادر', 'New outgoing'), icon: FileOutput, show: member, key: 'Alt+O' },
      { id: 'mutalaa', label: tr('مطالعة', "Mutala'a"), icon: ScrollText, show: member },
      { id: 'report', label: tr('تقرير', 'Report'), icon: FileBarChart, show: member },
    ] },
    { id: 'find', label: tr('البحث والمتابعة', 'Search and follow-up'), items: [
      { id: 'archive', label: tr('البحث والأرشيف', 'Search and archive'), icon: Search, show: true, key: 'Alt+S' },
      { id: 'stats', label: tr('لوحة المتابعة والتقارير', 'Dashboard and reports'), icon: BarChart3, show: me.viewUnits.length > 0 || me.isSysAdmin },
    ] },
    { id: 'manage', label: tr('الإدارة', 'Administration'), items: [
      { id: 'admin', label: tr('الإدارة والصلاحيات', 'Administration'), icon: Settings, show: me.isSysAdmin || me.headUnits.length > 0 || me.registryUnits.length > 0 },
      { id: 'audit', label: tr('سجل التدقيق', 'Audit log'), icon: ShieldCheck, show: me.isAuditor },
    ] },
  ];
  const nav = groups.flatMap(g => g.items);
  // Icons only on wide screens when collapsed; the open menu on narrow screens always shows labels.
  const iconsOnly = collapsed && !menuOpen;
  const done = (id: number, message: string) => { setFlash(message); state.announce(message); setRefreshKey(k => k + 1); go('inbox'); setOpenId(id); };
  const titles: Record<View, string> = Object.fromEntries(nav.map(n => [n.id, n.label])) as any;

  return (
    <LasContext.Provider value={state}>
      <style>{STYLE}</style>
      <div className={rootCls} lang={lang} dir={ar ? 'rtl' : 'ltr'}>
        <a href="#las-main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:start-2 focus:bg-white focus:text-blue-900 focus:border-2 focus:border-blue-800 focus:rounded-lg focus:px-4 focus:py-2 font-bold">
          {tr('تخطَّ إلى المحتوى', 'Skip to content')}
        </a>
        <div className="flex-1 lg:flex">
          {/* Vertical navigation of the archive (start side: right in Arabic, left in English) */}
          <aside className={`bg-white border-slate-300 border-b lg:border-b-0 lg:border-e lg:self-stretch lg:shrink-0 ${iconsOnly ? 'lg:w-[4.5rem]' : 'lg:w-64'}`}>
            <div className="lg:sticky lg:top-0 lg:max-h-screen lg:overflow-y-auto">
            <div className={`flex items-center gap-2 px-3 py-3 border-b border-slate-300 ${iconsOnly ? 'lg:justify-center' : 'justify-between'}`}>
              <div className={iconsOnly ? 'lg:sr-only' : ''}>
                <h1 className="text-lg font-black leading-tight">{tr('أرشيف الكتب والمراسلات', 'Letters Archive')}</h1>
                <p className="text-sm text-slate-700">{me.name}{me.roles.length ? ' — ' + [...new Set(me.roles.map(r => r.unitCode))].join('، ') : ''}{me.isSysAdmin ? tr(' — مدير النظام', ' — system administrator') : ''}</p>
              </div>
              <button type="button" ref={menuBtnRef} onClick={() => setMenuOpen(o => !o)} aria-expanded={menuOpen} aria-controls="las-sidebar"
                className="las-btn lg:hidden inline-flex items-center gap-2 min-h-[44px] px-3 rounded-lg border border-slate-400 bg-white text-sm font-bold hover:bg-slate-100 focus:outline-none">
                {menuOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}{tr('القائمة', 'Menu')}
              </button>
              <button type="button" onClick={() => setCollapsed(c => !c)} aria-pressed={collapsed} aria-controls="las-sidebar"
                aria-label={tr('تصغير القائمة إلى أيقونات', 'Collapse the menu to icons')} title={collapsed ? tr('توسيع القائمة', 'Expand the menu') : tr('تصغير القائمة', 'Collapse the menu')}
                className="las-btn hidden lg:inline-flex items-center justify-center w-11 h-11 shrink-0 rounded-lg border border-slate-400 bg-white hover:bg-slate-100 focus:outline-none">
                {(collapsed === ar) ? <PanelRightClose className="w-5 h-5" aria-hidden="true" /> : <PanelRightOpen className="w-5 h-5" aria-hidden="true" />}
              </button>
            </div>
            <div id="las-sidebar" className={`${menuOpen ? 'block' : 'hidden'} lg:block`}>
              <nav aria-label={tr('أقسام الأرشيف', 'Archive sections')} className="px-2 py-3 space-y-4">
                {groups.map(g => {
                  const items = g.items.filter(n => n.show);
                  if (!items.length) return null;
                  return (
                    <div key={g.id}>
                      <p id={`las-nav-${g.id}`} className={`px-2 mb-1 text-xs font-bold text-slate-700 ${iconsOnly ? 'lg:sr-only' : ''}`}>{g.label}</p>
                      <ul aria-labelledby={`las-nav-${g.id}`} className="space-y-1">
                        {items.map(n => (
                          <li key={n.id}>
                            <button type="button" onClick={() => go(n.id)} aria-current={view === n.id ? 'page' : undefined} data-nav={n.id}
                              title={iconsOnly ? n.label + (n.key ? ` (${n.key})` : '') : n.key}
                              className={`las-btn w-full flex items-center gap-3 min-h-[44px] px-3 rounded-lg border text-sm font-bold text-start focus:outline-none ${iconsOnly ? 'lg:justify-center lg:px-0' : ''} ${view === n.id ? 'bg-blue-800 text-white border-blue-900' : 'bg-white text-slate-900 border-transparent hover:bg-slate-100 hover:border-slate-300'}`}>
                              <span className="relative shrink-0">
                                <n.icon className="w-5 h-5" aria-hidden="true" />
                                {iconsOnly && !!n.badge && <span aria-hidden="true" className="hidden lg:block absolute -top-2 -end-2 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-red-700 text-white text-[0.65rem] leading-[1.1rem] text-center">{n.badge > 99 ? '99+' : n.badge}</span>}
                              </span>
                              <span className={`flex-1 ${iconsOnly ? 'lg:sr-only' : ''}`}>{n.label}</span>
                              {!!n.badge && <span className={`min-w-[1.5rem] px-1.5 rounded-full text-xs leading-6 text-center ${view === n.id ? 'bg-white text-blue-900' : 'bg-red-700 text-white'} ${iconsOnly ? 'lg:sr-only' : ''}`}>
                                <span aria-hidden="true">{n.badge}</span><span className="sr-only">{tr(`، ${n.badge} بانتظارك`, `, ${n.badge} waiting`)}</span>
                              </span>}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </nav>
              <div className="px-2 py-3 border-t border-slate-300 space-y-1">
                {[
                  { label: tr('إعدادات العرض', 'Display settings'), icon: Accessibility, onClick: () => setShowPrefs(true), flip: false },
                  { label: tr('كل التطبيقات', 'All apps'), icon: ArrowRight, onClick: onBackToMetro, flip: true },
                ].map(b => (
                  <button key={b.label} type="button" onClick={b.onClick} title={iconsOnly ? b.label : undefined}
                    className={`las-btn w-full flex items-center gap-3 min-h-[44px] px-3 rounded-lg border border-transparent text-sm font-bold text-start text-slate-900 hover:bg-slate-100 hover:border-slate-300 focus:outline-none ${iconsOnly ? 'lg:justify-center lg:px-0' : ''}`}>
                    <b.icon className={`w-5 h-5 shrink-0 ${b.flip ? 'ltr:-scale-x-100' : ''}`} aria-hidden="true" />
                    <span className={iconsOnly ? 'lg:sr-only' : ''}>{b.label}</span>
                  </button>
                ))}
              </div>
            </div>
            </div>
          </aside>
          <div className="flex-1 min-w-0">
            {/* The portal shell already provides the page's <main>; this is a labelled region inside it. */}
            <section id="las-main" ref={mainRef} tabIndex={-1} aria-labelledby="las-view-title" className="max-w-7xl mx-auto px-4 py-5 space-y-4 focus:outline-none">
              <h2 id="las-view-title" className="text-lg font-bold">{titles[view]}</h2>
              {noRole && <Notice kind="warn">{tr('لم تُمنح صلاحية في الأرشيف بعد. يمكنك رؤية ما يُحال إليك فقط. راجع مدير النظام لإضافتك إلى وحدتك.', 'You have no archive role yet, so you only see what is referred to you. Ask the administrator to add you to your unit.')}</Notice>}
              {state.units.length === 0 && <Notice kind="warn">{tr('لا يوجد هيكل تنظيمي بعد. أضف المؤسسة والدوائر والأقسام من تطبيق «الهيكل التنظيمي» أولاً.', 'There is no organizational structure yet. Add the institution, directorates and departments in the Organizational Structure app first.')}</Notice>}
              {flash && <Notice kind="success" onClose={() => setFlash('')}>{flash}</Notice>}
              {view === 'inbox' && <InboxView refreshKey={refreshKey} />}
              {view === 'mailIn' && <MailboxView direction="IN" refreshKey={refreshKey} />}
              {view === 'mailOut' && <MailboxView direction="OUT" refreshKey={refreshKey} />}
              {view === 'capture' && <CaptureView onRegistered={(id, m) => { setFlash(m); setRefreshKey(k => k + 1); setOpenId(id); }} />}
              {view === 'incoming' && <IncomingForm onDone={done} />}
              {view === 'outgoing' && <OutgoingForm onDone={done} />}
              {view === 'mutalaa' && <MutalaaForm onDone={done} />}
              {view === 'report' && <ReportForm onDone={done} />}
              {view === 'archive' && <ArchiveView refreshKey={refreshKey} focusSearch={focusSearch} />}
              {view === 'stats' && <StatsView />}
              {view === 'admin' && <AdminView />}
              {view === 'audit' && <AuditView />}
            </section>
          </div>
        </div>
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
