# Примеры использования

## Базовое использование

```vue
<template>
  <div>
    <!-- Автодополнение адресов -->
    <FieldSuggestions 
      name="address"
      :options="addressOptions"
      v-model="address"
      placeholder="Введите адрес"
    />

    <!-- Автодополнение организаций -->
    <FieldSuggestions 
      name="company"
      :options="companyOptions"
      v-model="company"
      placeholder="Введите название организации"
    />

    <!-- Автодополнение ФИО -->
    <FieldSuggestions 
      name="name"
      :options="nameOptions"
      v-model="fullName"
      placeholder="Введите ФИО"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import FieldSuggestions from '@/FieldSuggestions.vue'
import type { Options } from '@/main'

const address = ref('')
const company = ref('')
const fullName = ref('')

// Конфигурация для адресов
const addressOptions: Options<'ADDRESS'> = {
  token: 'YOUR_DADATA_API_TOKEN',
  type: 'ADDRESS',
  bounds: 'city-settlement', // Ограничение до городов
  onSelect: (suggestion) => {
    console.log('Выбран адрес:', suggestion)
  }
}

// Конфигурация для организаций
const companyOptions: Options<'PARTY'> = {
  token: 'YOUR_DADATA_API_TOKEN',
  type: 'PARTY',
  params: {
    status: ['ACTIVE'] // Только действующие организации
  },
  onSelect: (suggestion) => {
    console.log('Выбрана организация:', suggestion)
  }
}

// Конфигурация для ФИО
const nameOptions: Options<'NAME'> = {
  token: 'YOUR_DADATA_API_TOKEN',
  type: 'NAME',
  onSelect: (suggestion) => {
    console.log('Выбрано ФИО:', suggestion)
  }
}
</script>
```

## Получение API токена

1. Зарегистрируйтесь на [dadata.ru](https://dadata.ru)
2. Получите API токен в личном кабинете
3. Используйте токен в конфигурации

```javascript
const options = {
  token: 'ваш_токен_здесь',
  type: 'ADDRESS'
}
```

## Обработка событий

```vue
<template>
  <FieldSuggestions 
    :options="{
      token: 'YOUR_TOKEN',
      type: 'ADDRESS',
      onSelect: handleSelect,
      onSelectNothing: handleNothing
    }"
  />
</template>

<script setup>
function handleSelect(suggestion) {
  // Вызывается при выборе подсказки
  console.log('Выбрано:', suggestion.value)
  console.log('Данные:', suggestion.data)
}

function handleNothing(query) {
  // Вызывается когда ничего не найдено
  console.log('Ничего не найдено для:', query)
}
</script>
```

## Программное использование

```javascript
import { suggestions } from 'dadata-suggestions'

// Инициализация на существующем input элементе
const instance = suggestions('#my-input', {
  token: 'YOUR_TOKEN',
  type: 'ADDRESS'
})

// Программное задание значения
instance.setSuggestion({
  value: 'Москва',
  data: { /* данные адреса */ }
})

// Очистка
instance.clear()

// Уничтожение
instance.dispose()
```