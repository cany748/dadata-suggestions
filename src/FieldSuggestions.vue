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
import $ from "cash-dom";

import type { Options } from "./types";
import { Suggestions } from "./main";
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
    const inputElement = $(inputRef.value) as any;
    inputElement[0]?.[DATA_ATTR_KEY]?.dispose?.();
    instance = new Suggestions(inputElement, props.options);
    inputElement[0]![DATA_ATTR_KEY] = instance as never;
  }
});

onUnmounted(() => {
  if (instance) {
    instance.dispose();
    instance = undefined;
  }
});
</script>
