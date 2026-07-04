import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { parseEditorSegments, type MentionOption } from '../utils/decidedNotesMentions';
import { useDesign } from '../store/DesignContext';

interface MentionTextareaProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: MentionOption[];
  rows?: number;
  placeholder?: string;
  className?: string;
}

interface MentionPickerState {
  query: string;
  replaceStart: number;
  replaceEnd: number;
}

const INPUT_PADDING = 'px-3 py-2';

function mentionChipClass(isZen: boolean): string {
  return isZen
    ? 'mx-0.5 inline rounded-sm bg-foreground/10 px-1 font-medium text-foreground'
    : 'mx-0.5 inline rounded-sm bg-gold/25 px-1 font-medium text-gold-light';
}

function createMentionChip(token: string, label: string, isZen: boolean): HTMLSpanElement {
  const chip = document.createElement('span');
  chip.contentEditable = 'false';
  chip.dataset.mention = token;
  chip.className = mentionChipClass(isZen);
  chip.textContent = label;
  return chip;
}

function appendTextWithBreaks(editor: HTMLElement, text: string): void {
  const parts = text.split('\n');
  parts.forEach((part, index) => {
    if (part) editor.appendChild(document.createTextNode(part));
    if (index < parts.length - 1) editor.appendChild(document.createElement('br'));
  });
}

function serializeEditor(editor: HTMLElement): string {
  let result = '';

  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent ?? '';
      return;
    }
    if (!(node instanceof HTMLElement)) return;

    if (node.dataset.mention) {
      result += node.dataset.mention;
      return;
    }
    if (node.tagName === 'BR') {
      result += '\n';
      return;
    }

    node.childNodes.forEach(walk);
  };

  editor.childNodes.forEach(walk);
  return result;
}

function nodeLength(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent?.length ?? 0;
  if (node instanceof HTMLElement && node.dataset.mention) return node.dataset.mention.length;
  if (node instanceof HTMLElement && node.tagName === 'BR') return 1;
  let length = 0;
  node.childNodes.forEach((child) => {
    length += nodeLength(child);
  });
  return length;
}

function getSelectionOffset(editor: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;

  const range = selection.getRangeAt(0);
  if (!editor.contains(range.startContainer)) return 0;

  let offset = 0;
  let found = false;

  const walk = (node: Node): void => {
    if (found) return;

    if (node === range.startContainer) {
      if (node.nodeType === Node.TEXT_NODE) {
        offset += range.startOffset;
      } else if (node instanceof HTMLElement) {
        for (let index = 0; index < range.startOffset; index += 1) {
          const child = node.childNodes[index];
          if (child) offset += nodeLength(child);
        }
      }
      found = true;
      return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      offset += node.textContent?.length ?? 0;
      return;
    }
    if (node instanceof HTMLElement && node.dataset.mention) {
      offset += node.dataset.mention.length;
      return;
    }
    if (node instanceof HTMLElement && node.tagName === 'BR') {
      offset += 1;
      return;
    }

    node.childNodes.forEach(walk);
  };

  editor.childNodes.forEach(walk);
  return offset;
}

