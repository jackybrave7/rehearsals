import { Link } from 'react-router-dom';
import { LegalDocumentLayout, LegalParagraph, LegalSection } from '../../components/LegalDocumentLayout';
import { LEGAL_DOCUMENTS, LEGAL_OPERATOR } from '../../content/legalOperator';

const UPDATED_AT = '14 июня 2026 г.';

export function PrivacyPage() {
  const { fullName, serviceName, siteUrl, email, inn, ogrnip, region } = LEGAL_OPERATOR;

  return (
    <LegalDocumentLayout title="Политика конфиденциальности" updatedAt={UPDATED_AT}>
      <LegalParagraph>
        Настоящая Политика описывает, как {fullName} (ИНН {inn}, ОГРНИП {ogrnip}, {region})
        обрабатывает персональные данные пользователей сервиса «{serviceName}» (
        <a href={siteUrl} className="text-accent hover:underline">
          {siteUrl.replace('https://', '')}
        </a>
        ) в соответствии с Федеральным законом № 152-ФЗ «О персональных данных».
      </LegalParagraph>

      <LegalSection title="1. Оператор персональных данных">
        <LegalParagraph>
          Оператор: {fullName}. Контакт по вопросам персональных данных:{' '}
          <a href={`mailto:${email}`} className="text-accent hover:underline">
            {email}
          </a>
          .
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="2. Какие данные обрабатываются">
        <LegalParagraph>
          При регистрации и использовании сервиса могут обрабатываться: имя, адрес электронной почты,
          хэш пароля, данные сессии, сведения о театрах и постановках, которые Пользователь вводит
          самостоятельно (в том числе ФИО участников, контакты, расписание, тексты, загруженные
          файлы), технические данные (IP-адрес, сведения браузера, cookies сессии).
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="3. Цели обработки">
        <LegalParagraph>
          Регистрация и аутентификация, предоставление функций сервиса, техническая поддержка,
          уведомления о работе аккаунта (в том числе подтверждение email и восстановление доступа),
          обеспечение безопасности, исполнение{' '}
          <Link to={LEGAL_DOCUMENTS.terms.path} className="text-accent hover:underline">
            Пользовательского соглашения
          </Link>
          .
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="4. Правовые основания">
        <LegalParagraph>
          Обработка осуществляется на основании согласия Пользователя, необходимости исполнения
          договора (оказания услуги), а также законных интересов Оператора по обеспечению
          безопасности сервиса.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="5. Передача третьим лицам">
        <LegalParagraph>
          Данные не продаются. Передача возможна подрядчикам, обеспечивающим хостинг, доставку
          почтовых сообщений и интеграции, выбранные Пользователем (например, Google, Telegram), —
          в объёме, необходимом для работы соответствующей функции.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="6. Хранение и защита">
        <LegalParagraph>
          Данные хранятся на серверах, используемых для работы сервиса. Оператор применяет
          организационные и технические меры защиты. Срок хранения — пока действует аккаунт и далее в
          пределах, необходимых по закону или для разрешения споров.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="7. Права субъекта персональных данных">
        <LegalParagraph>
          Пользователь вправе запросить уточнение, блокирование или удаление данных, отозвать согласие
          и обратиться с жалобой в уполномоченный орган. Запрос направляется на{' '}
          <a href={`mailto:${email}`} className="text-accent hover:underline">
            {email}
          </a>
          .
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="8. Cookies">
        <LegalParagraph>
          Сервис использует технические cookies для поддержания сессии авторизации. Отключение cookies
          может сделать вход в аккаунт невозможным.
        </LegalParagraph>
      </LegalSection>
    </LegalDocumentLayout>
  );
}
