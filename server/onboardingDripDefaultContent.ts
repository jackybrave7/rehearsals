import {
  dripBodyHtmlFromParagraphs,
  dripEmailGuideImage,
  dripEmailInlineLink,
  dripEmailTip,
} from '../shared/dripEmailBody.js';
import { wrapFullDripEmailHtml } from '../shared/dripEmailDocument.js';
import type { ChecklistStepId } from './onboardingDripSteps.js';

export interface DefaultDripTemplate {
  title: string;
  checklistStepId: ChecklistStepId;
  delayDays: number;
  delayHours: number;
  delayMinutes: number;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  actionLabel: string;
  actionPath: string;
}

/** Увеличивайте при обновлении текстов/скриншотов — существующие шаги в БД подтянутся при старте API. */
export const DRIP_TEMPLATES_CONTENT_VERSION = 4;

const INNER_DRIP_STEP_TEMPLATES: DefaultDripTemplate[] = [
  {
    title: 'Создать театр',
    checklistStepId: 'theater',
    delayDays: 2,
    delayHours: 0,
    delayMinutes: 0,
    subject: 'Начнём с малого — театр уже почти здесь',
    bodyText:
      'Знаем, в начале всё кажется перегруженным — так бывает у каждой команды. Хорошая новость: первый шаг самый короткий.\n\nСоздайте театр в меню слева: «Театр → + Новый». Название, часовой пояс — и у вас появится своё пространство, куда дальше лягут люди и постановки.\n\nПодробнее — в разделе «Быстрый старт» в руководстве.',
    bodyHtml:
      dripBodyHtmlFromParagraphs(
        [
          'Знаем, в начале всё кажется перегруженным — так бывает у каждой команды. Хорошая новость: вы уже сделали самое смелое — зарегистрировались. Дальше — маленькими шагами, мы рядом.',
          'Первый шаг — создать театр: в меню слева «Театр → + Новый». Название и часовой пояс — и у команды появится своё пространство для расписания и планов.',
        ],
        { leadFirst: true }
      ) +
      dripEmailGuideImage('sozdanie-teatra-v-bokovom-menyu', 'Создание театра в боковом меню') +
      dripEmailTip(
        `Если что-то непонятно — загляните в ${dripEmailInlineLink('/app/guide', 'руководство')}, там тот же путь с картинками.`
      ),
    actionLabel: 'Создать театр',
    actionPath: '/app/overview',
  },
  {
    title: 'Участники',
    checklistStepId: 'actors',
    delayDays: 2,
    delayHours: 0,
    delayMinutes: 0,
    subject: 'Вы не одни — добавьте участников',
    bodyText:
      'Один в поле не воин, и постановка — не исключение. Когда в труппе появятся люди, расписание и роли начнут складываться сами.\n\nОткройте «Участники»: имя, контакты — хотя бы двое, чтобы было с кем репетировать. Потом им можно выдать роли и звать на занятия.\n\nЭто займёт несколько минут — и станет легче дышать.',
    bodyHtml:
      dripBodyHtmlFromParagraphs(
        [
          'Понимаем: собрать всех в одном месте — отдельное приключение. Но как только в «Репетициях» появятся люди, план перестаёт быть абстракцией.',
          'Загляните в раздел «Участники»: добавьте режиссёра, актёров, администратора — имя и контакт. Минимум двое в труппе, и дальше можно назначать роли и приглашать на репетиции.',
          'Не нужно идеально с первого раза — карточки всегда можно дополнить.',
        ],
        { leadFirst: true }
      ) +
      dripEmailTip(
        `Шаг 2 из ${dripEmailInlineLink('/app/guide', 'быстрого старта')}: участники — основа всего расписания.`
      ),
    actionLabel: 'Открыть участников',
    actionPath: '/app/actors',
  },
  {
    title: 'Постановка',
    checklistStepId: 'play',
    delayDays: 2,
    delayHours: 0,
    delayMinutes: 0,
    subject: 'Первая постановка — якорь для сцен и плана',
    bodyText:
      'Без постановки сцены и репетиции некуда «приклеить». Это не бюрократия — один раз завели спектакль, и дальше всё становится на место.\n\nНа странице «Постановки» укажите название, автора, при желании ссылку на текст. Скоро к этой карточке привяжутся сцены и состав.',
    bodyHtml:
      dripBodyHtmlFromParagraphs(
        [
          'Иногда кажется, что «ещё рано заводить спектакль» — на самом деле наоборот: одна карточка постановки даёт опору всему остальному.',
          'Откройте «Постановки и состав»: название, автор, ссылка на текст — по желанию. К этой постановке потом лягут сцены, роли и репетиции.',
        ],
        { leadFirst: true }
      ) +
      dripEmailGuideImage('kartochka-novoj-postanovki', 'Карточка новой постановки') +
      dripEmailTip('Сделали — уже полдела. Дальше будет проще.'),
    actionLabel: 'К постановкам',
    actionPath: '/app/play',
  },
  {
    title: 'Сцены',
    checklistStepId: 'scenes',
    delayDays: 2,
    delayHours: 0,
    delayMinutes: 0,
    subject: 'Сцены — когда текст обретает форму',
    bodyText:
      'План репетиции собирается из сцен. Нужно хотя бы три — можно вручную или импортом из Google Docs.\n\nНе обязательно сразу идеально: список всегда можно дополнить. Главное — начать, и календарь оживёт.',
    bodyHtml:
      dripBodyHtmlFromParagraphs(
        [
          'Текст пьесы может пугать объёмом — в приложении его удобно резать на сцены. Так проще видеть, что репетируете на каждом занятии.',
          'На странице «Сцены» добавьте минимум три сцены: вручную или через импорт из Google Docs / файла. Хронометраж и ссылки подтянутся по мере работы.',
        ],
        { leadFirst: true }
      ) +
      dripEmailGuideImage('spisok-scen-s-knopkoj-dobavleniya', 'Список сцен с кнопкой добавления') +
      dripEmailTip(
        `Есть Google Docs — смотрите в руководстве блок про ${dripEmailInlineLink('/app/scenes', 'импорт сцен')}.`
      ),
    actionLabel: 'К сценам',
    actionPath: '/app/scenes',
  },
  {
    title: 'Состав',
    checklistStepId: 'cast',
    delayDays: 2,
    delayHours: 0,
    delayMinutes: 0,
    subject: 'Роли в составе — кто играет кого',
    bodyText:
      'Когда роли назначены, предупреждения о занятости и план по актёрам начинают работать. На странице постановки откройте «Состав» и привяжите участников к персонажам.\n\nДаже черновое распределение лучше, чем откладывать — всегда можно поправить.',
    bodyHtml:
      dripBodyHtmlFromParagraphs(
        [
          'Распределение ролей — момент, когда команда по-настоящему «садится в спектакль». Не переживайте, если что-то временно: состав можно менять.',
          'На странице постановки откройте «Состав» и привяжите участников к персонажам. После этого план репетиции будет понимать, кого звать на какие сцены.',
        ],
        { leadFirst: true }
      ) +
      dripEmailGuideImage('raspredelenie-rolej-v-postanovke', 'Распределение ролей в постановке', 'gif') +
      dripEmailTip('Черновик состава лучше пустого — поправите за минуту, когда решите.'),
    actionLabel: 'Открыть состав',
    actionPath: '/app/play#cast',
  },
  {
    title: 'Площадка',
    checklistStepId: 'venue',
    delayDays: 2,
    delayHours: 0,
    delayMinutes: 0,
    subject: 'Площадка — чтобы никто не искал адрес в чате',
    bodyText:
      'Сохраните репетиционный зал один раз — адрес сам подставится в карточки репетиций и в сообщения команде.\n\nРаздел «Площадки»: название, адрес. Мелочь, которая снимает кучу вопросов в день «Х».',
    bodyHtml:
      dripBodyHtmlFromParagraphs(
        [
          'Мелочи вроде адреса зала часто съедают нервы в последний момент. Сохраните площадку один раз — и она будет подставляться в каждую репетицию.',
          'В «Площадках» добавьте название и адрес зала. Это быстро, зато участникам не придётся каждый раз спрашивать «где мы?»',
        ],
        { leadFirst: true }
      ) +
      dripEmailGuideImage('forma-ploschadki', 'Форма площадки') +
      dripEmailTip('Одна сохранённая площадка — минус десять сообщений в групповом чате.'),
    actionLabel: 'К площадкам',
    actionPath: '/app/venues',
  },
  {
    title: 'Репетиция',
    checklistStepId: 'rehearsal',
    delayDays: 2,
    delayHours: 0,
    delayMinutes: 0,
    subject: 'Первая репетиция — вы почти у цели',
    bodyText:
      'Вы проделали путь до настройки — осталось собрать первое занятие. «Репетиции» → «Новая»: дата, площадка, план по сценам.\n\nКогда план лежит в одном месте, команде проще согласовать время. Вы справитесь.',
    bodyHtml:
      dripBodyHtmlFromParagraphs(
        [
          'Вы уже проделали большую часть пути — осталось собрать первое занятие в календаре. Это тот момент, когда все предыдущие шаги складываются в реальную репетицию.',
          '«Репетиции» → «Новая репетиция»: дата, время, площадка. В карточке соберите план — сцены, разминка, перерывы. Предупреждения подскажут, если кто-то занят.',
        ],
        { leadFirst: true }
      ) +
      dripEmailGuideImage('plan-repeticii-s-blokami-scen', 'План репетиции с блоками сцен') +
      dripEmailTip('Первый план не обязан быть идеальным — его всегда можно допилить после занятия.'),
    actionLabel: 'К репетициям',
    actionPath: '/app/rehearsals',
  },
  {
    title: 'Telegram',
    checklistStepId: 'telegram',
    delayDays: 2,
    delayHours: 0,
    delayMinutes: 0,
    subject: 'Донесите план до команды — вы почти на финише',
    bodyText:
      'Настройка почти готова. Осталось донести план до людей: подключите Telegram-чат театра в настройках или отправьте план из карточки репетиции.\n\nКоманда увидит то же, что и вы — меньше недопонимания, больше репетиций.',
    bodyHtml:
      dripBodyHtmlFromParagraphs(
        [
          'Финишная прямая: план бессмысленен, если команда его не видит. Хорошая новость — отправить его можно в один клик.',
          'Подключите групповой чат театра в «Настройках» (бот подскажет Chat ID) или нажмите «Отправить в Telegram» в карточке репетиции. Можно также экспортировать .ics в календарь.',
        ],
        { leadFirst: true }
      ) +
      dripEmailGuideImage('otpravka-plana-v-telegram', 'Отправка плана в Telegram', 'gif') +
      dripEmailTip(
        `Инструкция по чату — в ${dripEmailInlineLink('/app/guide', 'руководстве')}, раздел про Telegram. Вы уже близко — осталось нажать «отправить».`
      ),
    actionLabel: 'Настройки и Telegram',
    actionPath: '/app/settings',
  },
];

export const DEFAULT_DRIP_STEP_TEMPLATES: DefaultDripTemplate[] = INNER_DRIP_STEP_TEMPLATES.map(
  (template) => ({
    ...template,
    bodyHtml: wrapFullDripEmailHtml({
      innerBodyHtml: template.bodyHtml,
      actionLabel: template.actionLabel,
      actionPath: template.actionPath,
    }),
  })
);
