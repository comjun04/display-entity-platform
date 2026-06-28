import { type FC, useEffect, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useTranslation } from 'react-i18next'
import { LuUpload } from 'react-icons/lu'

import { openFromFile } from '../lib/file-handler'
import { cn } from '../lib/utils'
import { useDialogStore } from '../stores/dialogStore'

const FileDropzone: FC = () => {
  const { t } = useTranslation()

  const isAnyDialogOpen = useDialogStore((state) => state.activeDialog != null)

  const [showOverlay, setShowOverlay] = useState(false)

  const { getRootProps, getInputProps } = useDropzone({
    noClick: true,
    disabled: isAnyDialogOpen,
    onDrop: (acceptedFiles) => {
      openFromFile(acceptedFiles[0]).catch(console.error)
      setShowOverlay(false)
    },
    onDragEnter: () => {
      setShowOverlay(true)
    },
    onDragOver: () => {
      setShowOverlay(true)
    },
    onDragLeave: () => {
      setShowOverlay(false)
    },
  })

  useEffect(() => {
    const enableShowingOverlay = (evt: DragEvent) => {
      // ensure that dialogs are not open
      // and the item user is dragging is actually a file (not a string)
      if (!isAnyDialogOpen && evt.dataTransfer?.items[0]?.kind === 'file') {
        setShowOverlay(true)
      }
    }

    document.addEventListener('dragenter', enableShowingOverlay)

    return () => {
      document.removeEventListener('dragenter', enableShowingOverlay)
    }
  }, [isAnyDialogOpen])

  // hide overlay when escape key pressed
  // this rescues user from file drop indicator showed by bug
  useEffect(() => {
    const listener = (evt: KeyboardEvent) => {
      if (evt.key.toLowerCase() === 'escape') {
        setShowOverlay(false)
      }
    }

    document.addEventListener('keydown', listener)
    return () => {
      document.removeEventListener('keydown', listener)
    }
  }, [])

  return (
    <div
      {...getRootProps()}
      className={cn(
        'absolute z-100 flex h-full w-full items-center justify-center',
        !showOverlay && 'pointer-events-none',
      )}
    >
      <input {...getInputProps()} />
      <div
        className={cn(
          'flex h-full w-full flex-col items-center justify-center gap-4 bg-black/50 transition',
          !showOverlay && 'opacity-0',
        )}
      >
        <LuUpload className="text-7xl" />
        <div className="text-3xl">{t(($) => $.dropzone.text)}</div>
      </div>
    </div>
  )
}

export default FileDropzone
