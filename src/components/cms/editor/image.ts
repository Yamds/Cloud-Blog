export const IMAGE_SIZE_STEPS = [20, 40, 60, 80, 100] as const;

export type ImageSizePercent = (typeof IMAGE_SIZE_STEPS)[number];
export type ImageTextAlign = "left" | "center" | "right";

export const DEFAULT_IMAGE_SIZE: ImageSizePercent = 100;
export const DEFAULT_IMAGE_ALIGN: ImageTextAlign = "center";

export function findNearestImageSize(value: number): ImageSizePercent {
  return IMAGE_SIZE_STEPS.reduce<ImageSizePercent>(
    (nearest, step) => (Math.abs(step - value) < Math.abs(nearest - value) ? step : nearest),
    DEFAULT_IMAGE_SIZE,
  );
}

export function normalizeImageSize(value: unknown): ImageSizePercent {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace("%", "").trim())
        : DEFAULT_IMAGE_SIZE;

  if (!Number.isFinite(numericValue)) {
    return DEFAULT_IMAGE_SIZE;
  }

  return findNearestImageSize(numericValue);
}

export function normalizeImageAlign(value: unknown): ImageTextAlign {
  if (value === "left" || value === "center" || value === "right") {
    return value;
  }

  if (value === "auto") {
    return "right";
  }

  return DEFAULT_IMAGE_ALIGN;
}

export function buildImageNodeStyle(size: ImageSizePercent, align: ImageTextAlign): string {
  const margin =
    align === "left"
      ? "margin-left: 0; margin-right: auto;"
      : align === "right"
        ? "margin-left: auto; margin-right: 0;"
        : "margin-left: auto; margin-right: auto;";

  return `width: ${size}%; ${margin}`;
}

export function readImageSizeFromElement(imageElement: HTMLImageElement): ImageSizePercent {
  return normalizeImageSize(imageElement.getAttribute("data-size") ?? imageElement.style.width);
}

export function readImageAlignFromElement(imageElement: HTMLImageElement): ImageTextAlign {
  return normalizeImageAlign(imageElement.getAttribute("data-align"));
}
