"use client"

import * as React from "react"
import { Toast as ToastPrimitive } from "@base-ui/react/toast"

import { cn } from "@/registry/vianova/lib/utils"
import { Button } from "@/registry/vianova/ui/button"
import { XIcon, CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const toast = ToastPrimitive.createToastManager()

function ToastProvider({ ...props }: ToastPrimitive.Provider.Props) {
  return <ToastPrimitive.Provider {...props} />
}

function ToastPortal({ ...props }: ToastPrimitive.Portal.Props) {
  return <ToastPrimitive.Portal data-slot="toast-portal" {...props} />
}

/**
 * Where focus came from before it entered a viewport, per viewport.
 *
 * Base UI keeps exactly this on its store as `prevFocusElement` and exposes
 * `restoreFocusToPrevElement()` to put it back -- but the store is internal
 * (`useToastManager()` returns only `toasts`, `add`, `close`, `update` and
 * `promise`), and it only ever writes `prevFocusElement` from its own F6
 * handler. So a reader who simply tabbed into the region has nothing stored at
 * all. Tracked here instead, on the same trigger the name implies: focus
 * crossing into the viewport from outside it.
 */
function useReturnFocus() {
  const returnTo = React.useRef<HTMLElement | null>(null)

  /** Focus entering the region from outside: remember where it came from. */
  const remember = React.useCallback(
    (viewport: HTMLElement | null, from: EventTarget | null) => {
      if (!viewport) return
      const el = from instanceof HTMLElement ? from : null
      // An internal move (card to card, card to its close button) must not
      // overwrite the way out -- only a crossing from outside counts.
      if (el && viewport.contains(el)) return
      returnTo.current = el
    },
    []
  )

  const restore = React.useCallback(() => {
    const el = returnTo.current
    returnTo.current = null
    if (el?.isConnected) {
      el.focus({ preventScroll: true })
      return true
    }
    return false
  }, [])

  return { remember, restore }
}

function ToastViewport({
  className,
  label = "Notifications",
  hotkey = "F6",
  ...props
}: ToastPrimitive.Viewport.Props & {
  /**
   * The region's accessible name, and what a screen reader reads out in its
   * landmark list.
   *
   * Base UI names every viewport "Notifications". An app with two providers --
   * which is exactly what `StatusToaster` beside `Toaster` is -- therefore
   * ships two identically named regions, and the landmark list stops telling
   * the reader which is which.
   */
  label?: string
  /**
   * The key that moves focus into this viewport. Base UI's own default.
   *
   * Also Base UI's own hard-coded key: it listens on `window` for F6 per
   * provider, so two providers both answer F6 and whichever registered last
   * wins. The listener below runs in the capture phase, ahead of Base UI's, and
   * stops the event there -- which both routes the key to one viewport and
   * takes F6 away from a viewport that has been moved off it. Give each
   * viewport in an app a distinct key; two viewports left on the default
   * collide exactly as they do upstream.
   */
  hotkey?: string
}) {
  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const { toasts } = ToastPrimitive.useToastManager()
  const { remember, restore } = useReturnFocus()

  React.useEffect(() => {
    const el = viewportRef.current
    const win = el?.ownerDocument.defaultView
    if (!el || !win) return
    const viewport = el

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== hotkey && event.key !== "F6") return

      // Capture phase: stopping here is what keeps Base UI's own window
      // listeners -- one per provider, all of them hard-wired to F6 -- from
      // seeing the key at all.
      if (event.key === hotkey) {
        event.preventDefault()
        event.stopPropagation()
        remember(viewport, viewport.ownerDocument.activeElement)
        viewport.focus({ preventScroll: true })
        return
      }

      // F6, on a viewport that has been given another key.
      event.stopPropagation()
    }

    win.addEventListener("keydown", onKeyDown, true)
    return () => win.removeEventListener("keydown", onKeyDown, true)
  }, [hotkey, remember])

  /**
   * Put focus somewhere deliberate when a toast is dismissed from inside it.
   *
   * Base UI handles its focus guards and Shift+Tab out of the region, and
   * nothing else: a close button dismisses its own card, the card unmounts, and
   * a keyboard reader loses their place in the page entirely.
   *
   * Driven off the toast list rather than off a `focusout` listener, because
   * Chromium fires no blur or focusout when the focused element is simply
   * removed from the document -- focus lands on `<body>` silently, which is the
   * whole defect and also why the obvious event hook cannot see it. Measured,
   * not assumed: a `focusout` version of this never ran once.
   *
   * Hanging it on the list instead covers every way a card can take itself
   * down -- `ToastClose`, a `ToastAction` that dismisses, and a pattern's own
   * control like `StatusToast`'s -- with no per-toast wiring, and it fires the
   * moment the card starts animating out rather than 500ms later when it
   * finally unmounts.
   */
  const heldRef = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    const held = heldRef.current
    const viewport = viewportRef.current
    if (!held || !viewport) return

    const owner = toasts.find((t) => t.ref?.current?.contains(held))
    if (owner) {
      // Still a live card: nothing to rescue.
      if (owner.transitionStatus !== "ending" && !owner.limited) return
    } else if (held.isConnected) {
      // Focus is on the viewport itself, or on something that was never in a
      // card. Not ours to move.
      return
    }

    const doc = viewport.ownerDocument
    const active = doc.activeElement
    // The reader may have moved on under their own steam between the dismiss
    // and this effect. Only body-or-inside-the-region is focus we dropped.
    if (active && active !== doc.body && !viewport.contains(active)) return

    heldRef.current = null

    const next = toasts.find(
      (t) =>
        t.ref?.current?.isConnected &&
        t.transitionStatus !== "ending" &&
        !t.limited &&
        !t.ref.current.contains(held)
    )
    if (next?.ref?.current) {
      next.ref.current.focus({ preventScroll: true })
      return
    }

    // Nothing left in the region: back where the reader was before it.
    restore()
  }, [toasts, restore])

  return (
    <ToastPrimitive.Viewport
      ref={viewportRef}
      data-slot="toast-viewport"
      aria-label={label}
      onFocusCapture={(event) => {
        remember(viewportRef.current, event.relatedTarget)
        heldRef.current = event.target as HTMLElement
      }}
      className={cn(
        "pointer-events-none fixed inset-x-4 bottom-4 z-50 mx-auto w-auto max-w-sm outline-none sm:right-4 sm:left-auto sm:mx-0 sm:w-full",
        className
      )}
      {...props}
    />
  )
}

