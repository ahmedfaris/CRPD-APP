import React, { useState } from 'react';
import { Star, Clock } from 'lucide-react';
import { PriorityStars, TicketPriority } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface StarPrioritySelectorProps {
  stars?: PriorityStars;
  value?: PriorityStars;
  onChange: (stars: PriorityStars, priority: TicketPriority) => void;
  disabled?: boolean;
}

export function starsToPriority(stars: PriorityStars): TicketPriority {
  switch (stars) {
    case 3:
      return 'High'; // Urgent / Sev-1
    case 2:
      return 'Medium'; // Elevated
    case 1:
    default:
      return 'Low'; // Standard
  }
}

export function priorityToStars(priority: TicketPriority): PriorityStars {
  switch (priority) {
    case 'Critical':
    case 'High':
      return 3;
    case 'Medium':
      return 2;
    case 'Low':
    default:
      return 1;
  }
}

export function StarPrioritySelector({ stars, value, onChange, disabled = false }: StarPrioritySelectorProps) {
  const { language, t } = useLanguage();
  const currentStars = value !== undefined ? value : (stars !== undefined ? stars : 2);
  const [hoverStars, setHoverStars] = useState<number | null>(null);

  const activeStars = hoverStars !== null ? hoverStars : currentStars;

  const handleSelect = (selectedStars: PriorityStars) => {
    if (disabled) return;
    onChange(selectedStars, starsToPriority(selectedStars));
  };

  const getPriorityDescription = (count: number) => {
    if (language === 'ar') {
      switch (count) {
        case 3:
          return {
            title: '★★★ أولوية قصوى / حرجة (3 نجوم)',
            subtitle: 'عطل حرج بالخدمات، توقف العمليات التشغيلية (SLA: استجابة 15 دقيقة / معالجة ساعتين)',
            badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
            levelText: 'المستوى 3 من 3'
          };
        case 2:
          return {
            title: '★★☆ أولوية متوسطة / مرتفعة (2 نجمتان)',
            subtitle: 'مشكلة تشغيلية تؤثر على مستخدم أو سير عمل (SLA: استجابة ساعتين / معالجة 8 ساعات)',
            badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
            levelText: 'المستوى 2 من 3'
          };
        case 1:
        default:
          return {
            title: '★☆☆ أولوية اعتيادية / عامة (1 نجمة)',
            subtitle: 'استفسار عام، صيانة روتينية أو طلب بسيط (SLA: استجابة 4 ساعات / معالجة 24 ساعة)',
            badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
            levelText: 'المستوى 1 من 3'
          };
      }
    }

    switch (count) {
      case 3:
        return {
          title: '3 Stars — Urgent / High Priority',
          subtitle: 'Critical service interruption or high business impact (SLA: 1h Response / 4h Resolution)',
          badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
          levelText: 'Level 3 of 3'
        };
      case 2:
        return {
          title: '2 Stars — Medium / Elevated Priority',
          subtitle: 'Normal operational issue affecting single user or workflow (SLA: 4h Response / 24h Resolution)',
          badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
          levelText: 'Level 2 of 3'
        };
      case 1:
      default:
        return {
          title: '1 Star — Standard / Low Priority',
          subtitle: 'General inquiry, routine task, or minor feature request (SLA: 8h Response / 48h Resolution)',
          badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
          levelText: 'Level 1 of 3'
        };
    }
  };

  const info = getPriorityDescription(activeStars);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          {language === 'ar' ? 'أولوية التذكرة (اختيار بـ 3 نجوم صفراء)' : 'Ticket Priority (Select by 3 Yellow Stars)'}
        </label>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${info.badgeColor}`}>
          {info.levelText}
        </span>
      </div>

      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Interactive 3 Yellow Stars */}
        <div className="flex items-center space-x-1.5 select-none">
          {[1, 2, 3].map((starIndex) => {
            const isFilled = starIndex <= activeStars;
            return (
              <button
                key={starIndex}
                type="button"
                disabled={disabled}
                onClick={() => handleSelect(starIndex as PriorityStars)}
                onMouseEnter={() => !disabled && setHoverStars(starIndex)}
                onMouseLeave={() => !disabled && setHoverStars(null)}
                className={`p-1.5 rounded-lg transition transform ${
                  disabled 
                    ? 'cursor-not-allowed opacity-60' 
                    : 'cursor-pointer hover:scale-110 active:scale-95'
                }`}
                title={language === 'ar' ? `تحديد ${starIndex} نجوم` : `Select ${starIndex} Star${starIndex > 1 ? 's' : ''}`}
              >
                <Star
                  className={`w-7 h-7 transition-colors duration-150 ${
                    isFilled
                      ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                      : 'fill-slate-200 text-slate-300 hover:text-amber-300'
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Priority description & SLA badge */}
        <div className={language === 'ar' ? 'text-right' : 'text-left'}>
          <div className="text-xs font-bold text-slate-900">{info.title}</div>
          <div className="text-[11px] text-slate-500 flex items-center space-x-1 mt-0.5">
            <Clock className="w-3 h-3 text-amber-500 shrink-0" />
            <span>{info.subtitle}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Visual badge for tables and list rows
 */
export function StarPriorityBadge({ stars }: { stars: PriorityStars | number }) {
  const { language } = useLanguage();
  const count = Math.max(1, Math.min(3, stars || 1));
  const label = language === 'ar'
    ? (count === 3 ? 'حرج' : count === 2 ? 'متوسط' : 'عادي')
    : (count === 3 ? 'High' : count === 2 ? 'Medium' : 'Standard');
    
  const color = count === 3 ? 'text-rose-700 bg-rose-50 border-rose-200' : count === 2 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-slate-700 bg-slate-50 border-slate-200';

  return (
    <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-semibold border ${color}`}>
      <span className="flex items-center space-x-0.5">
        {[1, 2, 3].map((s) => (
          <Star
            key={s}
            className={`w-3 h-3 ${
              s <= count 
                ? 'fill-amber-400 text-amber-400' 
                : 'fill-slate-200 text-slate-200'
            }`}
          />
        ))}
      </span>
      <span className="text-[11px] font-medium mx-1">{label}</span>
    </span>
  );
}
