"use client";

import * as React from "react";
import {
  Bold,
  Code,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  SquareCode,
  Strikethrough,
  Unlink,
} from "lucide-react";
import {
  EditorContent,
  useEditor,
  useEditorState,
  type Editor,
} from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";

import { Button } from "@/registry/vianova/ui/button";
import { Input } from "@/registry/vianova/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/registry/vianova/ui/native-select";
import { cn } from "@/registry/vianova/lib/utils";

/**
 * Rendered Markdown, styled here rather than by a typography plugin the DS
 * does not ship. Shared by the editor and by anything that shows the same
 * text read-only, so a heading looks the same while and after it is edited.
 */
export const markdownContentClass = cn(
  "text-sm leading-relaxed",
  "[&_h1]:mb-2 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight",
  "[&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight",
  "[&_h3]:mb-1.5 [&_h3]:text-base [&_h3]:font-semibold",
  "[&_p]:my-1.5 [&_p:first-child]:mt-0",
  "[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_blockquote]:text-muted-foreground [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:pl-3",
  "[&_code]:bg-muted [&_code]:rounded [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.85em]",
  "[&_pre]:bg-muted [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
);

type BlockType = "paragraph" | "h1" | "h2" | "h3";

const BLOCK_LABELS: Record<BlockType, string> = {
  paragraph: "Paragraph",
  h1: "Heading 1",
  h2: "Heading 2",
  h3: "Heading 3",
};

function ToolButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      // Keeps the selection: a mousedown would otherwise move focus off the
      // text, collapse the selection and close the menu before the click lands.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="aria-pressed:bg-muted aria-pressed:text-foreground"
    >
      {children}
    </Button>
  );
}

/**
 * The formatting bar that appears over a selection: block type, marks, quote,
 * code block, lists and a link. Every control keeps focus inside the bar, so
 * the bar does not close under the pointer.
 */
function SelectionToolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: (e.isActive("heading", { level: 1 })
        ? "h1"
        : e.isActive("heading", { level: 2 })
          ? "h2"
          : e.isActive("heading", { level: 3 })
            ? "h3"
            : "paragraph") as BlockType,
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      quote: e.isActive("blockquote"),
      codeBlock: e.isActive("codeBlock"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      link: e.isActive("link"),
      href: (e.getAttributes("link").href as string | undefined) ?? "",
    }),
  });
  const [linking, setLinking] = React.useState(false);
  const [href, setHref] = React.useState("");
  const chain = () => editor.chain().focus();

  const applyLink = () => {
    const url = href.trim();
    if (!url) chain().extendMarkRange("link").unsetLink().run();
    else
      chain()
        .extendMarkRange("link")
        .setLink({ href: /^[a-z]+:/i.test(url) ? url : `https://${url}` })
        .run();
    setLinking(false);
  };

  return (
    <div
      role="toolbar"
      aria-label="Text formatting"
      className="bg-popover text-popover-foreground flex items-center gap-0.5 rounded-lg p-1 shadow-md ring-1 ring-foreground/10"
    >
      {linking ? (
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            applyLink();
          }}
        >
          <Input
            autoFocus
            value={href}
            onChange={(e) => setHref(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                setLinking(false);
                editor.commands.focus();
              }
            }}
            placeholder="Paste a link"
            aria-label="Link address"
            className="h-8 w-56"
          />
          <Button type="submit" size="sm">
            Apply
          </Button>
        </form>
      ) : (
        <>
          <NativeSelect
            size="sm"
            aria-label="Text style"
            value={state.block}
            onChange={(e) => {
              const v = e.target.value as BlockType;
              if (v === "paragraph") chain().setParagraph().run();
              else
                chain()
                  .setHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 })
                  .run();
            }}
            className="[&_select]:border-transparent [&_select]:shadow-none"
          >
            {(Object.keys(BLOCK_LABELS) as BlockType[]).map((b) => (
              <NativeSelectOption key={b} value={b}>
                {BLOCK_LABELS[b]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <ToolButton
            label="Bold"
            pressed={state.bold}
            onClick={() => chain().toggleBold().run()}
          >
            <Bold />
          </ToolButton>
          <ToolButton
            label="Italic"
            pressed={state.italic}
            onClick={() => chain().toggleItalic().run()}
          >
            <Italic />
          </ToolButton>
          <ToolButton
            label="Strikethrough"
            pressed={state.strike}
            onClick={() => chain().toggleStrike().run()}
          >
            <Strikethrough />
          </ToolButton>
          <ToolButton
            label="Inline code"
            pressed={state.code}
            onClick={() => chain().toggleCode().run()}
          >
            <Code />
          </ToolButton>
          <ToolButton
            label="Quote"
            pressed={state.quote}
            onClick={() => chain().toggleBlockquote().run()}
          >
            <Quote />
          </ToolButton>
          <ToolButton
            label="Code block"
            pressed={state.codeBlock}
            onClick={() => chain().toggleCodeBlock().run()}
          >
            <SquareCode />
          </ToolButton>
          <ToolButton
            label="Bulleted list"
            pressed={state.bullet}
            onClick={() => chain().toggleBulletList().run()}
          >
            <List />
          </ToolButton>
          <ToolButton
            label="Numbered list"
            pressed={state.ordered}
            onClick={() => chain().toggleOrderedList().run()}
          >
            <ListOrdered />
          </ToolButton>
          {state.link ? (
            <ToolButton
              label="Remove link"
              pressed
              onClick={() => chain().extendMarkRange("link").unsetLink().run()}
            >
              <Unlink />
            </ToolButton>
          ) : (
            <ToolButton
              label="Add link"
              onClick={() => {
                setHref(state.href);
                setLinking(true);
              }}
            >
              <Link2 />
            </ToolButton>
          )}
        </>
      )}
    </div>
  );
}

