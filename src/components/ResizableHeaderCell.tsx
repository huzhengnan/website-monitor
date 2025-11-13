import React, { useRef } from 'react'

type Props = React.ThHTMLAttributes<HTMLTableCellElement> & {
  width?: number
  onResize?: (w: number) => void
}

export default function ResizableHeaderCell(props: Props) {
  const { width, onResize, style, children, ...rest } = props
  const ref = useRef<HTMLTableCellElement | null>(null)
  const s: React.CSSProperties = width ? { ...style, width, position: 'relative' } : style || {}
  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onResize) return
    e.preventDefault()
    const startX = e.clientX
    const startW = (ref.current?.offsetWidth || width || 0)
    const move = (ev: MouseEvent) => {
      const next = Math.max(40, startW + ev.clientX - startX)
      onResize(next)
    }
    const up = () => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }
  return (
    <th ref={ref} style={s} {...rest}>
      {children}
      {typeof width === 'number' ? (
        <div
          style={{ position: 'absolute', right: 0, top: 0, height: '100%', width: 6, cursor: 'col-resize', userSelect: 'none' }}
          onMouseDown={onMouseDown}
        />
      ) : null}
    </th>
  )
}

