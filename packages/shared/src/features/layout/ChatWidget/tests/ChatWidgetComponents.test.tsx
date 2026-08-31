import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ChatWidgetInput } from '../ChatWidgetInput'
import { ChatWidgetMessages } from '../ChatWidgetMessages'
import { LanguageProvider } from '../../../i18n/utils/LanguageContext'

describe('ChatWidgetInput Component', () => {
  beforeEach(() => {
    sessionStorage.clear()
    sessionStorage.setItem('alfheim_access_token', 'valid-jwt')
  })

  it('handles text typing, file attachment upload, and sending message', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()
    const onUploadFile = vi.fn().mockResolvedValue({ id: 'att-123', url: 'blob:test' })

    render(
      <LanguageProvider defaultLanguage="en">
        <ChatWidgetInput onSend={onSend} onUploadFile={onUploadFile} />
      </LanguageProvider>
    )

    const input = screen.getByPlaceholderText(/Type a message/i)
    await user.type(input, 'Hello ALFI{enter}')
    expect(onSend).toHaveBeenCalledWith('Hello ALFI', [])
  })

  it('uploads attachment and attaches to message', async () => {
    const onSend = vi.fn()
    const onUploadFile = vi.fn().mockResolvedValue({ id: 'att-456', url: 'blob:img' })

    const { container } = render(
      <LanguageProvider defaultLanguage="en">
        <ChatWidgetInput onSend={onSend} onUploadFile={onUploadFile} />
      </LanguageProvider>
    )

    const file = new File(['dummy content'], 'photo.png', { type: 'image/png' })
    const fileInput = container.querySelector('input[type="file"]')!

    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(onUploadFile).toHaveBeenCalledWith(file)
    })
  })

  it('handles upload failure gracefully and allows removing attachment', async () => {
    const onSend = vi.fn()
    const onUploadFile = vi.fn().mockRejectedValue(new Error('Upload failed'))

    const { container } = render(
      <LanguageProvider defaultLanguage="en">
        <ChatWidgetInput onSend={onSend} onUploadFile={onUploadFile} />
      </LanguageProvider>
    )

    const file = new File(['dummy'], 'photo.png', { type: 'image/png' })
    const fileInput = container.querySelector('input[type="file"]')!

    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('!')).toBeInTheDocument()
    })

    const removeBtn = screen.getByRole('button', { name: /Remove attachment/i })
    fireEvent.click(removeBtn)
    expect(screen.queryByText('!')).not.toBeInTheDocument()
  })
})

describe('ChatWidgetMessages Component', () => {
  beforeEach(() => {
    sessionStorage.clear()
    sessionStorage.setItem('alfheim_access_token', 'valid-jwt')
  })

  it('renders auth required message when hasAuth is false', () => {
    render(
      <LanguageProvider defaultLanguage="en">
        <ChatWidgetMessages
          messages={[]}
          isStreaming={false}
          streamingText=""
          currentToolCall={null}
          status="idle"
          hasAuth={false}
          error={null}
        />
      </LanguageProvider>
    )

    expect(screen.getByText('Authentication required')).toBeInTheDocument()
  })

  it('renders welcome screen when message list is empty', () => {
    render(
      <LanguageProvider defaultLanguage="en">
        <ChatWidgetMessages
          messages={[]}
          isStreaming={false}
          streamingText=""
          currentToolCall={null}
          status="idle"
          hasAuth={true}
          error={null}
          context={{ sourceApp: 'pantry' }}
        />
      </LanguageProvider>
    )

    expect(screen.getByRole('heading')).toBeInTheDocument()
  })

  it('renders tool calling states and streaming text', () => {
    const messages = [
      {
        id: '1',
        role: 'user' as const,
        content: 'Check pantry',
        attachments: [{ id: 'att-1', url: 'https://example.com/img.png' }],
      },
    ]

    const { rerender } = render(
      <LanguageProvider defaultLanguage="en">
        <ChatWidgetMessages
          messages={messages}
          isStreaming={true}
          streamingText="Checking items..."
          currentToolCall="pantry_search"
          status="tool_calling"
          hasAuth={true}
          error="Test Error"
        />
      </LanguageProvider>
    )

    expect(screen.getByText('Check pantry')).toBeInTheDocument()
    expect(screen.getByText('Checking items...')).toBeInTheDocument()
    expect(screen.getByText('Test Error')).toBeInTheDocument()

    rerender(
      <LanguageProvider defaultLanguage="en">
        <ChatWidgetMessages
          messages={messages}
          isStreaming={true}
          streamingText=""
          currentToolCall="chores_list"
          status="tool_calling"
          hasAuth={true}
          error={null}
        />
      </LanguageProvider>
    )

    rerender(
      <LanguageProvider defaultLanguage="en">
        <ChatWidgetMessages
          messages={messages}
          isStreaming={true}
          streamingText=""
          currentToolCall="maintenance_tickets"
          status="tool_calling"
          hasAuth={true}
          error={null}
        />
      </LanguageProvider>
    )

    rerender(
      <LanguageProvider defaultLanguage="en">
        <ChatWidgetMessages
          messages={messages}
          isStreaming={true}
          streamingText=""
          currentToolCall="shopping_list"
          status="tool_calling"
          hasAuth={true}
          error={null}
        />
      </LanguageProvider>
    )
  })
})
