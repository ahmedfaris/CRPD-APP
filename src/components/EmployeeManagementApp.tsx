import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { EmployeeRecord } from '../types';
import { INITIAL_EMPLOYEES } from '../data/mockData';
import { 
  Users, 
  Search, 
  Plus, 
  ShieldCheck, 
  Phone, 
  Mail, 
  Building2, 
  Award, 
  CheckCircle2, 
  Clock, 
  ArrowLeft,
  X,
  Lock,
  UserCheck
} from 'lucide-react';

interface EmployeeManagementAppProps {
  onBackToMetro: () => void;
}

export function EmployeeManagementApp({ onBackToMetro }: EmployeeManagementAppProps) {
  const { t, language, dir } = useLanguage();
  const { currentUser, isAdmin, hasPermission } = useAuth();
  const canCreate = isAdmin || hasPermission('User & Role Management.Create') || hasPermission('Employee Management.Create') || hasPermission('users.create') || hasPermission('users.manage');

  const [employees, setEmployees] = useState<EmployeeRecord[]>(() => {
    try {
      const stored = localStorage.getItem('pwdsnapp_employees_v1');
      if (stored) return JSON.parse(stored);
    } catch {
      // fallback
    }
    return INITIAL_EMPLOYEES;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [isOnboardModalOpen, setIsOnboardModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRecord | null>(null);

  // New Employee Form
  const [fullNameEn, setFullNameEn] = useState('');
  const [fullNameAr, setFullNameAr] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('IT Service Desk');
  const [jobTitleEn, setJobTitleEn] = useState('');
  const [jobTitleAr, setJobTitleAr] = useState('');
  const [clearance, setClearance] = useState<'Level 1' | 'Level 2' | 'Level 3 - High Security'>('Level 2');
  const [phone, setPhone] = useState('+1 (555) 000-0000');

  const saveEmployees = (updated: EmployeeRecord[]) => {
    setEmployees(updated);
    try {
      localStorage.setItem('pwdsnapp_employees_v1', JSON.stringify(updated));
    } catch {
      // storage error
    }
  };

  const handleCreateEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;
    if (!fullNameEn.trim() || !email.trim()) return;

    const colors = [
      'bg-blue-600 text-white',
      'bg-emerald-600 text-white',
      'bg-indigo-600 text-white',
      'bg-purple-600 text-white',
      'bg-rose-600 text-white',
      'bg-amber-600 text-white',
    ];

    const newEmp: EmployeeRecord = {
      id: 'emp_' + Date.now(),
      empNumber: `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
      fullNameEn: fullNameEn.trim(),
      fullNameAr: fullNameAr.trim() || fullNameEn.trim(),
      email: email.trim(),
      department,
      jobTitleEn: jobTitleEn.trim() || 'Staff Associate',
      jobTitleAr: jobTitleAr.trim() || jobTitleEn.trim() || 'موظف',
      hireDate: new Date().toISOString().split('T')[0],
      status: 'Active',
      clearance,
      twoFactorStatus: 'Pending Setup',
      phone,
      avatarColor: colors[Math.floor(Math.random() * colors.length)],
    };

    saveEmployees([...employees, newEmp]);
    setIsOnboardModalOpen(false);

    // Reset fields
    setFullNameEn('');
    setFullNameAr('');
    setEmail('');
    setJobTitleEn('');
    setJobTitleAr('');
  };

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.fullNameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.fullNameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.empNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.jobTitleEn.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDept = selectedDept === 'ALL' || emp.department === selectedDept;
    return matchesSearch && matchesDept;
  });

  const departmentsList = Array.from(new Set(employees.map((e) => e.department)));

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8" dir={dir}>
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top Header & Navigation back to Metro */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div className="flex items-center space-x-3">
            <button
              onClick={onBackToMetro}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition cursor-pointer mx-1"
              title={language === 'ar' ? 'الرجوع إلى لوحة مترو' : 'Return to Metro Hub'}
            >
              <ArrowLeft className={`w-5 h-5 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
            </button>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mx-1">
                  {t('emp.title')}
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 mx-1">
                  {language === 'ar' ? 'سجل الموظفين HRIS' : 'HRIS DB'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('emp.subtitle')}
              </p>
            </div>
          </div>

          {canCreate && (
            <button
              onClick={() => setIsOnboardModalOpen(true)}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/30 transition self-start sm:self-auto cursor-pointer"
            >
              <Plus className="w-4 h-4 mx-1" />
              <span>{t('emp.newEmployee')}</span>
            </button>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">{t('emp.totalStaff')}</p>
              <p className="text-2xl font-bold text-white mt-1">{employees.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
              <Users className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">{t('emp.twoFactorActive')}</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">
                {employees.filter((e) => e.twoFactorStatus === 'Enabled').length} {language === 'ar' ? 'مفعل' : 'Active'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">{t('emp.departments')}</p>
              <p className="text-2xl font-bold text-cyan-400 mt-1">{departmentsList.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-cyan-600/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Search & Department Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className={`w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 ${dir === 'rtl' ? 'right-3.5' : 'left-3.5'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('emp.searchPlaceholder')}
              className={`w-full py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-purple-500 ${
                dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'
              }`}
            />
          </div>

          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-hidden focus:border-purple-500 cursor-pointer"
          >
            <option value="ALL">{language === 'ar' ? 'كافة الإدارات والأقسام' : 'All Departments'}</option>
            {departmentsList.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Employees Table */}
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className={`w-full text-xs border-collapse ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">{t('emp.empId')}</th>
                  <th className="py-3.5 px-4">{t('emp.name')}</th>
                  <th className="py-3.5 px-4">{t('emp.dept')}</th>
                  <th className="py-3.5 px-4">{t('emp.clearance')}</th>
                  <th className="py-3.5 px-4">{t('emp.twoFactorCol')}</th>
                  <th className="py-3.5 px-4">{t('emp.statusCol')}</th>
                  <th className={`py-3.5 px-4 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>{t('emp.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-purple-400">
                      {emp.empNumber}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-lg ${emp.avatarColor} flex items-center justify-center font-bold text-xs shrink-0 shadow-sm mx-1`}>
                          {emp.fullNameEn.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-bold text-white text-xs">
                            {language === 'ar' ? emp.fullNameAr : emp.fullNameEn}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {emp.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-300">
                      <div className="font-medium">{emp.department}</div>
                      <div className="text-[11px] text-slate-400">
                        {language === 'ar' ? emp.jobTitleAr : emp.jobTitleEn}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                        emp.clearance.includes('High Security')
                          ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                          : emp.clearance === 'Level 2'
                          ? 'bg-blue-950/80 text-blue-300 border-blue-800'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}>
                        {language === 'ar'
                          ? (emp.clearance === 'Level 3 - High Security' ? 'المستوى 3 - فائق الأمان' : emp.clearance === 'Level 2' ? 'المستوى 2 - تشغيلي' : 'المستوى 1 - اعتيادي')
                          : emp.clearance}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        emp.twoFactorStatus === 'Enabled'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}>
                        <ShieldCheck className="w-3 h-3 mx-1" />
                        <span>
                          {language === 'ar' 
                            ? (emp.twoFactorStatus === 'Enabled' ? 'مفعل (2FA)' : 'قيد الإعداد')
                            : emp.twoFactorStatus}
                        </span>
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        emp.status === 'Active'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : emp.status === 'On Leave'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-slate-700 text-slate-300'
                      }`}>
                        {language === 'ar'
                          ? (emp.status === 'Active' ? 'نشط' : emp.status === 'On Leave' ? 'في إجازة' : 'متوقف')
                          : emp.status}
                      </span>
                    </td>

                    <td className={`py-3.5 px-4 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>
                      <button
                        onClick={() => setSelectedEmployee(emp)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition text-[11px] font-medium cursor-pointer"
                      >
                        {language === 'ar' ? 'الملف الشخصي' : 'Profile'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* EMPLOYEE PROFILE MODAL */}
        {selectedEmployee && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="font-bold text-white text-sm">
                  {language === 'ar' ? 'سجل بيانات الموظف' : 'Personnel Record'}
                </span>
                <button
                  onClick={() => setSelectedEmployee(null)}
                  className="text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center space-x-3.5 p-3.5 bg-slate-950 rounded-2xl border border-slate-800">
                <div className={`w-12 h-12 rounded-xl ${selectedEmployee.avatarColor} flex items-center justify-center font-bold text-base shadow-sm mx-1`}>
                  {selectedEmployee.fullNameEn.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">
                    {language === 'ar' ? selectedEmployee.fullNameAr : selectedEmployee.fullNameEn}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {language === 'ar' ? selectedEmployee.fullNameEn : selectedEmployee.fullNameAr}
                  </p>
                  <span className="text-[10px] font-mono text-purple-400">{selectedEmployee.empNumber}</span>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80">
                  <span className="text-slate-400 flex items-center space-x-1.5">
                    <Mail className="w-3.5 h-3.5 text-blue-400 mx-1" />
                    <span>{language === 'ar' ? 'البريد الإلكتروني:' : 'Email:'}</span>
                  </span>
                  <span className="font-mono text-slate-200">{selectedEmployee.email}</span>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80">
                  <span className="text-slate-400 flex items-center space-x-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-400 mx-1" />
                    <span>{language === 'ar' ? 'الهاتف:' : 'Phone:'}</span>
                  </span>
                  <span className="font-mono text-slate-200">{selectedEmployee.phone}</span>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80">
                  <span className="text-slate-400 flex items-center space-x-1.5">
                    <Building2 className="w-3.5 h-3.5 text-purple-400 mx-1" />
                    <span>{language === 'ar' ? 'الإدارة:' : 'Department:'}</span>
                  </span>
                  <span className="text-slate-200 font-semibold">{selectedEmployee.department}</span>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80">
                  <span className="text-slate-400 flex items-center space-x-1.5">
                    <Award className="w-3.5 h-3.5 text-amber-400 mx-1" />
                    <span>{language === 'ar' ? 'مستوى الصلاحية:' : 'Clearance Level:'}</span>
                  </span>
                  <span className="font-bold text-amber-400">{selectedEmployee.clearance}</span>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80">
                  <span className="text-slate-400 flex items-center space-x-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 mx-1" />
                    <span>{language === 'ar' ? 'حالة المصادقة الثنائية:' : '2FA Status:'}</span>
                  </span>
                  <span className="font-semibold text-emerald-400">{selectedEmployee.twoFactorStatus}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-end">
                <button
                  onClick={() => setSelectedEmployee(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer"
                >
                  {t('common.close')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ONBOARD EMPLOYEE MODAL */}
        {isOnboardModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
            <form onSubmit={handleCreateEmployee} className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-purple-400 mx-1" />
                  <span className="font-bold text-white text-sm">{t('emp.newEmployee')}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOnboardModalOpen(false)}
                  className="text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-300 mb-1">
                      {language === 'ar' ? 'الاسم بالإنجليزية' : 'Full Name (English)'}
                    </label>
                    <input
                      type="text"
                      required
                      value={fullNameEn}
                      onChange={(e) => setFullNameEn(e.target.value)}
                      placeholder="e.g. Liam Foster"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-300 mb-1">
                      {language === 'ar' ? 'الاسم بالعربية' : 'الاسم الكامل (بالعربية)'}
                    </label>
                    <input
                      type="text"
                      value={fullNameAr}
                      onChange={(e) => setFullNameAr(e.target.value)}
                      placeholder="مثال: ليام فوستر"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-purple-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-300 mb-1">
                      {language === 'ar' ? 'البريد الرسمي للموظف' : 'Corporate Email'}
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="liam.foster@org.local"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-purple-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-300 mb-1">
                      {language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-purple-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-300 mb-1">
                      {language === 'ar' ? 'القسم / الإدارة' : 'Department'}
                    </label>
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-hidden focus:border-purple-500 cursor-pointer"
                    >
                      <option value="IT Service Desk">{language === 'ar' ? 'مكتب خدمة تكنولوجيا المعلومات' : 'IT Service Desk'}</option>
                      <option value="Cybersecurity (SOC)">{language === 'ar' ? 'الأمن السيبراني (SOC)' : 'Cybersecurity (SOC)'}</option>
                      <option value="Cloud Infrastructure">{language === 'ar' ? 'البنية التحتية السحابية' : 'Cloud Infrastructure'}</option>
                      <option value="Operations & Logistics">{language === 'ar' ? 'العمليات واللوجستيات' : 'Operations & Logistics'}</option>
                      <option value="Finance & Compliance">{language === 'ar' ? 'المالية والامتثال' : 'Finance & Compliance'}</option>
                      <option value="Product & Design">{language === 'ar' ? 'المنتجات والتصميم' : 'Product & Design'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-300 mb-1">
                      {language === 'ar' ? 'مستوى الصلاحية والأمان' : 'Clearance Level'}
                    </label>
                    <select
                      value={clearance}
                      onChange={(e) => setClearance(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-hidden focus:border-purple-500 cursor-pointer"
                    >
                      <option value="Level 1">{language === 'ar' ? 'المستوى 1 (اعتيادي)' : 'Level 1 (Standard)'}</option>
                      <option value="Level 2">{language === 'ar' ? 'المستوى 2 (تشغيلي)' : 'Level 2 (Operational)'}</option>
                      <option value="Level 3 - High Security">{language === 'ar' ? 'المستوى 3 (أمان فائق)' : 'Level 3 (High Security)'}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-300 mb-1">
                      {language === 'ar' ? 'المسمى الوظيفي بالإنجليزية' : 'Job Title (English)'}
                    </label>
                    <input
                      type="text"
                      value={jobTitleEn}
                      onChange={(e) => setJobTitleEn(e.target.value)}
                      placeholder="e.g. Infrastructure Engineer"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-300 mb-1">
                      {language === 'ar' ? 'المسمى الوظيفي بالعربية' : 'المسمى الوظيفي (بالعربية)'}
                    </label>
                    <input
                      type="text"
                      value={jobTitleAr}
                      onChange={(e) => setJobTitleAr(e.target.value)}
                      placeholder="مثال: مهندس بنية تحتية"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsOnboardModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer mx-1"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-md shadow-purple-600/30 cursor-pointer mx-1"
                >
                  {language === 'ar' ? 'تسجيل الموظف وتفعيل 2FA' : 'Onboard & Require 2FA'}
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
