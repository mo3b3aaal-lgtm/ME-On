import { AppLanguage, getAppLanguage } from './i18n';

export interface EducationalStage {
  id: string;
  level: 'primary' | 'preparatory' | 'secondary' | 'other';
  names: {
    ar: string;
    'en-GB': string;
    'en-US': string;
  };
}

export const EDUCATIONAL_STAGES: EducationalStage[] = [
  // Primary (الابتدائي)
  {
    id: 'primary_1',
    level: 'primary',
    names: {
      ar: 'الصف الأول الابتدائي',
      'en-GB': 'Year 1 (Primary 1)',
      'en-US': '1st Grade (Elementary)',
    },
  },
  {
    id: 'primary_2',
    level: 'primary',
    names: {
      ar: 'الصف الثاني الابتدائي',
      'en-GB': 'Year 2 (Primary 2)',
      'en-US': '2nd Grade (Elementary)',
    },
  },
  {
    id: 'primary_3',
    level: 'primary',
    names: {
      ar: 'الصف الثالث الابتدائي',
      'en-GB': 'Year 3 (Primary 3)',
      'en-US': '3rd Grade (Elementary)',
    },
  },
  {
    id: 'primary_4',
    level: 'primary',
    names: {
      ar: 'الصف الرابع الابتدائي',
      'en-GB': 'Year 4 (Primary 4)',
      'en-US': '4th Grade (Elementary)',
    },
  },
  {
    id: 'primary_5',
    level: 'primary',
    names: {
      ar: 'الصف الخامس الابتدائي',
      'en-GB': 'Year 5 (Primary 5)',
      'en-US': '5th Grade (Elementary)',
    },
  },
  {
    id: 'primary_6',
    level: 'primary',
    names: {
      ar: 'الصف السادس الابتدائي',
      'en-GB': 'Year 6 (Primary 6)',
      'en-US': '6th Grade (Elementary)',
    },
  },

  // Preparatory (الإعدادي)
  {
    id: 'prep_1',
    level: 'preparatory',
    names: {
      ar: 'الصف الأول الإعدادي',
      'en-GB': 'Year 7 (Prep 1)',
      'en-US': '7th Grade (Middle School)',
    },
  },
  {
    id: 'prep_2',
    level: 'preparatory',
    names: {
      ar: 'الصف الثاني الإعدادي',
      'en-GB': 'Year 8 (Prep 2)',
      'en-US': '8th Grade (Middle School)',
    },
  },
  {
    id: 'prep_3',
    level: 'preparatory',
    names: {
      ar: 'الصف الثالث الإعدادي',
      'en-GB': 'Year 9 (Prep 3)',
      'en-US': '9th Grade (Middle School)',
    },
  },

  // Secondary (الثانوي)
  {
    id: 'sec_1',
    level: 'secondary',
    names: {
      ar: 'الصف الأول الثانوي',
      'en-GB': 'Year 10 (Sec 1)',
      'en-US': '10th Grade (High School)',
    },
  },
  {
    id: 'sec_2',
    level: 'secondary',
    names: {
      ar: 'الصف الثاني الثانوي',
      'en-GB': 'Year 11 (Sec 2)',
      'en-US': '11th Grade (High School)',
    },
  },
  {
    id: 'sec_3',
    level: 'secondary',
    names: {
      ar: 'الصف الثالث الثانوي',
      'en-GB': 'Year 12 (Sec 3)',
      'en-US': '12th Grade (High School)',
    },
  },

  // Other (أخرى)
  {
    id: 'other',
    level: 'other',
    names: {
      ar: 'أخرى / عام',
      'en-GB': 'Other / General',
      'en-US': 'Other / General',
    },
  },
];

