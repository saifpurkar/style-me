// Browser-only helpers: shrink a photo to a smaller JPEG. Used both to keep AI
// suggestions fast and cheap, and to keep stored photos small (the free storage
// plan is 1 GB, and phone photos are several MB each).

export async function shrinkToJpegBlob(file: File, maxSide: number, quality = 0.85): Promise<Blob> {
  // createImageBitmap respects the photo's rotation (EXIF), so phone photos aren't sideways.
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not prepare the photo.");
    // Transparent PNGs would turn black as JPEG, so paint white behind them.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) throw new Error("Could not prepare the photo.");
    return blob;
  } finally {
    bitmap.close();
  }
}

export async function shrinkToJpegBase64(file: File, maxSide = 1024, quality = 0.85): Promise<string> {
  const blob = await shrinkToJpegBlob(file, maxSide, quality);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// The photo to store for an item: at most 1600px on the long side as a JPEG. If the
// browser can't read the file (for example some HEIC photos), keep the original.
export async function photoForStorage(file: File): Promise<{ body: Blob | File; ext: string; contentType: string }> {
  try {
    const blob = await shrinkToJpegBlob(file, 1600, 0.85);
    // Don't make small photos bigger by re-encoding them.
    if (blob.size < file.size) return { body: blob, ext: "jpg", contentType: "image/jpeg" };
  } catch {
    // fall through to the original
  }
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  return { body: file, ext, contentType: file.type || "image/jpeg" };
}
