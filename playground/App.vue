<template>
  <main>
    <FieldSuggestions name="name" :options="optionsName" />

    <FieldSuggestions name="email" :options="optionsEmail" />

    <FieldSuggestions name="fms" :options="optionsFms" />
  </main>
</template>

<script setup lang="ts">
import FieldSuggestions from "@/FieldSuggestions.vue";
import type { Options } from "@/main";

const baseOptions = {
  token: import.meta.env.VITE_DADATA_API_KEY || "",
  triggerSelectOnSpace: false,
  noCache: true,
  hint: false,
  scrollOnFocus: false,
  addon: "none",
};

const optionsName: Options<"NAME"> = {
  ...baseOptions,
  type: "NAME" as const,
};

const optionsEmail: Options<"EMAIL"> = {
  ...baseOptions,
  type: "EMAIL" as const,
};

const optionsFms: Options<"FMS"> = {
  ...baseOptions,
  type: "FMS" as const,
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