function setSelectionOffset(editor: HTMLElement, targetOffset: number): void {
  const selection = window.getSelection();
  if (!selection) return;

  let offset = 0;
  let placed = false;

  const placeAt = (node: Node, position: number) => {
    const range = document.createRange();
    range.setStart(node, position);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    placed = true;
  };

  const walk = (node: Node): void => {
    if (placed) return;

    if (node.nodeType === Node.TEXT_NODE) {
      const length = node.textContent?.length ?? 0;
      if (offset + length >= targetOffset) {
        placeAt(node, targetOffset - offset);
        return;
      }
      offset += length;
      return;
    }

    if (node instanceof HTMLElement && node.dataset.mention) {
      const length = node.dataset.mention.length;
      if (offset + length >= targetOffset) {
        const after = node.nextSibling;
        if (after?.nodeType === Node.TEXT_NODE) {
          placeAt(after, 0);
        } else {
          const space = document.createTextNode('');
          node.parentNode?.insertBefore(space, after);
          placeAt(space, 0);
        }
        return;
      }
      offset += length;
      return;
    }

    if (node instanceof HTMLElement && node.tagName === 'BR') {
      if (offset + 1 >= targetOffset) {
        const parent = node.parentNode;
        if (!parent) return;
        const text = document.createTextNode('');
        parent.insertBefore(text, node.nextSibling);
        placeAt(text, 0);
        return;
      }
      offset += 1;
      return;
    }

    node.childNodes.forEach(walk);
  };

  editor.childNodes.forEach(walk);

  if (!placed) {
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

function renderValueToEditor(editor: HTMLElement, value: string, isZen: boolean): void {
  editor.innerHTML = '';
  for (const segment of parseEditorSegments(value)) {
    if (segment.type === 'text') {
      appendTextWithBreaks(editor, segment.text);
    } else {
      editor.appendChild(createMentionChip(segment.token, segment.label, isZen));
    }
  }
}

function detectMentionPicker(text: string, cursor: number): MentionPickerState | null {
  const before = text.slice(0, cursor);
  const match = /(?:^|\s)@([^\s@[\](){}]*)$/.exec(before);
  if (!match) return null;
  const query = match[1] ?? '';
  const atIndex = before.lastIndexOf(`@${query}`);
  if (atIndex < 0) return null;
  return {
    query,
    replaceStart: atIndex,
    replaceEnd: cursor,
  };
}

export function MentionTextarea({
  label,
  value,
  onChange,
  options,
  rows = 4,
  placeholder,
  className = '',
}: MentionTextareaProps) {
  const { isZen } = useDesign();
  const editorRef = useRef<HTMLDivElement>(null);
  const lastRenderedValue = useRef(value);
  const [picker, setPicker] = useState<MentionPickerState | null>(null);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [pickerStyle, setPickerStyle] = useState<CSSProperties>({});

  const filteredOptions = useMemo(() => {
    if (!picker) return [];
    const query = picker.query.trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) => option.searchText.includes(query));
  }, [options, picker]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [picker?.query, filteredOptions.length]);

  const inputId = label?.toLowerCase().replace(/\s/g, '-');

  const syncFromValue = useCallback(
    (nextValue: string, cursor?: number) => {
      const editor = editorRef.current;
      if (!editor) return;
      renderValueToEditor(editor, nextValue, isZen);
      lastRenderedValue.current = nextValue;
      if (cursor !== undefined) {
        requestAnimationFrame(() => setSelectionOffset(editor, cursor));
      }
    },
    [isZen]
  );

  useEffect(() => {
    syncFromValue(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial DOM hydration only
  }, []);

  useEffect(() => {
    if (value === lastRenderedValue.current) return;
    const editor = editorRef.current;
    if (!editor) return;
    const cursor = getSelectionOffset(editor);
    syncFromValue(value, cursor);
  }, [value, syncFromValue]);

  const emitChange = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const serialized = serializeEditor(editor);
    lastRenderedValue.current = serialized;
    onChange(serialized);
    const cursor = getSelectionOffset(editor);
    setPicker(detectMentionPicker(serialized, cursor));
  }, [onChange]);

  const updatePickerPosition = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || !picker) return;

    const rect = editor.getBoundingClientRect();
    const maxHeight = 192;
    const gap = 6;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const showAbove = spaceBelow < maxHeight && spaceAbove > spaceBelow;

    setPickerStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      maxHeight,
      zIndex: 70,
      ...(showAbove
        ? { bottom: window.innerHeight - rect.top + gap }
        : { top: rect.bottom + gap }),
    });
  }, [picker]);

  useEffect(() => {
    if (!picker) return;
    updatePickerPosition();
    window.addEventListener('scroll', updatePickerPosition, true);
    window.addEventListener('resize', updatePickerPosition);
    return () => {
      window.removeEventListener('scroll', updatePickerPosition, true);
      window.removeEventListener('resize', updatePickerPosition);
    };
  }, [picker, filteredOptions.length, updatePickerPosition]);

  const insertMention = (option: MentionOption) => {
    if (!picker) return;
    const editor = editorRef.current;
    const current = editor ? serializeEditor(editor) : value;
    const before = current.slice(0, picker.replaceStart);
    const after = current.slice(picker.replaceEnd);
    const insert = `${option.insertText} `;
    const nextValue = `${before}${insert}${after}`;
    const cursor = before.length + insert.length;
    onChange(nextValue);
    syncFromValue(nextValue, cursor);
    setPicker(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!picker || filteredOptions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightIndex((index) => (index + 1) % filteredOptions.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightIndex((index) => (index - 1 + filteredOptions.length) % filteredOptions.length);
      return;
    }

    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      insertMention(filteredOptions[highlightIndex]!);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setPicker(null);
    }
  };

  const borderClass = isZen
    ? 'border-border/60 bg-white focus-within:border-accent/40 focus-within:ring-1 focus-within:ring-accent/20'
    : 'border-gold/20 bg-background/50 focus-within:border-gold/50 focus-within:ring-1 focus-within:ring-gold/30';

  const editorClass = `w-full resize-y overflow-auto whitespace-pre-wrap break-words text-sm leading-relaxed outline-none ${INPUT_PADDING} ${
    isZen ? 'text-foreground' : 'text-white'
  } empty:before:text-muted/50 empty:before:content-[attr(data-placeholder)]`;

  const pickerMenu =
    picker && filteredOptions.length > 0 ? (
      <div
        style={pickerStyle}
        className={`overflow-y-auto rounded-lg border shadow-lg ${
          isZen ? 'border-border/70 bg-white shadow-black/10' : 'border-gold/20 bg-surface shadow-black/40'
        }`}
      >
        {filteredOptions.map((option, index) => (
          <button
            key={option.id}
            type="button"
            className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
              index === highlightIndex
                ? isZen
                  ? 'bg-black/[0.06] text-foreground'
                  : 'bg-gold/15 text-white'
                : isZen
                  ? 'text-foreground hover:bg-black/[0.04]'
                  : 'text-foreground hover:bg-white/5'
            }`}
            onMouseDown={(event) => {
              event.preventDefault();
              insertMention(option);
            }}
          >
            <span>{option.label}</span>
            {option.hint && <span className="truncate text-xs text-muted">{option.hint}</span>}
          </button>
        ))}
      </div>
    ) : null;

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label htmlFor={inputId} className="block text-sm text-muted">
          {label}
        </label>
      )}
      <div className={`rounded-lg border ${borderClass}`}>
        <div
          ref={editorRef}
          id={inputId}
          role="textbox"
          aria-multiline="true"
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder ?? ''}
          className={editorClass}
          style={{ minHeight: `${rows * 1.5}rem` }}
          onInput={emitChange}
          onKeyDown={handleKeyDown}
          onClick={emitChange}
          onKeyUp={emitChange}
          onBlur={() => {
            window.setTimeout(() => setPicker(null), 120);
          }}
        />
      </div>
      {pickerMenu && createPortal(pickerMenu, document.body)}
      {options.length > 0 && (
        <p className="text-xs text-muted">Введите @, чтобы упомянуть актёра или роль</p>
      )}
    </div>
  );
}
