import {useEffect, useState} from 'react';
import {Image, View} from 'react-native';
import FileText from 'lucide-react-native/icons/file-text';
import type {LocalFileStore} from '@core/local-file-store';
import {renderThumbnail} from '../platform/thumbnail';
import {Glyph} from './primitives';
import {radius, shadow, useTheme} from './theme';

// C6 PageThumbnail. A real first-page render on paper, made locally and lazily (never at
// startup), one at a time. Thumbnails are workspace content: the in-memory cache is
// emptied when the workspace is cleared or deleted, and a render that finishes after
// that is discarded rather than shown in the new workspace.
const MAX_CACHED = 64;
const cache = new Map<string, string | null>();
let generation = 0;
let queue: Promise<unknown> = Promise.resolve();
const listeners = new Set<() => void>();
export function clearThumbnails() {cache.clear(); generation++; listeners.forEach(listener => listener());}

function request(store: LocalFileStore, ref: string, checksum: string, pixels: number) {
  const key = `${ref}:${checksum}:${pixels}`, started = generation;
  if (cache.has(key)) return;
  cache.set(key, null);
  queue = queue.then(async () => {
    if (started !== generation) return;
    const abort = new AbortController();
    try {
      const bytes = store.get(ref).bytes;
      const uri = await renderThumbnail(bytes, pixels, abort.signal);
      if (started !== generation) return;
      cache.set(key, uri);
      while (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
    } catch {
      if (started === generation) cache.set(key, 'failed');
    }
    listeners.forEach(listener => listener());
  });
}

export function PageThumbnail({store, fileRef, checksum, width, height, label}: {store: LocalFileStore; fileRef: string | undefined; checksum?: string; width: number; height: number; label?: string}) {
  const {c, scheme} = useTheme();
  const [, force] = useState(0);
  const pixels = Math.ceil(Math.max(width, height) * 3);
  const key = fileRef && checksum ? `${fileRef}:${checksum}:${pixels}` : null;
  useEffect(() => {
    const listener = () => force(n => n + 1);
    listeners.add(listener);
    if (fileRef && checksum) request(store, fileRef, checksum, pixels);
    return () => {listeners.delete(listener);};
  }, [store, fileRef, checksum, pixels]);
  const uri = key ? cache.get(key) : 'failed';
  const frame = {width, height, borderRadius: radius.thumb, overflow: 'hidden' as const, alignItems: 'center' as const, justifyContent: 'center' as const};
  if (!uri || uri === 'failed') {
    // Loading: a plain placeholder (no shimmer). Failed or locked: the file glyph.
    return <View accessible={!!label} accessibilityLabel={label} style={[frame, {backgroundColor: c.sunken}]}>{uri === 'failed' && <Glyph icon={FileText} size={14} tone="tertiary"/>}</View>;
  }
  return <View accessible={!!label} accessibilityLabel={label} style={[frame, {backgroundColor: c.paper}, shadow('page', scheme)]}>
    <Image source={{uri}} resizeMode="contain" style={{width, height}} accessibilityIgnoresInvertColors/>
  </View>;
}