function Toast({ className, ...props }: ToastPrimitive.Root.Props) {
  return (
    <ToastPrimitive.Root
      data-slot="toast"
      className={cn(
        "group/toast pointer-events-auto absolute right-0 bottom-0 z-[calc(1000-var(--toast-index))] w-full origin-bottom rounded-2xl border bg-popover text-popover-foreground shadow-lg will-change-transform outline-none select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "[--gap:0.75rem] [--height:var(--toast-frontmost-height,var(--toast-height))] [--offset-y:calc(var(--toast-offset-y)*-1+calc(var(--toast-index)*var(--gap)*-1)+var(--toast-swipe-movement-y))] [--peek:0.75rem] [--scale:calc(max(0,1-(var(--toast-index)*0.1)))] [--shrink:calc(1-var(--scale))]",
        "h-(--height) [transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-(var(--toast-index)*var(--peek))-(var(--shrink)*var(--height))))_scale(var(--scale))] [transition:transform_500ms_cubic-bezier(0.22,1,0.36,1),opacity_500ms,height_150ms]",
        "after:absolute after:top-full after:left-0 after:h-[calc(var(--gap)+1px)] after:w-full after:content-['']",
        "data-expanded:h-(--toast-height) data-expanded:[transform:translateX(var(--toast-swipe-movement-x))_translateY(var(--offset-y))]",
        "data-limited:opacity-0 data-starting-style:[transform:translateY(150%)]",
        "[&[data-ending-style]:not([data-limited]):not([data-swipe-direction])]:[transform:translateY(150%)]",
        "data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))]",
        "data-ending-style:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))]",
        "data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]",
        "data-ending-style:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))]",
        "data-expanded:data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))]",
        "data-expanded:data-ending-style:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))]",
        "data-expanded:data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]",
        "data-expanded:data-ending-style:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))]",
        className
      )}
      {...props}
    />
  )
}

