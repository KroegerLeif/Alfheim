import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ReceiptDropzone } from '../ReceiptDropzone'

describe('ReceiptDropzone Extended Tests', () => {
  it('handles drag over, drag leave, and file drop', () => {
    const onFileSelect = vi.fn()
    render(<ReceiptDropzone onFileSelect={onFileSelect} />)

    const dropzone = screen.getByText(/Click to upload/i).closest('div')!

    fireEvent.dragOver(dropzone)
    fireEvent.dragLeave(dropzone)

    const file = new File(['data'], 'receipt.pdf', { type: 'application/pdf' })
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [file] },
    })

    expect(onFileSelect).toHaveBeenCalledWith(file)
  })

  it('displays error message when file exceeds maximum allowed size', () => {
    const onFileSelect = vi.fn()
    render(<ReceiptDropzone onFileSelect={onFileSelect} maxSizeMB={1} />)

    const largeFile = new File([new ArrayBuffer(2 * 1024 * 1024)], 'large.pdf', {
      type: 'application/pdf',
    })

    const input = screen.getByTestId('receipt-input')
    fireEvent.change(input, { target: { files: [largeFile] } })

    expect(screen.getByText('File exceeds maximum size of 1MB')).toBeInTheDocument()
  })

  it('removes selected file when remove button is clicked', () => {
    const onFileSelect = vi.fn()
    const file = new File(['data'], 'receipt.pdf', { type: 'application/pdf' })

    render(<ReceiptDropzone onFileSelect={onFileSelect} selectedFile={file} />)

    const removeBtn = screen.getByRole('button', { name: /Remove file/i })
    fireEvent.click(removeBtn)

    expect(onFileSelect).toHaveBeenCalledWith(null)
  })
})
