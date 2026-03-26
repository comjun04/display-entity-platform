import type { FC, ReactNode } from 'react'

import { cn } from '@/lib/utils'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog'
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  Dialog as DialogUIRoot,
} from '../ui/dialog'

type DialogProps = {
  // specifies the type of dialog. `alert` uses AlertDialog to render.
  // Changing this when mounted causes dialog to unmount and remount! (uses different component to render)
  type?: 'default' | 'alert'
  open: boolean
  onClose?: () => void
  className?: string
  backdropClassName?: string
  // whether to use large static size for dialog.
  // dialog will be fullscreen on mobile when this is set to true
  useLargeStaticSize?: boolean
  // whether to prevent user from closing the dialog.
  // disables closing dialog by clicking backdrop and removes close button
  // this option is useless when using `alert` type dialog, as alert dialogs passively has this feature
  disableUserClose?: boolean
  title?: string
  children?: ReactNode
}

const Dialog: FC<DialogProps> = ({
  type = 'default',
  open,
  onClose,
  className,
  backdropClassName,
  useLargeStaticSize = true,
  disableUserClose = false,
  title,
  children,
}) => {
  return type === 'alert' ? (
    <AlertDialog
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          onClose?.()
        }
      }}
    >
      <AlertDialogContent className={className}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
        </AlertDialogHeader>

        {children}
      </AlertDialogContent>
    </AlertDialog>
  ) : (
    <DialogUIRoot
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          onClose?.()
        }
      }}
      disablePointerDismissal={disableUserClose}
    >
      <DialogContent
        className={cn(
          useLargeStaticSize && 'h-[calc(100%-2rem)] sm:h-[75vh]',
          className,
        )}
        backdropClassName={backdropClassName}
        showCloseButton={!disableUserClose}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {children}
      </DialogContent>
    </DialogUIRoot>
  )
}

export default Dialog
