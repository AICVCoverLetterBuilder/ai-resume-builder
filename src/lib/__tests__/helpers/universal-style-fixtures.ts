import type { Locale } from '@/lib/i18n/translations';
import type { CVData } from '@/lib/types';

type LocaleFixture = {
  roleC: string;
  roleP: string;
  current: string;
  prior: string;
  scriptProbe?: RegExp;
  latinLeak?: RegExp;
};

/** Locale-native free-text roles + duties (arbitrary occupations, not warehouse tables). */
export const UNIVERSAL_STYLE_FIXTURES: Record<Locale, LocaleFixture> = {
  en: {
    roleC: 'Bicycle Mechanic',
    roleP: 'Bike Shop Assistant',
    current: 'Performs bicycle maintenance.\nInspects bikes for defects.\nReplaces defective bicycle parts.',
    prior: 'Inspected bikes for defects.\nRecorded repair notes.\nReplaced worn bicycle parts.',
  },
  de: {
    roleC: 'Fahrradmechaniker',
    roleP: 'Fahrradwerkstatt-Assistent',
    current: 'Führt Wartungsarbeiten an Fahrrädern durch.\nPrüft Fahrräder auf technische Mängel.\nTauscht defekte Bauteile an Fahrrädern aus.',
    prior: 'Prüfte Fahrräder auf technische Mängel.\nErfasste Reparaturhinweise.\nTauschte defekte Bauteile an Fahrrädern aus.',
  },
  es: {
    roleC: 'Mecánico de bicicletas',
    roleP: 'Ayudante de taller de bicicletas',
    current: 'Realiza el mantenimiento de bicicletas.\nInspecciona bicicletas en busca de defectos.\nSustituye piezas defectuosas de bicicletas.',
    prior: 'Inspeccionó bicicletas en busca de defectos.\nRegistró notas de reparación.\nSustituyó piezas defectuosas de bicicletas.',
  },
  fr: {
    roleC: 'Mécanicien vélo',
    roleP: 'Assistant atelier vélo',
    current: 'Effectue l’entretien des vélos.\nInspecte les vélos pour détecter les défauts.\nRemplace les pièces défectueuses des vélos.',
    prior: 'Inspectait les vélos pour détecter les défauts.\nEnregistrait les notes de réparation.\nRemplaçait les pièces défectueuses des vélos.',
  },
  it: {
    roleC: 'Meccanico di biciclette',
    roleP: 'Assistente officina biciclette',
    current: 'Esegue la manutenzione delle biciclette.\nControlla le biciclette per difetti.\nSostituisce i pezzi difettosi delle biciclette.',
    prior: 'Ho controllato le biciclette per difetti.\nHo registrato note di riparazione.\nHo sostituito i pezzi difettosi delle biciclette.',
  },
  ar: {
    roleC: 'ميكانيكي دراجات',
    roleP: 'مساعد ورشة دراجات',
    current: 'ينفذ أعمال صيانة الدراجات.\nيفحص الدراجات بحثاً عن الأعطال.\nيستبدل القطع المعيبة في الدراجات.',
    prior: 'راجع الدراجات بحثاً عن الأعطال.\nأعدّ ملاحظات الإصلاح.\nضبط القطع المعيبة في الدراجات.',
    scriptProbe: /[\u0600-\u06FF]/,
    latinLeak: /\b(?:I currently|Team leader|Leadership)\b/,
  },
  sr: {
    roleC: 'Biciklistički mehaničar',
    roleP: 'Asistent u radionici bicikala',
    current: 'Obavlja održavanje bicikala.\nPregleda bicikle zbog kvarova.\nMenja neispravne delove bicikala.',
    prior: 'Pregledao bicikle zbog kvarova.\nBeležio napomene o popravkama.\nMenjao neispravne delove bicikala.',
  },
  hr: {
    roleC: 'Biciklistički mehaničar',
    roleP: 'Asistent u radionici bicikala',
    current: 'Obavlja održavanje bicikala.\nPregledava bicikle zbog kvarova.\nMijenja neispravne dijelove bicikala.',
    prior: 'Pregledavao bicikle zbog kvarova.\nBilježio napomene o popravcima.\nMijenjao neispravne dijelove bicikala.',
  },
  ru: {
    roleC: 'Веломеханик',
    roleP: 'Помощник в веломастерской',
    current: 'Выполняет техническое обслуживание велосипедов.\nПроверяет велосипеды на дефекты.\nЗаменяет неисправные детали велосипедов.',
    prior: 'Проверял велосипеды на дефекты.\nФиксировал заметки о ремонте.\nЗаменял неисправные детали велосипедов.',
    scriptProbe: /[\u0400-\u04FF]/,
  },
  'pt-BR': {
    roleC: 'Mecânico de bicicletas',
    roleP: 'Assistente de oficina de bicicletas',
    current: 'Realiza a manutenção de bicicletas.\nInspeciona bicicletas em busca de defeitos.\nSubstitui peças defeituosas de bicicletas.',
    prior: 'Inspecionava bicicletas em busca de defeitos.\nRegistrava notas de reparo.\nSubstituía peças defeituosas de bicicletas.',
  },
  hi: {
    roleC: 'साइकिल मैकेनिक',
    roleP: 'साइकिल वर्कशॉप सहायक',
    current: 'साइकिलों का रखरखाव करता है।\nसाइकिलों में खराबी की जाँच करता है।\nसाइकिलों के खराब पुर्जे बदलता है।',
    prior: 'साइकिलों में खराबी की जाँच की।\nमरम्मत नोट दर्ज किए।\nखराब पुर्जे बदले।',
    scriptProbe: /[\u0900-\u097F]/,
  },
  ja: {
    roleC: '自転車整備士',
    roleP: '自転車店アシスタント',
    current: '自転車の整備を行う。\n自転車の不具合を点検する。\n自転車の不良部品を交換する。',
    prior: '自転車の不具合を点検した。\n修理メモを記録した。\n不良部品を交換した。',
    scriptProbe: /[\u3040-\u30FF\u4E00-\u9FFF]/,
  },
};


export function cvForUniversalStyle(locale: Locale, summary: string): CVData {
  const f = UNIVERSAL_STYLE_FIXTURES[locale];
  return {
    id: `aab-style-${locale}`,
    name: `Universal Style ${locale}`,
    personal: {
      fullName: 'Test User',
      email: 't@example.com',
      phone: '',
      address: '',
      jobTitle: f.roleC,
      gender: 'male',
    },
    summary,
    experience: [
      {
        id: 'radwerk',
        position: f.roleC,
        company: 'RadWerk',
        startDate: '2024-01',
        endDate: '',
        isPresent: true,
        description: f.current,
        originalUserDescription: f.current,
        descriptionOrigin: 'user' as const,
      },
      {
        id: 'stadthotel',
        position: f.roleP,
        company: 'StadtHotel',
        startDate: '2021-01',
        endDate: '2023-12',
        isPresent: false,
        description: f.prior,
        originalUserDescription: f.prior,
        descriptionOrigin: 'user' as const,
      },
    ],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    projects: [],
    templateId: 'modern',
    contentLocale: locale,
  } as CVData;
}
