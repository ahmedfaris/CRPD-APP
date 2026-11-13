// Shared helpers for showing managed asset types (icons, labels, lookups).
import React from 'react';
import {
  Computer, Laptop, Printer, Monitor, ScanLine, Fingerprint, Server, Router, Network, Wifi,
  Phone, Tablet, Camera, Projector, HardDrive, BatteryCharging, Keyboard, Cpu, type LucideIcon,
} from 'lucide-react';
import { AssetType } from '../types';

/** Icon keys the server accepts (see assetTypeRoutes.ts), with the icon and a colour for each. */
export const ASSET_TYPE_ICONS: Record<string, { Icon: LucideIcon; color: string; labelEn: string; labelAr: string }> = {
  computer: { Icon: Computer, color: 'text-blue-500', labelEn: 'Computer', labelAr: 'حاسوب' },
  laptop: { Icon: Laptop, color: 'text-blue-500', labelEn: 'Laptop', labelAr: 'حاسوب محمول' },
  printer: { Icon: Printer, color: 'text-amber-500', labelEn: 'Printer', labelAr: 'طابعة' },
  monitor: { Icon: Monitor, color: 'text-purple-500', labelEn: 'Monitor', labelAr: 'شاشة' },
  scanner: { Icon: ScanLine, color: 'text-cyan-500', labelEn: 'Scanner', labelAr: 'ماسح' },
  fingerprint: { Icon: Fingerprint, color: 'text-emerald-500', labelEn: 'Fingerprint', labelAr: 'بصمة' },
  server: { Icon: Server, color: 'text-indigo-500', labelEn: 'Server', labelAr: 'خادم' },
  router: { Icon: Router, color: 'text-indigo-500', labelEn: 'Router', labelAr: 'راوتر' },
  switch: { Icon: Network, color: 'text-teal-500', labelEn: 'Switch', labelAr: 'سويتش' },
  wifi: { Icon: Wifi, color: 'text-sky-500', labelEn: 'Wireless', labelAr: 'لاسلكي' },
  phone: { Icon: Phone, color: 'text-rose-500', labelEn: 'Phone', labelAr: 'هاتف' },
  tablet: { Icon: Tablet, color: 'text-blue-400', labelEn: 'Tablet', labelAr: 'جهاز لوحي' },
  camera: { Icon: Camera, color: 'text-orange-500', labelEn: 'Camera', labelAr: 'كاميرا' },
  projector: { Icon: Projector, color: 'text-fuchsia-500', labelEn: 'Projector', labelAr: 'جهاز عرض' },
  storage: { Icon: HardDrive, color: 'text-slate-500', labelEn: 'Storage', labelAr: 'تخزين' },
  ups: { Icon: BatteryCharging, color: 'text-lime-500', labelEn: 'UPS / Power', labelAr: 'طاقة احتياطية' },
  keyboard: { Icon: Keyboard, color: 'text-slate-400', labelEn: 'Peripheral', labelAr: 'ملحقات' },
  device: { Icon: Cpu, color: 'text-slate-500', labelEn: 'Other device', labelAr: 'جهاز آخر' },
};

/** Find the managed type for a device's stored deviceType (key, or a name for older data). */
export function findAssetType(types: AssetType[], deviceType?: string | null): AssetType | undefined {
  const v = String(deviceType || '').trim().toLowerCase();
  if (!v) return undefined;
  return types.find(t => t.key.toLowerCase() === v)
    || types.find(t => t.nameEn.toLowerCase() === v || t.nameAr.toLowerCase() === v);
}

/** Display name of a device type in the current language (falls back to the stored value). */
export function assetTypeLabel(types: AssetType[], deviceType: string | undefined | null, language: string): string {
  const t = findAssetType(types, deviceType);
  if (!t) return deviceType || '';
  return language === 'ar' ? (t.nameAr || t.nameEn) : (t.nameEn || t.nameAr);
}

export function AssetTypeIcon({ icon, className = 'w-5 h-5' }: { icon?: string; className?: string }) {
  const entry = ASSET_TYPE_ICONS[icon || 'device'] || ASSET_TYPE_ICONS.device;
  const { Icon, color } = entry;
  return <Icon className={`${className} ${color}`} />;
}

/** Icon for a device, using its managed type when known. */
export function DeviceTypeIcon({ types, deviceType, category, className }: { types: AssetType[]; deviceType?: string; category?: string; className?: string }) {
  const t = findAssetType(types, deviceType);
  return <AssetTypeIcon icon={t?.icon || (category === 'network' ? 'switch' : 'device')} className={className} />;
}
