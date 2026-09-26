import { type VariantProps, cva } from 'class-variance-authority'
import { type ButtonHTMLAttributes, forwardRef } from 'react'

import { cn } from '@/lib/utils'

const variants = cva('rounded-lg outline-hidden', {
  variants: {
    size: {
      default: 'p-2',
      sm: 'p-1',
    },
    active: {
      true: 'bg-neutral-300 text-black',
      false: 'bg-black text-neutral-300',
    },
    disabled: {
      true: 'bg-black text-neutral-600',
      false: '',
    },
  },
  defaultVariants: {
    size: 'default',
    active: false,
    disabled: false,
  },
})

interface FloatingButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    Omit<VariantProps<typeof variants>, 'disabled'> {
  active?: boolean
}

const FloatingButton = forwardRef<HTMLButtonElement, FloatingButtonProps>(
  ({ children, size, active = false, disabled, className, ...props }, ref) => {
    return (
      <button
        className={cn(variants({ size, disabled, active }), className)}
        disabled={disabled}
        {...props}
        ref={ref}
      >
        {children}
      </button>
    )
  },
)
FloatingButton.displayName = 'FloatingButton'

export default FloatingButton
