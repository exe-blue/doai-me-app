import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ko from './locales/ko.json';

// i18n 리소스 정의
const resources = {
  en: { translation: en },
  ko: { translation: ko }
};

// i18n 초기화
i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: navigator.language.startsWith('ko') ? 'ko' : 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // React는 기본적으로 XSS 방지함
    }
  });

export default i18n;


