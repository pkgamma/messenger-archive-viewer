import React from 'react';
import useSWR from 'swr';

import { getFileHandleRecursively } from '@/lib/utils/file';

export default function FsImage({
  path,
  root,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement> & {
  path: string;
  root: FileSystemDirectoryHandle;
}) {
  const { data: src, error } = useSWR(['images', path], async () => {
    try {
      const fileHandle = await getFileHandleRecursively(root, path);
      if (!fileHandle) {
        return null;
      }

      const file = await fileHandle.getFile();
      const url = URL.createObjectURL(file);
      return url;
    } catch (e) {
      console.error('Failed to load image:', path, e);
      return null;
    }
  });

  if (error) {
    return (
      <div className='text-sm italic text-gray-500'>Failed to load image</div>
    );
  }

  if (!src) {
    return null;
  }

  return <img src={src} {...props} />;
}
