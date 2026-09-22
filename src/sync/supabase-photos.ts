import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { supabase } from '@/lib/supabase';

import type { PhotoFiles, PhotoStore } from './photos';

const BUCKET = 'workout-photos';
/** 올리는 사본의 긴 쪽 픽셀 (한 장 약 200KB) */
const MAX_SIDE = 1280;

async function resized(localPath: string): Promise<File> {
  const uri = new File(Paths.document, localPath).uri;
  const original = await ImageManipulator.manipulate(uri).renderAsync();
  const { width, height } = original;
  const ctx = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > MAX_SIDE) {
    ctx.resize(width >= height ? { width: MAX_SIDE } : { height: MAX_SIDE });
  }
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return new File(saved.uri);
}

export const supabasePhotoStore: PhotoStore = {
  async upload(key, localPath) {
    const file = await resized(localPath);
    try {
      const body = await file.arrayBuffer();
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(key, body, { contentType: 'image/jpeg', upsert: true });
      if (error) throw error;
    } finally {
      if (file.exists) file.delete();
    }
  },
  async download(key, localPath) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(key, 120);
    if (error) throw error;
    const dest = new File(Paths.document, localPath);
    dest.parentDirectory.create({ idempotent: true, intermediates: true });
    await File.downloadFileAsync(data.signedUrl, dest, { idempotent: true });
  },
  async remove(keys) {
    const { error } = await supabase.storage.from(BUCKET).remove(keys);
    if (error) throw error;
  },
};

export const devicePhotoFiles: PhotoFiles = {
  exists: (localPath) => new File(Paths.document, localPath).exists,
  remove: (localPath) => {
    const f = new File(Paths.document, localPath);
    if (f.exists) f.delete();
  },
};
