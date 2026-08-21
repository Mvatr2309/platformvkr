"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import styles from "./richtexteditor.module.css";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

// Визуальный редактор статей базы знаний (TipTap). Хранит содержимое как HTML —
// совместим со статьями, созданными раньше через textarea с сырым HTML.
export default function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false },
      }),
    ],
    content: value,
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Подхват внешнего изменения value (например, после загрузки статьи)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return null;

  function setLink() {
    if (!editor) return;
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt("Ссылка (https://...)");
    if (!url) return;
    editor.chain().focus().setLink({ href: url }).run();
  }

  const btn = (active: boolean) =>
    `${styles.toolBtn} ${active ? styles.toolBtnActive : ""}`;

  return (
    <div className={styles.editor}>
      <div className={styles.toolbar}>
        <button type="button" title="Жирный" className={btn(editor.isActive("bold"))}
          onClick={() => editor.chain().focus().toggleBold().run()}><b>Ж</b></button>
        <button type="button" title="Курсив" className={btn(editor.isActive("italic"))}
          onClick={() => editor.chain().focus().toggleItalic().run()}><i>К</i></button>
        <span className={styles.divider} />
        <button type="button" title="Заголовок" className={btn(editor.isActive("heading", { level: 2 }))}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
        <button type="button" title="Подзаголовок" className={btn(editor.isActive("heading", { level: 3 }))}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
        <span className={styles.divider} />
        <button type="button" title="Маркированный список" className={btn(editor.isActive("bulletList"))}
          onClick={() => editor.chain().focus().toggleBulletList().run()}>•&nbsp;Список</button>
        <button type="button" title="Нумерованный список" className={btn(editor.isActive("orderedList"))}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.&nbsp;Список</button>
        <span className={styles.divider} />
        <button type="button" title="Ссылка" className={btn(editor.isActive("link"))}
          onClick={setLink}>Ссылка</button>
        <span className={styles.divider} />
        <button type="button" title="Отменить" className={styles.toolBtn}
          onClick={() => editor.chain().focus().undo().run()}>↶</button>
        <button type="button" title="Повторить" className={styles.toolBtn}
          onClick={() => editor.chain().focus().redo().run()}>↷</button>
      </div>
      <EditorContent editor={editor} className={styles.content} />
    </div>
  );
}
