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
  open: boolean
  onClose?: () => void
  className?: string
  backdropClassName?: string
  // whether to use large static size for dialog.
  // dialog will be fullscreen on mobile when this is set to true
  useLargeStaticSize?: boolean
  // whether to enable modal mode.
  // modal mode disables closing dialog by clicking backdrop and removes close button
  modal?: boolean
  title?: string
  children?: ReactNode
}

const Dialog: FC<DialogProps> = ({
  open,
  onClose,
  className,
  backdropClassName,
  useLargeStaticSize = true,
  modal = false,
  title,
  children,
}) => {
  return modal ? (
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
    >
      <DialogContent
        className={cn(
          useLargeStaticSize && 'h-[calc(100%-2rem)] sm:h-[75vh]',
          className,
        )}
        backdropClassName={backdropClassName}
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
