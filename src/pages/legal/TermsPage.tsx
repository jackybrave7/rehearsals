import { Link } from 'react-router-dom';
import { LegalDocumentLayout, LegalParagraph, LegalSection } from '../../components/LegalDocumentLayout';
import { LEGAL_DOCUMENTS, LEGAL_OPERATOR } from '../../content/legalOperator';

const UPDATED_AT = '14 июня 2026 г.';

export function TermsPage() {
  const { fullName, serviceName, siteUrl, email } = LEGAL_OPERATOR;

  return (
    <LegalDocumentLayout title="Пользовательское соглашение" updatedAt={UPDATED_AT}>
      <LegalParagraph>
        Настоящее Пользовательское соглашение (далее — «Соглашение») регулирует отношения между{' '}
        {fullName} (далее — «Оператор») и пользователем сети Интернет (далее — «Пользователь») при
        использовании онлайн-сервиса «{serviceName}» по адресу{' '}
        <a href={siteUrl} className="text-accent hover:underline">
          {siteUrl.replace('https://', '')}
        </a>
        .
      </LegalParagraph>

      <LegalSection title="1. Предмет">
        <LegalParagraph>
          Оператор предоставляет Пользователю доступ к программному сервису для планирования
          театральных репетиций: ведение постановок, сцен, участников, расписания и связанных
          материалов. Сервис предоставляется по модели SaaS через веб-интерфейс.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="2. Регистрация и аккаунт">
        <LegalParagraph>
          Для использования сервиса Пользователь создаёт аккаунт, указывает достоверный адрес
          электронной почты и подтверждает его. Пользователь несёт ответственность за сохранность
          учётных данных и все действия, совершённые под его аккаунтом.
        </LegalParagraph>
        <LegalParagraph>
          Регистрируясь, Пользователь подтверждает, что ознакомился с настоящим Соглашением и{' '}
          <Link to={LEGAL_DOCUMENTS.privacy.path} className="text-accent hover:underline">
            Политикой конфиденциальности
          </Link>
          .
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="3. Права и обязанности сторон">
        <LegalParagraph>
          Пользователь обязуется использовать сервис законно, не нарушать права третьих лиц и не
          размещать противоправный контент. Оператор обеспечивает работоспособность сервиса в разумных
          пределах, но не гарантирует бесперебойную работу при форс-мажоре, профилактике и сбоях
          инфраструктуры.
        </LegalParagraph>
        <LegalParagraph>
          Контент, который Пользователь создаёт в сервисе (тексты, планы, файлы), остаётся в
          распоряжении Пользователя. Пользователь предоставляет Оператору право хранить и обрабатывать
          такой контент исключительно для оказания услуги.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="4. Тарифы">
        <LegalParagraph>
          Базовый функционал может предоставляться бесплатно. Расширенные возможности тарифа Pro
          описаны на странице «Тарифы» и в{' '}
          <Link to={LEGAL_DOCUMENTS.offer.path} className="text-accent hover:underline">
            Публичной оферте
          </Link>
          .
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="5. Ограничение ответственности">
        <LegalParagraph>
          Сервис предоставляется «как есть». Оператор не несёт ответственности за косвенные убытки,
          упущенную выгоду и последствия решений, принятых Пользователем на основании данных сервиса.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="6. Прекращение доступа">
        <LegalParagraph>
          Пользователь может прекратить использование сервиса в любой момент. Оператор вправе
          ограничить или прекратить доступ при нарушении Соглашения, требований закона или угрозе
          безопасности сервиса.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="7. Заключительные положения">
        <LegalParagraph>
          Оператор вправе обновлять Соглашение, публикуя новую редакцию на сайте. Продолжение
          использования сервиса после публикации означает согласие с обновлениями.
        </LegalParagraph>
        <LegalParagraph>
          По вопросам, связанным с сервисом:{' '}
          <a href={`mailto:${email}`} className="text-accent hover:underline">
            {email}
          </a>
          .
        </LegalParagraph>
      </LegalSection>
    </LegalDocumentLayout>
  );
}
