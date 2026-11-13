// Asset types management: add, edit, deactivate and delete the device types used by the
// Asset Management app (each type has an Arabic/English name, category, icon and code prefix).
import React, { useMemo, useState } from 'react';
import { Plus, Edit3, Trash2, X, Check, Power, Tags, Search, AlertCircle } from 'lucide-react';
import { useDevices } from '../context/DeviceContext';
import { useLanguage } from '../context/LanguageContext';
import { AssetType } from '../types';
import { ASSET_TYPE_ICONS, AssetTypeIcon } from './assetTypeUi';

interface Props {
  canManage: boolean;
}

type FormState = {
  id?: number;
  nameEn: string;
  nameAr: string;
  codePrefix: string;
  category: 'electronic' | 'network';
  icon: string;
  description: string;
  isBuiltIn?: boolean;
  deviceCount?: number;
};

const EMPTY_FORM: FormState = { nameEn: '', nameAr: '', codePrefix: '', category: 'electronic', icon: 'device', description: '' };

export function AssetTypesManager({ canManage }: Props) {
  const { assetTypes, saveAssetType, deleteAssetType, fetchAssetTypes } = useDevices();
  const { language, dir } = useLanguage();
  const ar = language === 'ar';
  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState('');
  const [pageError, setPageError] = useState('');
  const [query, setQuery] = useState('');
  const [toDelete, setToDelete] = useState<AssetType | null>(null);
  const [saving, setSaving] = useState(false);

  // Device counts change as devices are added; refresh when the tab opens.
  React.useEffect(() => { fetchAssetTypes(); }, [fetchAssetTypes]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assetTypes.filter(t => !q || [t.nameEn, t.nameAr, t.codePrefix, t.key].some(v => (v || '').toLowerCase().includes(q)));
  }, [assetTypes, query]);

  const openNew = () => { setFormError(''); setForm({ ...EMPTY_FORM }); };
  const openEdit = (t: AssetType) => {
    setFormError('');
    setForm({
      id: t.id, nameEn: t.nameEn, nameAr: t.nameAr, codePrefix: t.codePrefix,
      category: (t.category === 'network' ? 'network' : 'electronic'), icon: t.icon || 'device',
      description: t.description || '', isBuiltIn: t.isBuiltIn, deviceCount: t.deviceCount,
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (!form.nameEn.trim() || !form.nameAr.trim()) {
      setFormError(ar ? 'الاسم بالعربية والإنجليزية مطلوب' : 'Arabic and English names are required');
      return;
    }
    if (!/^[A-Za-z][A-Za-z0-9]{1,3}$/.test(form.codePrefix.trim())) {
      setFormError(ar ? 'بادئة الرمز: من 2 إلى 4 أحرف أو أرقام تبدأ بحرف (مثل PC أو UPS)' : 'Code prefix: 2-4 letters or digits starting with a letter (e.g. PC, UPS)');
      return;
    }
    setSaving(true);
    const res = await saveAssetType({
      nameEn: form.nameEn.trim(),
      nameAr: form.nameAr.trim(),
      codePrefix: form.codePrefix.trim().toUpperCase(),
      category: form.category,
      icon: form.icon,
      description: form.description.trim(),
    }, form.id);
    setSaving(false);
    if (res.success) {
      setForm(null);
    } else {
      setFormError(res.error || (ar ? 'تعذر حفظ نوع الأصل' : 'Could not save the asset type'));
    }
  };

  const toggleActive = async (t: AssetType) => {
    setPageError('');
    const res = await saveAssetType({ isActive: !t.isActive }, t.id);
    if (!res.success) setPageError(res.error || '');
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setPageError('');
    const res = await deleteAssetType(toDelete.id);
    if (!res.success) setPageError(res.error || '');
    setToDelete(null);
  };

  const input = 'w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-500 transition';
  const label = 'block text-xs font-semibold text-slate-300 mb-1.5';

  return (
    <div className="space-y-5" dir={dir} data-role="asset-types">
      <div className="bg-slate-800/80 rounded-2xl border border-slate-700 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
            <Tags className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white">{ar ? 'أنواع الأصول' : 'Asset types'}</h2>
            <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">
              {ar
                ? 'الأنواع المتاحة عند تسجيل جهاز. لكل نوع بادئة رمز تُستخدم في ترقيم الأصول (مثل PC-001). النوع المستخدم لا يُحذف ويمكن إيقافه.'
                : 'Types offered when registering a device. Each type has a code prefix used for asset numbers (e.g. PC-001). A type in use cannot be deleted, only deactivated.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder={ar ? 'بحث...' : 'Search...'}
              className="bg-slate-900 border border-slate-700 rounded-xl ps-9 pe-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-500 w-44" />
          </div>
          {canManage && (
            <button onClick={openNew} data-role="add-asset-type"
              className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-cyan-600/20">
              <Plus className="w-4 h-4" />
              {ar ? 'إضافة نوع' : 'Add type'}
            </button>
          )}
        </div>
      </div>

      {pageError && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm" role="alert">
          <span className="flex items-center gap-2"><AlertCircle className="w-4 h-4" />{pageError}</span>
          <button onClick={() => setPageError('')}><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {visible.map(t => (
          <div key={t.id} data-role="asset-type-card" data-key={t.key}
            className={`rounded-2xl border p-4 flex gap-3 transition ${t.isActive ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-900/60 border-slate-800 opacity-60'}`}>
            <div className="w-11 h-11 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0">
              <AssetTypeIcon icon={t.icon} className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center flex-wrap gap-1.5">
                <span className="font-bold text-white text-sm">{ar ? t.nameAr : t.nameEn}</span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">{t.codePrefix}-001</span>
                {t.isBuiltIn && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">{ar ? 'أساسي' : 'Built-in'}</span>}
                {!t.isActive && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">{ar ? 'موقوف' : 'Inactive'}</span>}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">{ar ? t.nameEn : t.nameAr}</div>
              <div className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-2">
                <span>{t.category === 'network' ? (ar ? 'شبكات' : 'Network') : (ar ? 'إلكتروني ومكتبي' : 'Electronic & office')}</span>
                <span>•</span>
                <span data-role="device-count">{ar ? `${t.deviceCount || 0} جهاز` : `${t.deviceCount || 0} devices`}</span>
              </div>
              {t.description && <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{t.description}</p>}
            </div>
            {canManage && (
              <div className="flex flex-col gap-1 shrink-0">
                <button onClick={() => openEdit(t)} title={ar ? 'تعديل' : 'Edit'} data-role="edit-type"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-700 transition"><Edit3 className="w-3.5 h-3.5" /></button>
                <button onClick={() => toggleActive(t)} title={t.isActive ? (ar ? 'إيقاف' : 'Deactivate') : (ar ? 'تفعيل' : 'Activate')} data-role="toggle-type"
                  className={`p-1.5 rounded-lg transition hover:bg-slate-700 ${t.isActive ? 'text-emerald-400 hover:text-amber-300' : 'text-slate-500 hover:text-emerald-300'}`}><Power className="w-3.5 h-3.5" /></button>
                {!t.isBuiltIn && (
                  <button onClick={() => setToDelete(t)} disabled={(t.deviceCount || 0) > 0} data-role="delete-type"
                    title={(t.deviceCount || 0) > 0 ? (ar ? 'لا يمكن حذف نوع مستخدم؛ أوقفه بدلاً من ذلك' : 'In use: deactivate instead') : (ar ? 'حذف' : 'Delete')}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700 transition disabled:opacity-30 disabled:cursor-not-allowed"><Trash2 className="w-3.5 h-3.5" /></button>
                )}
              </div>
            )}
          </div>
        ))}
        {visible.length === 0 && (
          <div className="col-span-full text-center text-sm text-slate-400 py-10">{ar ? 'لا توجد أنواع مطابقة' : 'No matching types'}</div>
        )}
      </div>

      {/* Add / edit form */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form onSubmit={submit} data-role="asset-type-form"
            className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">{form.id ? (ar ? 'تعديل نوع الأصل' : 'Edit asset type') : (ar ? 'إضافة نوع أصل' : 'Add asset type')}</h3>
              <button type="button" onClick={() => setForm(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={label}>{ar ? 'الاسم بالعربية *' : 'Arabic name *'}</label>
                  <input value={form.nameAr} onChange={e => setForm({ ...form, nameAr: e.target.value })} dir="rtl" maxLength={60} className={input} data-field="nameAr" placeholder={ar ? 'مثال: جهاز عرض' : 'e.g. جهاز عرض'} />
                </div>
                <div>
                  <label className={label}>{ar ? 'الاسم بالإنجليزية *' : 'English name *'}</label>
                  <input value={form.nameEn} onChange={e => setForm({ ...form, nameEn: e.target.value })} dir="ltr" maxLength={60} className={input} data-field="nameEn" placeholder="e.g. Projector" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={label}>{ar ? 'بادئة رمز الأصل *' : 'Asset code prefix *'}</label>
                  <input value={form.codePrefix} onChange={e => setForm({ ...form, codePrefix: e.target.value.toUpperCase() })} dir="ltr" maxLength={4}
                    className={`${input} font-mono uppercase`} data-field="codePrefix" placeholder="PJ" />
                  <p className="text-[11px] text-slate-500 mt-1">
                    {ar ? 'مثال على الرمز: ' : 'Example code: '}<span className="font-mono text-cyan-300">{(form.codePrefix || 'XX').toUpperCase()}-001</span>
                    {form.id && (form.deviceCount || 0) > 0 && (ar ? ' — يُطبَّق على الأجهزة الجديدة فقط' : ' — applies to new devices only')}
                  </p>
                </div>
                <div>
                  <label className={label}>{ar ? 'الفئة' : 'Category'}</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as FormState['category'] })} className={input} data-field="category">
                    <option value="electronic">{ar ? 'أجهزة إلكترونية ومكتبية' : 'Electronic & office'}</option>
                    <option value="network">{ar ? 'أجهزة شبكات' : 'Network'}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={label}>{ar ? 'الأيقونة' : 'Icon'}</label>
                <div className="grid grid-cols-6 sm:grid-cols-9 gap-1.5">
                  {Object.entries(ASSET_TYPE_ICONS).map(([key, v]) => (
                    <button type="button" key={key} onClick={() => setForm({ ...form, icon: key })} title={ar ? v.labelAr : v.labelEn} data-icon={key}
                      className={`h-10 rounded-lg border flex items-center justify-center transition ${form.icon === key ? 'border-cyan-400 bg-cyan-500/15' : 'border-slate-700 bg-slate-800 hover:border-slate-500'}`}>
                      <AssetTypeIcon icon={key} className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={label}>{ar ? 'وصف مختصر' : 'Short description'}</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} maxLength={300} className={`${input} resize-none`} data-field="description" />
              </div>
              {formError && (
                <p className="text-xs font-semibold text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2" role="alert" data-role="form-error">{formError}</p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-800 flex justify-end gap-2">
              <button type="button" onClick={() => setForm(null)} className="px-4 py-2 rounded-xl text-sm text-slate-300 bg-slate-800 hover:bg-slate-700">{ar ? 'إلغاء' : 'Cancel'}</button>
              <button type="submit" disabled={saving} className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 flex items-center gap-1.5">
                <Check className="w-4 h-4" />{ar ? 'حفظ' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete confirmation */}
      {toDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">{ar ? 'حذف نوع الأصل' : 'Delete asset type'}</h3>
            <p className="text-sm text-slate-300 mb-5">{ar ? `هل تريد حذف النوع "${toDelete.nameAr}"؟` : `Delete the type "${toDelete.nameEn}"?`}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setToDelete(null)} className="px-4 py-2 rounded-xl text-sm text-slate-300 bg-slate-800 hover:bg-slate-700">{ar ? 'إلغاء' : 'Cancel'}</button>
              <button onClick={confirmDelete} data-role="confirm-delete" className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-500">{ar ? 'حذف' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
