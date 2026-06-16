const LOCAL_PHOTOS: Record<string, string> = {
  'Евгений Алферов': '/images/team/evgeny-alferov.jpg',
  'Тами Айрис': '/images/team/tami-iris.jpg',
  'Сергей Чугунов': '/images/team/sergey-chugunov.jpg',
  'Никита Дубинин': '/images/actors/nikita-dubinin.jpg',
  'Александр Ерахтин': '/images/actors/aleksandr-erahtin.jpg',
  'Диана Бакурова': '/images/actors/diana-bakurova.jpg',
  'Василина Рзянина': '/images/actors/vasilina-rzanina.jpg',
  'Юлия Масохина': '/images/actors/yulia-masohina.jpg',
  'Александр Алабин': '/images/actors/aleksander-alabin.jpg',
  'Михаил Никитин': '/images/actors/mihail-nikitin.jpg',
  'Дмитрий Корепанов': '/images/actors/dmitriy-korepanov.jpg',
  'Анна Зубченко': '/images/actors/anna-zubchenko.jpg',
  'Елена Бакал': '/images/actors/elena_bakal.jpg',
  'Руслан Аршидинов': '/images/actors/ruslan-arshidinov.jpg',
  'Варвара Гусак': '/images/actors/varvara-gusak.jpg',
};

export function resolveActorPhotoUrl(name: string, photoUrl?: string): string | undefined {
  if (photoUrl?.startsWith('/images/') || photoUrl?.startsWith('/api/') || photoUrl?.startsWith('data:')) {
    return photoUrl;
  }
  return LOCAL_PHOTOS[name] ?? photoUrl;
}

export function enrichActorPhotos<T extends { name: string; photoUrl?: string }>(
  actors: T[]
): T[] {
  return actors.map((actor) => ({
    ...actor,
    photoUrl: resolveActorPhotoUrl(actor.name, actor.photoUrl),
  }));
}

export { LOCAL_PHOTOS as ACTOR_PHOTOS };