function ToastContent({ className, ...props }: ToastPrimitive.Content.Props) {
  return (
    <ToastPrimitive.Content
      data-slot="toast-content"
      className={cn(
        "flex h-full items-center gap-3 overflow-hidden p-4 transition-opacity duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] data-behind:opacity-0 data-expanded:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function ToastTitle({ className, ...props }: ToastPrimitive.Title.Props) {
  return (
    <ToastPrimitive.Title
      data-slot="toast-title"
      className={cn("text-sm font-medium", className)}
      {...props}
    />
  )
}

function ToastDescription({
  className,
  ...props
}: ToastPrimitive.Description.Props) {
  return (
    <ToastPrimitive.Description
      data-slot="toast-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function ToastAction({
  className,
  render = <Button variant="outline" size="sm" />,
  ...props
}: ToastPrimitive.Action.Props) {
  return (
    <ToastPrimitive.Action
      data-slot="toast-action"
      render={render}
      className={cn("shrink-0", className)}
      {...props}
    />
  )
}

function ToastClose({
  className,
  children,
  render = <Button variant="ghost" size="icon-sm" />,
  ...props
}: ToastPrimitive.Close.Props) {
  return (
    <ToastPrimitive.Close
      data-slot="toast-close"
      aria-label="Close toast"
      render={render}
      className={cn(
        "relative shrink-0 text-muted-foreground after:absolute after:-inset-2 after:content-[''] hover:text-foreground",
        className
      )}
      {...props}
    >
      {children ?? (
        <XIcon aria-hidden="true" />
      )}
    </ToastPrimitive.Close>
  )
}

function ToastIcon({ type }: { type: string | undefined }) {
  let icon: React.ReactNode = null

  if (type === "success") {
    icon = (
      <CircleCheckIcon aria-hidden="true" />
    )
  }

  if (type === "info") {
    icon = (
      <InfoIcon aria-hidden="true" />
    )
  }

  if (type === "warning") {
    icon = (
      <TriangleAlertIcon aria-hidden="true" />
    )
  }

  if (type === "error") {
    icon = (
      <OctagonXIcon className="text-destructive-ink" aria-hidden="true" />
    )
  }

  if (type === "loading") {
    icon = (
      <Loader2Icon className="animate-spin" aria-hidden="true" />
    )
  }

  if (!icon) {
    return null
  }

  return (
    <span
      data-slot="toast-icon"
      className="shrink-0 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4"
    >
      {icon}
    </span>
  )
}

/**
 * A name for a toast that has no title.
 *
 * Base UI renders each toast as `role="dialog"` and points `aria-labelledby`
 * at whatever `Toast.Title` rendered -- and `Toast.Title` mounts nothing when
 * the toast carries no title, so `manager.add({ description })` produces a
 * dialog with no accessible name at all. A nameless dialog is announced as
 * just "dialog", which tells a screen-reader user that something interrupted
 * them and nothing about what.
 *
 * The description is the only text such a toast has, so it becomes the name.
 * It is read as the dialog's name instead of its description rather than
 * twice: Base UI's `aria-describedby` points at the same text, and a name that
 * equals the description is collapsed by every screen reader we care about.
 */
function toastFallbackName(toastItem: { title?: React.ReactNode; description?: React.ReactNode }) {
  if (toastItem.title) return undefined
  return typeof toastItem.description === "string" ? toastItem.description : "Notification"
}

function ToastList() {
  const { toasts } = ToastPrimitive.useToastManager()

  return toasts.map((toastItem) => (
    <Toast key={toastItem.id} toast={toastItem} aria-label={toastFallbackName(toastItem)}>
      <ToastContent>
        <ToastIcon type={toastItem.type} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <ToastTitle />
          <ToastDescription />
        </div>
        <ToastAction />
        <ToastClose />
      </ToastContent>
    </Toast>
  ))
}

function Toaster({
  children,
  toastManager = toast,
  label,
  hotkey,
  ...props
}: ToastPrimitive.Provider.Props & {
  /**
   * The viewport's accessible name. Base UI's "Notifications" by default.
   *
   * Forwarded rather than fixed because an app running this beside
   * `StatusToaster` has two regions to tell apart, and only the app knows what
   * to call its own.
   */
  label?: string
  /**
   * The key that moves focus into the viewport. F6 by default, as upstream.
   *
   * Pass another one when the app has a second queue: VIP answers F8 here and
   * leaves F6 to `StatusToaster`.
   */
  hotkey?: string
}) {
  return (
    <ToastProvider toastManager={toastManager} {...props}>
      {children}
      <ToastPortal>
        <ToastViewport label={label} hotkey={hotkey}>
          <ToastList />
        </ToastViewport>
      </ToastPortal>
    </ToastProvider>
  )
}

const createToastManager = ToastPrimitive.createToastManager
const useToastManager = ToastPrimitive.useToastManager

export {
  Toaster,
  Toast,
  ToastAction,
  ToastClose,
  ToastContent,
  ToastDescription,
  ToastPortal,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  createToastManager,
  toast,
  useToastManager,
}
