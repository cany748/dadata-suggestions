# dadata-suggestions

Vue 3 порт библиотеки [suggestions-jquery](https://github.com/hflabs/suggestions-jquery) для автодополнения адресов, организаций, имен и других данных через API DaData.

## Статус проекта

🚧 **В разработке** - Базовый функционал портирован и работает, но требуется дальнейшая доработка.

### Что уже работает

✅ Vue 3 компонент `FieldSuggestions`  
✅ TypeScript поддержка  
✅ Интеграция с API DaData  
✅ Поддержка типов: NAME, ADDRESS, PARTY, EMAIL, BANK, FMS  
✅ Playground для тестирования  

### Что требует доработки

- Исправление оставшихся TypeScript ошибок
- Добавление тестов
- Улучшение документации
- Оптимизация производительности

## Установка

```bash
npm install
```

## Быстрый старт

```vue
<template>
  <FieldSuggestions 
    name="address" 
    :options="addressOptions" 
    v-model="selectedAddress"
  />
</template>

<script setup>
import FieldSuggestions from 'dadata-suggestions/FieldSuggestions.vue'

const selectedAddress = ref('')

const addressOptions = {
  token: 'YOUR_DADATA_TOKEN',
  type: 'ADDRESS'
}
</script>
```

## Типы данных

Библиотека поддерживает следующие типы подсказок:

- `NAME` - ФИО
- `ADDRESS` - Адреса  
- `PARTY` - Организации
- `EMAIL` - Email адреса
- `BANK` - Банки
- `FMS` - Подразделения ФМС

## Разработка

### Запуск playground

```bash
npm run dev
```

### Проверка типов

```bash
npm run type-check
```

### Сборка

```bash
npm run build
```

## API

### FieldSuggestions

Основной Vue 3 компонент для автодополнения.

#### Props

- `name: string` - имя поля
- `options: Options<T>` - настройки подсказок

#### Options

```typescript
type Options<T> = {
  token: string;           // DaData API токен
  type: T;                // Тип подсказок
  params?: object;        // Дополнительные параметры
  bounds?: string;        // Ограничения поиска
  constraints?: string;   // Ограничения
  // ... другие опции
}
```

## Оригинальная библиотека

Этот проект основан на [suggestions-jquery](https://github.com/hflabs/suggestions-jquery) от HFLabs.

## Лицензия

MIT
