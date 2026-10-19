import { Mark } from "@tiptap/core";
import Image from "@tiptap/extension-image";

import {
  buildImageNodeStyle,
  DEFAULT_IMAGE_ALIGN,
  DEFAULT_IMAGE_SIZE,
  normalizeImageAlign,
  normalizeImageSize,
} from "./image";

export const WavyUnderline = Mark.create({
  name: "wavyUnderline",

  parseHTML() {
    return [{ tag: "span.wavy" }];
  },

  renderHTML({ HTMLAttributes }) {
    const className = [HTMLAttributes.class, "wavy"].filter(Boolean).join(" ");
    return ["span", { ...HTMLAttributes, class: className }, 0];
  },
});

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      size: {
        default: DEFAULT_IMAGE_SIZE,
        parseHTML: (element: HTMLElement) =>
          normalizeImageSize(
            element.getAttribute("data-size") ??
              element.getAttribute("width") ??
              element.style.width,
          ),
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-size": String(normalizeImageSize(attributes.size)),
        }),
      },
      textAlign: {
        default: DEFAULT_IMAGE_ALIGN,
        parseHTML: (element: HTMLElement) =>
          normalizeImageAlign(
            element.getAttribute("data-align") ??
              element.style.textAlign ??
              element.style.marginLeft,
          ),
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-align": normalizeImageAlign(attributes.textAlign),
          style: buildImageNodeStyle(
            normalizeImageSize(attributes.size),
            normalizeImageAlign(attributes.textAlign),
          ),
        }),
      },
    };
  },
});
