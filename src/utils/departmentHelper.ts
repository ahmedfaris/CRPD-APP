/**
 * Department Matching & Equivalency Helper
 * Normalizes English and Arabic department variations and abbreviations
 */

const DEPARTMENT_EQUIVALENTS: Record<string, string[]> = {
  'information technology': [
    'information technology',
    'تكنولوجيا المعلومات',
    'it',
    'it department',
    'it security & ops',
    'it service desk',
    'systems engineering'
  ],
  'operations': [
    'operations',
    'العمليات',
    'العمليات والتنفيذ',
    'operations & logistics'
  ],
  'electronic archiving & records': [
    'electronic archiving & records',
    'الأرشفة الإلكترونية والسجلات',
    'electronic archiving',
    'archiving'
  ],
  'customer support & helpdesk': [
    'customer support & helpdesk',
    'دعم العملاء ومكتب المساعدة',
    'helpdesk',
    'customer support'
  ],
  'human resources': [
    'human resources',
    'الموارد البشرية',
    'hr'
  ],
  'software development': [
    'software development',
    'تطوير البرمجيات',
    'development'
  ],
  'cybersecurity': [
    'cybersecurity',
    'الأمن السيبراني',
    'cybersecurity (soc)',
    'security'
  ],
  'cloud infrastructure': [
    'cloud infrastructure',
    'البنية التحتية السحابية',
    'cloud'
  ],
  'finance & accounting': [
    'finance & accounting',
    'المالية والمحاسبة',
    'finance'
  ],
  'executive management': [
    'executive management',
    'الإدارة التنفيذية'
  ]
};

export function isSameDepartment(dept1?: string | null, dept2?: string | null): boolean {
  if (!dept1 || !dept2) return false;
  const d1 = dept1.trim().toLowerCase();
  const d2 = dept2.trim().toLowerCase();
  if (d1 === d2) return true;

  // Check known equivalency groups
  for (const group of Object.values(DEPARTMENT_EQUIVALENTS)) {
    const in1 = group.some(item => d1 === item || d1.includes(item) || item.includes(d1));
    const in2 = group.some(item => d2 === item || d2.includes(item) || item.includes(d2));
    if (in1 && in2) return true;
  }

  return d1.includes(d2) || d2.includes(d1);
}
