# Works Only Project

Отдельный Astro проект с вынесенной секцией **Works** из основного портфолио.

## Что внутри

- **SWork.astro** — основная секция с анимацией и 3D трансформациями
- **AWork.astro** — компонент карточки проекта с видео
- **Emitter.js** / **Ticker.js** — утилиты для событий и анимационного цикла
- **assets/works/** — демо-видео для карточек
- **styles/** — SCSS стили с помощниками и переменными

## Установка и запуск

```bash
npm install
npm run dev
```

Откройте URL из терминала (обычно http://localhost:4321)

## Сборка

```bash
npm run build
npm run preview
```

## Настройка

Отредактируйте объект `info` в [src/components/SWork.astro](src/components/SWork.astro) чтобы добавить свои проекты:

```js
const info = {
  Pen: {
    title: 'CodePen',
    site: 'https://codepen.io/your-username',
  },
  MyProject: {
    title: 'My Cool Project',
    site: 'https://example.com',
  },
  // ...
}
```

Поместите соответствующие видео в `src/assets/works/` с именами вида `Pen-something.mp4`, `MyProject-video.mp4` и т.д.

## Технологии

- **Astro** — фреймворк
- **GSAP** + **ScrollTrigger** — анимации
- **Sass** — препроцессор стилей
- **TypeScript** — типизация

---

Создано на основе шаблона Personal-Website
