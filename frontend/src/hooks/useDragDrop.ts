'use client';

import { useState, useCallback, useRef, DragEvent } from 'react';

interface UseDragDropReturn {
  isDragging: boolean;
  handleDragEnter: (e: DragEvent<HTMLElement>) => void;
  handleDragLeave: (e: DragEvent<HTMLElement>) => void;
  handleDragOver: (e: DragEvent<HTMLElement>) => void;
  handleDrop: (e: DragEvent<HTMLElement>) => void;
}

/**
 * Provides drag-and-drop handling for URL strings.
 * Extracts URLs from `text/uri-list`, `text/plain`, or inline text dropped
 * from a browser tab, link, or text selection.
 */
export function useDragDrop(onUrl: (url: string) => void): UseDragDropReturn {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0); // track nested drag enter/leave events

  const handleDragEnter = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.types.some((t) => ['text/uri-list', 'text/plain'].includes(t))) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragging(false);

      // Priority: uri-list > plain text
      const uri = e.dataTransfer.getData('text/uri-list');
      const plain = e.dataTransfer.getData('text/plain');
      const raw = (uri || plain).trim();

      if (!raw) return;

      // uri-list may contain multiple URLs separated by newlines; take first
      const firstUrl = raw.split('\n').find((line) => line.trim() && !line.startsWith('#'));
      if (firstUrl) onUrl(firstUrl.trim());
    },
    [onUrl]
  );

  return { isDragging, handleDragEnter, handleDragLeave, handleDragOver, handleDrop };
}
