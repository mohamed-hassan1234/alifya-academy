import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en';
import so from './so';

const STORAGE_KEY = 'alf_lang';

function initialLanguage(): 'en' | 'so' {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'so') return saved;
  } catch {
    /* storage unavailable */
  }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('so') ? 'so' : 'en';
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, so: { translation: so } },
  lng: initialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React already escapes
  returnNull: false,
});

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    /* ignore */
  }
});
if (typeof document !== 'undefined') document.documentElement.lang = i18n.language;

export default i18n;