// Helper to get localized stage name from any stored string or id
export function getLocalizedStageName(stageIdentifier: string | undefined, lang?: AppLanguage): string {
  if (!stageIdentifier) return '';
  const currentLang = lang || getAppLanguage();

  // Direct match by ID
  const foundById = EDUCATIONAL_STAGES.find((s) => s.id === stageIdentifier);
  if (foundById) return foundById.names[currentLang] || foundById.names.ar;

  // Match by any of the localized names
  const foundByName = EDUCATIONAL_STAGES.find((s) =>
    s.names.ar === stageIdentifier ||
    s.names['en-GB'] === stageIdentifier ||
    s.names['en-US'] === stageIdentifier
  );
  if (foundByName) return foundByName.names[currentLang] || foundByName.names.ar;

  // Fuzzy matches for legacy stored values
  if (stageIdentifier.includes('أول') && stageIdentifier.includes('ثانوي')) return EDUCATIONAL_STAGES.find((s) => s.id === 'sec_1')?.names[currentLang] || stageIdentifier;
  if (stageIdentifier.includes('ثاني') && stageIdentifier.includes('ثانوي')) return EDUCATIONAL_STAGES.find((s) => s.id === 'sec_2')?.names[currentLang] || stageIdentifier;
  if (stageIdentifier.includes('ثالث') && stageIdentifier.includes('ثانوي')) return EDUCATIONAL_STAGES.find((s) => s.id === 'sec_3')?.names[currentLang] || stageIdentifier;

  if (stageIdentifier.includes('أول') && stageIdentifier.includes('إعدادي')) return EDUCATIONAL_STAGES.find((s) => s.id === 'prep_1')?.names[currentLang] || stageIdentifier;
  if (stageIdentifier.includes('ثاني') && stageIdentifier.includes('إعدادي')) return EDUCATIONAL_STAGES.find((s) => s.id === 'prep_2')?.names[currentLang] || stageIdentifier;
  if (stageIdentifier.includes('ثالث') && stageIdentifier.includes('إعدادي')) return EDUCATIONAL_STAGES.find((s) => s.id === 'prep_3')?.names[currentLang] || stageIdentifier;

  if (stageIdentifier.includes('أول') && stageIdentifier.includes('ابتدائي')) return EDUCATIONAL_STAGES.find((s) => s.id === 'primary_1')?.names[currentLang] || stageIdentifier;
  if (stageIdentifier.includes('ثاني') && stageIdentifier.includes('ابتدائي')) return EDUCATIONAL_STAGES.find((s) => s.id === 'primary_2')?.names[currentLang] || stageIdentifier;
  if (stageIdentifier.includes('ثالث') && stageIdentifier.includes('ابتدائي')) return EDUCATIONAL_STAGES.find((s) => s.id === 'primary_3')?.names[currentLang] || stageIdentifier;
  if (stageIdentifier.includes('رابع') && stageIdentifier.includes('ابتدائي')) return EDUCATIONAL_STAGES.find((s) => s.id === 'primary_4')?.names[currentLang] || stageIdentifier;
  if (stageIdentifier.includes('خامس') && stageIdentifier.includes('ابتدائي')) return EDUCATIONAL_STAGES.find((s) => s.id === 'primary_5')?.names[currentLang] || stageIdentifier;
  if (stageIdentifier.includes('سادس') && stageIdentifier.includes('ابتدائي')) return EDUCATIONAL_STAGES.find((s) => s.id === 'primary_6')?.names[currentLang] || stageIdentifier;

  return stageIdentifier;
}

// Stage level badges translation
export const STAGE_LEVEL_LABELS = {
  primary: {
    ar: 'المرحلة الابتدائية',
    'en-GB': 'Primary School',
    'en-US': 'Elementary School',
  },
  preparatory: {
    ar: 'المرحلة الإعدادية',
    'en-GB': 'Preparatory / Middle',
    'en-US': 'Middle School',
  },
  secondary: {
    ar: 'المرحلة الثانوية',
    'en-GB': 'Secondary / High',
    'en-US': 'High School',
  },
  other: {
    ar: 'أخرى',
    'en-GB': 'Other',
    'en-US': 'Other',
  },
};

export const STAGES_HIERARCHY = [
  {
    id: 'primary',
    nameAr: 'المرحلة الابتدائية',
    nameEn: 'Primary School',
    grades: EDUCATIONAL_STAGES.filter((s) => s.level === 'primary').map((s) => ({
      id: s.id,
      nameAr: s.names.ar,
      nameEn: s.names['en-GB'],
      nameUS: s.names['en-US'],
    })),
  },
  {
    id: 'preparatory',
    nameAr: 'المرحلة الإعدادية',
    nameEn: 'Preparatory School',
    grades: EDUCATIONAL_STAGES.filter((s) => s.level === 'preparatory').map((s) => ({
      id: s.id,
      nameAr: s.names.ar,
      nameEn: s.names['en-GB'],
      nameUS: s.names['en-US'],
    })),
  },
  {
    id: 'secondary',
    nameAr: 'المرحلة الثانوية',
    nameEn: 'Secondary School',
    grades: EDUCATIONAL_STAGES.filter((s) => s.level === 'secondary').map((s) => ({
      id: s.id,
      nameAr: s.names.ar,
      nameEn: s.names['en-GB'],
      nameUS: s.names['en-US'],
    })),
  },
  {
    id: 'other',
    nameAr: 'أخرى / عام',
    nameEn: 'Other / General',
    grades: EDUCATIONAL_STAGES.filter((s) => s.level === 'other').map((s) => ({
      id: s.id,
      nameAr: s.names.ar,
      nameEn: s.names['en-GB'],
      nameUS: s.names['en-US'],
    })),
  },
];

export const ALL_GRADE_LEVELS = EDUCATIONAL_STAGES.map((s) => s.names.ar);
export const ALL_GRADE_OPTIONS = ALL_GRADE_LEVELS;
export const GRADE_STAGES = STAGES_HIERARCHY;

export function getStageByGrade(gradeName: string | undefined): string {
  if (!gradeName) return 'secondary';
  const stage = EDUCATIONAL_STAGES.find(
    (s) =>
      s.names.ar === gradeName ||
      s.names['en-GB'] === gradeName ||
      s.names['en-US'] === gradeName ||
      s.id === gradeName
  );
  if (stage) return stage.level;
  if (gradeName.includes('ابتدائي')) return 'primary';
  if (gradeName.includes('إعدادي')) return 'preparatory';
  if (gradeName.includes('ثانوي')) return 'secondary';
  return 'other';
}
