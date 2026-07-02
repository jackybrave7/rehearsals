/** Оператор сервиса «Репетиции» (rehears.ru). */
export const LEGAL_OPERATOR = {
  fullName: 'ИП Алферов Евгений Александрович',
  shortName: 'ИП Алферов Е.А.',
  inn: '772023445483',
  ogrnip: '324774600516113',
  region: 'г. Москва, Россия',
  email: 'support@rehears.ru',
  siteUrl: 'https://rehears.ru',
  serviceName: 'Репетиции',
} as const;

export const LEGAL_DOCUMENTS = {
  terms: {
    path: '/legal/terms',
    title: 'Пользовательское соглашение',
  },
  privacy: {
    path: '/legal/privacy',
    title: 'Политика конфиденциальности',
  },
  offer: {
    path: '/legal/offer',
    title: 'Публичная оферта',
  },
} as const;
