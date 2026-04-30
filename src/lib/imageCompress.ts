// Compress an image client-side before upload. iPhone photos can be
// 2-5 MB straight off the camera; over cellular that's a 10-20s upload.
// Re-encoding through canvas at max 1600px wide / JPEG 0.85 typically gets
// under 400 KB without visible quality loss for site-survey photos.

export type CompressOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: string;
};

export async function compressImage(
  file: File,
  opts: CompressOptions = {}
): Promise<Blob> {
  const {
    maxWidth = 1600,
    maxHeight = 1600,
    quality = 0.85,
    mimeType = "image/jpeg",
  } = opts;

  // Bail out and pass the file through if it's already small or not an
  // image. Compression of <500 KB images isn't worth the CPU.
  if (!file.type.startsWith("image/")) return file;
  if (file.size < 500_000) return file;

  const dataUrl = await fileToDataURL(file);
  const img = await loadImage(dataUrl);

  let { width, height } = img;
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
  width = Math.round(width * ratio);
  height = Math.round(height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mimeType, quality)
  );
  if (!blob) throw new Error("Image compression failed");

  // If compression somehow made the file bigger (already-optimized JPEGs
  // can do this), fall back to the original.
  if (blob.size >= file.size) return file;
  return blob;
}

function fileToDataURL(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () =>
      reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image decode failed"));
    img.src = src;
  });
}