export type MarkdownEditorHandle = {
  /**
   * Focus the editor and select its first block, so typing replaces it. False
   * while the editor has not mounted yet.
   */
  selectFirstBlock: () => boolean;
};

/**
 * Edit Markdown as formatted text, or as its source.
 *
 * The value is always Markdown: what is stored, exported and diffed is plain
 * text, and the rich view is only a way of editing it. `mode` switches between
 * the two; the caller owns the switch, since it usually sits in a header the
 * editor does not draw.
 */
export const MarkdownEditor = React.forwardRef<
  MarkdownEditorHandle,
  {
    value: string;
    onValueChange: (markdown: string) => void;
    mode?: "rich" | "markdown";
    /** Names the editable region for assistive tech. */
    label: string;
    className?: string;
    onFocus?: () => void;
    onBlur?: () => void;
  }
>(function MarkdownEditor(
  { value, onValueChange, mode = "rich", label, className, onFocus, onBlur },
  ref,
) {
  // Read through a ref so the editor, created once, always calls the latest one.
  const changeRef = React.useRef(onValueChange);
  changeRef.current = onValueChange;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true } }),
      Markdown,
    ],
    content: value,
    contentType: "markdown",
    // Rendering waits for the client: the server has no DOM to build it in.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        "aria-label": label,
        "aria-multiline": "true",
        role: "textbox",
        class: "min-h-full outline-none",
      },
    },
    onUpdate: ({ editor: e }) => changeRef.current(e.getMarkdown()),
    onFocus: () => onFocus?.(),
    onBlur: () => onBlur?.(),
  });

  // A value changed from outside -- the source view, or an undo in the host --
  // is pushed in, but never the editor's own echo, which would reset the cursor.
  React.useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (editor.getMarkdown() !== value)
      editor.commands.setContent(value, {
        contentType: "markdown",
        emitUpdate: false,
      });
  }, [editor, value, mode]);

  React.useImperativeHandle(
    ref,
    () => ({
      selectFirstBlock: () => {
        if (!editor || editor.isDestroyed || !editor.view.dom.isConnected)
          return false;
        const first = editor.state.doc.firstChild;
        return editor
          .chain()
          .focus()
          .setTextSelection({ from: 1, to: 1 + (first?.content.size ?? 0) })
          .run();
      },
    }),
    [editor],
  );

  if (mode === "markdown") {
    return (
      <textarea
        aria-label={`${label}, Markdown source`}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        spellCheck={false}
        className={cn(
          "placeholder:text-muted-foreground size-full resize-none bg-transparent font-mono text-sm outline-none",
          className,
        )}
      />
    );
  }

  return (
    <div
      data-slot="markdown-editor"
      className={cn(markdownContentClass, "size-full", className)}
    >
      {editor ? (
        <BubbleMenu
          editor={editor}
          options={{ placement: "top-start", offset: 8 }}
        >
          <SelectionToolbar editor={editor} />
        </BubbleMenu>
      ) : null}
      <EditorContent editor={editor} className="size-full" />
    </div>
  );
});
