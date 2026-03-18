<template>
  <div>
    <!--
      // Remove autocomplete attribute to prevent native suggestions:
      // if it stops working, see https://stackoverflow.com/q/15738259
      // chrome is constantly changing this logic
    -->
    <input
      ref="input"
      v-model="model"
      class="suggestions-input"
      type="text"
      :name="name"
      autocomplete="new-password"
      autocorrect="off"
      autocapitalize="off"
      spellcheck="false"
      v-bind="$attrs"
    />
    <div class="suggestions-wrapper">
      <div class="suggestions-suggestions" style="display: none"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, useTemplateRef } from "vue";
import type { Options } from "./types";
import { Suggestions } from "./suggestions";
import { DATA_ATTR_KEY } from "./constants";

defineOptions({ inheritAttrs: false });
const model = defineModel<string>();
const props = defineProps<{
  name: string;
  options: Options;
}>();

const inputRef = useTemplateRef("input");
defineExpose({ input: inputRef });

let instance: Suggestions | undefined;

onMounted(() => {
  if (inputRef.value) {
    (inputRef.value as any)[DATA_ATTR_KEY]?.dispose?.();
    instance = new Suggestions(inputRef.value, props.options);
    (inputRef.value as any)[DATA_ATTR_KEY] = instance;
  }
});

onUnmounted(() => {
  if (instance) {
    instance.dispose();
    instance = undefined;
  }
});
</script>
