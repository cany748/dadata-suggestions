<template>
  <main>
    <FieldSuggestions name="name" :options="optionsName" />

    <FieldSuggestions name="email" :options="optionsEmail" />

    <FieldSuggestions name="fms" :options="optionsFms" />
  </main>
</template>

<script setup lang="ts">
import FieldSuggestions from "@/FieldSuggestions.vue";

const options = {
  token: import.meta.env.VITE_DADATA_API_KEY,
  triggerSelectOnSpace: false,
  noCache: true,
  hint: false,
  scrollOnFocus: false,
  addon: "none",
};

const optionsName = {
  ...options,
  type: "NAME",
};

const optionsEmail = {
  ...options,
  type: "EMAIL",
};

const optionsFms = {
  ...options,
  type: "fms_unit",
};
</script>

<style scoped>
main {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  gap: 30px;
}
</style>
