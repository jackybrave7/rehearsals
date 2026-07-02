import { Link } from 'react-router-dom';
import { LegalDocumentLayout, LegalParagraph, LegalSection } from '../../components/LegalDocumentLayout';
import { LEGAL_DOCUMENTS, LEGAL_OPERATOR } from '../../content/legalOperator';
import { PRO_PRICING } from '../../types/subscription';

const UPDATED_AT = '14 июня 2026 г.';

export function OfferPage() {
  const { fullName, serviceName, siteUrl, email, inn, ogrnip, region } = LEGAL_OPERATOR;

  return (
    <LegalDocumentLayout title="Публичная оферта на тариф Pro" updatedAt={UPDATED_AT}>
      <LegalParagraph>
        Настоящий документ является публичной офертой {fullName} (ИНН {inn}, ОГРНИП {ogrnip},{' '}
        {region}) в адрес физических и юридических лиц на заключение договора оказания услуг по
        предоставлению расширенного доступа к сервису «{serviceName}» (тариф Pro).
      </LegalParagraph>

      <LegalSection title="1. Термины">
        <LegalParagraph>
          «Исполнитель» — {fullName}. «Заказчик» — лицо, принявшее оферту. «Сервис» — веб-приложение
          по адресу{' '}
          <a href={siteUrl} className="text-accent hover:underline">
            {siteUrl.replace('https://', '')}
          </a>
          . «Тариф Pro» — платный план с расширенными возможностями, описанными на странице «Тарифы».
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="2. Предмет договора">
        <LegalParagraph>
          Исполнитель предоставляет Заказчику доступ к функциям тарифа Pro на срок оплаченного
          периода. Акцепт оферты — направление заявки на подключение Pro на{' '}
          <a href={`mailto:${email}`} className="text-accent hover:underline">
            {email}
          </a>{' '}
          и/или фактическая оплата по счёту, и/или активация тарифа Исполнителем по согласованию с
          Заказчиком.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="3. Стоимость">
        <LegalParagraph>
          Стоимость тарифа Pro: {PRO_PRICING.monthlyRub.toLocaleString('ru-RU')} ₽ в месяц или{' '}
          {PRO_PRICING.yearlyRub.toLocaleString('ru-RU')} ₽ в год (актуальные цены также указаны на
          сайте). Исполнитель вправе изменять цены для новых периодов, уведомив Заказчика заранее.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="4. Порядок оказания услуг">
        <LegalParagraph>
          После подтверждения оплаты или согласования заявки Исполнитель активирует тариф Pro для
          аккаунта Заказчика. Услуга считается оказанной с момента предоставления доступа к функциям
          тарифа.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="5. Возврат">
        <LegalParagraph>
          Если доступ к Pro не был предоставлен по вине Исполнителя, Заказчик вправе потребовать
          возврат оплаты. В иных случаях возврат за уже оказанный период не производится, если иное
          не согласовано сторонами.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="6. Прочие условия">
        <LegalParagraph>
          К отношениям сторон применяются также{' '}
          <Link to={LEGAL_DOCUMENTS.terms.path} className="text-accent hover:underline">
            Пользовательское соглашение
          </Link>{' '}
          и{' '}
          <Link to={LEGAL_DOCUMENTS.privacy.path} className="text-accent hover:underline">
            Политика конфиденциальности
          </Link>
          . По всем вопросам:{' '}
          <a href={`mailto:${email}`} className="text-accent hover:underline">
            {email}
          </a>
          .
        </LegalParagraph>
      </LegalSection>
    </LegalDocumentLayout>
  );
}
