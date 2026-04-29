import { type FC, useCallback, useEffect, useState } from 'react'

import type { PartialNumber3Tuple } from '@/types/base'

type NumberInputProps = {
  value?: number
  allowNegative?: boolean
  onChange?: (num: number) => void
  className?: string
}

type XYZInputProps = {
  // value가 undefined = 비어 있는 칸
  value: PartialNumber3Tuple
  allowNegative?: boolean
  onChange?: (xyz: PartialNumber3Tuple) => void
}

const NumberInput: FC<NumberInputProps> = ({
  value,
  allowNegative = false,
  onChange,
  className,
}) => {
  const [localValue, setLocalValue] = useState('')
  const [directChange, setDirectChange] = useState(false)

  useEffect(() => {
    if (localValue.length < 1) return

    const num = Number(localValue)
    if (
      directChange &&
      !isNaN(num) &&
      isFinite(num) &&
      (allowNegative || num > 0)
    ) {
      onChange?.(num)
    }

    setDirectChange(false)
  }, [directChange, localValue, allowNegative, onChange])

  useEffect(() => {
    setDirectChange(false)
    setLocalValue(value?.toString() ?? '')
  }, [value])

  return (
    <input
      type="number"
      min={allowNegative ? undefined : 0}
      value={localValue}
      onChange={(evt) => {
        setDirectChange(true)
        setLocalValue(evt.target.value)
      }}
      className={className}
    />
  )
}

const XYZInput: FC<XYZInputProps> = ({
  value,
  allowNegative = false,
  onChange,
}) => {
  const [x, y, z] = value
  const xUpdateFn = useCallback(
    (num: number) => {
      onChange?.([num, undefined, undefined])
    },
    [onChange],
  )
  const yUpdateFn = useCallback(
    (num: number) => {
      onChange?.([undefined, num, undefined])
    },
    [onChange],
  )
  const zUpdateFn = useCallback(
    (num: number) => {
      onChange?.([undefined, undefined, num])
    },
    [onChange],
  )

  return (
    <div className="flex flex-row justify-stretch gap-2">
      <div className="flex flex-row items-center gap-2">
        <span>X</span>
        <NumberInput
          value={x}
          allowNegative={allowNegative}
          onChange={xUpdateFn}
          className="w-full rounded-sm border-l-4 border-red-500 bg-neutral-800 py-1 pl-1 text-xs outline-hidden"
        />
      </div>
      <div className="flex flex-row items-center gap-2">
        <span>Y</span>
        <NumberInput
          value={y}
          allowNegative={allowNegative}
          onChange={yUpdateFn}
          className="w-full rounded-sm border-l-4 border-green-500 bg-neutral-800 py-1 pl-1 text-xs outline-hidden"
        />
      </div>
      <div className="flex flex-row items-center gap-2">
        <span>Z</span>
        <NumberInput
          value={z}
          allowNegative={allowNegative}
          onChange={zUpdateFn}
          className="w-full rounded-sm border-l-4 border-blue-500 bg-neutral-800 py-1 pl-1 text-xs outline-hidden"
        />
      </div>
    </div>
  )
}

export default XYZInput
