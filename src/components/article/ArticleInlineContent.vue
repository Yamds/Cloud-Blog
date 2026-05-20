<script setup lang="ts">
import { h } from "vue";
import type { ArticleInlineSegment } from "@/types/article";

const props = defineProps<{
  fallback?: string;
  segments?: ArticleInlineSegment[];
}>();

function renderMarkedText(segment: ArticleInlineSegment) {
  const content = segment.text;

  return (segment.marks ?? []).reduce<ReturnType<typeof h> | string>((child, mark) => {
    if (mark.type === "bold") {
      return h("strong", child);
    }

    if (mark.type === "italic") {
      return h("em", child);
    }

    if (mark.type === "strike") {
      return h("s", child);
    }

    if (mark.type === "code") {
      return h("code", child);
    }

    if (mark.type === "link" && mark.href) {
      return h("a", { href: mark.href, target: "_blank", rel: "noreferrer" }, child);
    }

    if (mark.type === "superscript") {
      return h("sup", child);
    }

    if (mark.type === "subscript") {
      return h("sub", child);
    }

    if (mark.type === "color" && mark.color) {
      return h("span", { style: { color: mark.color } }, child);
    }

    if (mark.type === "background" && mark.color) {
      return h("span", { class: "inline-highlight", style: { backgroundColor: mark.color } }, child);
    }

    if (mark.type === "underline") {
      return h("u", child);
    }

    if (mark.type === "wavy") {
      return h("span", { class: "wavy" }, child);
    }

    return child;
  }, content);
}

function normalizeSegments(): ArticleInlineSegment[] {
  if (props.segments?.length) {
    return props.segments;
  }

  return props.fallback ? [{ text: props.fallback }] : [];
}
</script>

<template>
  <span class="inline-content">
    <template v-for="(segment, index) in normalizeSegments()" :key="`${index}-${segment.text}`">
      <component :is="{ render: () => renderMarkedText(segment) }" />
    </template>
  </span>
</template>

<style scoped>
.inline-content u {
  text-decoration: underline;
  text-decoration-color: var(--accent);
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}
.inline-content .wavy {
  display: inline;
  text-decoration-line: underline;
  text-decoration-style: wavy;
  text-decoration-color: var(--accent);
  text-decoration-thickness: 1.25px;
  text-underline-offset: 0.16em;
}
.inline-content .inline-highlight {
  border-radius: 3px;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}
</style>
