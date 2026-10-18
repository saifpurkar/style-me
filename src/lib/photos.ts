// Browser-only: save an item photo to the private "wardrobe" bucket as wardrobe/<userId>/<uuid>.<ext>,
// shrunk first so the free 1 GB storage lasts.
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/lib/supabase";
import { photoForStorage } from "@/lib/image";

export async function uploadItemPhoto(userId: string, file: File): Promise<string> {
  const photo = await photoForStorage(file);
  const path = `${userId}/${uuidv4()}.${photo.ext}`;

  const { error } = await supabase.storage.from("wardrobe").upload(path, photo.body, {
    cacheControl: "3600",
    upsert: false,
    contentType: photo.contentType,
  });

  if (error) throw new Error(error.message);
  return path;
}
