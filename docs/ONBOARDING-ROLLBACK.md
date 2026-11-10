# Откат онбординга (ветка `feature/onboarding-engagement`)

## Точка «как было до изменений»

| Что | Значение |
|-----|----------|
| **Git-тег** | `pre-onboarding-engagement` |
| **Коммит** | `357498a` — *Improve script sync: merge scene roles, parse title cast and dashed cues* |
| **Ветка разработки** | `feature/onboarding-engagement` |
| **ТЗ** | [cursor-onboarding-brief.md](./cursor-onboarding-brief.md) |

Пока ветка **не смержена в `main`**, прод на [rehears.ru](https://rehears.ru) остаётся на старой версии.

## Вернуть прод без потери ветки с доработками

С локальной копии репозитория (после `git fetch origin --tags`):

```bat
git checkout pre-onboarding-engagement
deploy.bat --skip-git
git checkout feature/onboarding-engagement
```

Или дождаться зелёного **Deploy production** для коммита `357498a` после `git push origin pre-onboarding-engagement` (тег должен быть на GitHub).

## Полностью отменить ветку и оставить только старый `main`

Только если доработки точно не нужны:

```bat
git checkout main
git reset --hard pre-onboarding-engagement
git push origin main
```

`git reset --hard` и force-push **удаляют** незапушенные коммиты онбординга на `main`. Сначала сохраните ветку `feature/onboarding-engagement` на remote.

## Локально посмотреть «как было»

```bat
scripts\checkout-pre-onboarding.bat
```

Вернётся на текущую ветку:

```bat
git checkout feature/onboarding-engagement
```

## Опубликовать тег на GitHub (один раз)

```bat
git push origin pre-onboarding-engagement
git push -u origin feature/onboarding-engagement
```
