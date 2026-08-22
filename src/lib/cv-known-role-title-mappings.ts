import { normalizeCoverLetterGender } from './cover-letter-gender';
import type { Locale } from './i18n/translations';

/** Existing product terminology for the warehouse / logistics role. */
export function localizeWarehouseEmployee(locale: Locale, gender?: string): string {
  const g = normalizeCoverLetterGender(gender);
  if (locale === 'hi') return 'वेयरहाउस कर्मचारी';
  if (locale === 'hr') {
    if (g === 'female') return 'Radnica u skladištu';
    if (g === 'male') return 'Radnik u skladištu';
    return 'Radnik u skladištu';
  }
  if (locale === 'sr') {
    return g === 'female' ? 'Radnica u magacinu' : 'Radnik u magacinu';
  }
  if (locale === 'de') return g === 'female' ? 'Lagermitarbeiterin' : 'Lagermitarbeiter';
  if (locale === 'fr') return g === 'female' ? 'Employée d’entrepôt' : 'Employé d’entrepôt';
  if (locale === 'es') return g === 'female' ? 'Empleada de almacén' : 'Empleado de almacén';
  if (locale === 'it') return g === 'female' ? 'Addetta al magazzino' : 'Addetto al magazzino';
  if (locale === 'pt-BR') return g === 'female' ? 'Funcionária de armazém' : 'Funcionário de armazém';
  if (locale === 'ru') return g === 'female' ? 'Кладовщица' : 'Кладовщик';
  if (locale === 'ar') return g === 'female' ? 'موظفة مستودع' : 'موظف مستودع';
  if (locale === 'ja') return '倉庫作業員';
  return 'Warehouse Employee';
}

/** Existing product terminology for the graphic / visual designer role. */
export function localizeGraphicDesigner(locale: Locale, gender?: string): string {
  const g = normalizeCoverLetterGender(gender);
  if (locale === 'hi') return 'ग्राफिक डिज़ाइनर';
  if (locale === 'en') return 'Graphic Designer';
  if (locale === 'hr') {
    if (g === 'female') return 'grafička dizajnerica';
    if (g === 'male') return 'grafički dizajner';
    return 'grafički dizajner';
  }
  if (locale === 'sr') {
    return g === 'female' ? 'Grafička dizajnerka' : 'Grafički dizajner';
  }
  if (locale === 'de') return g === 'female' ? 'Grafikdesignerin' : 'Grafikdesigner';
  if (locale === 'fr') return 'Graphiste';
  if (locale === 'es') return g === 'female' ? 'Diseñadora gráfica' : 'Diseñador gráfico';
  if (locale === 'it') return g === 'female' ? 'Designer grafica' : 'Designer grafico';
  if (locale === 'pt-BR') return g === 'female' ? 'Designer gráfica' : 'Designer gráfico';
  if (locale === 'ru') return 'Графический дизайнер';
  if (locale === 'ar') return g === 'female' ? 'مصممة جرافيك' : 'مصمم جرافيك';
  if (locale === 'ja') return 'グラフィックデザイナー';
  return 'Graphic Designer';
}
