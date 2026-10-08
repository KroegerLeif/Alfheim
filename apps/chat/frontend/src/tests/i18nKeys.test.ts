import { describe, expect, it } from 'vitest'
import { getSharedMessages, type Language } from '@alfheim/shared'

const LANGUAGES: Language[] = ['en', 'de', 'pl']

function resolve(language: Language, key: string): string | undefined {
  let current: unknown = getSharedMessages(language)
  for (const part of key.split('.')) {
    current = (current as Record<string, unknown> | undefined)?.[part]
  }
  return typeof current === 'string' ? current : undefined
}

/** Keys chosen at runtime (status maps, failure headlines, provider labels, metadata). */
const dynamicKeys = [
  'Chat.toolStatusRunning',
  'Chat.toolStatusDone',
  'Chat.toolStatusError',
  'Chat.toolStatusNoResult',
  'Chat.noModelBlocksPrompt',
  'Chat.createError',
  'Chat.sendError',
  'Chat.replyStopped',
  'Chat.networkError',
  'Chat.streamError',
  'Chat.providerOllama',
  'Chat.providerOpenAICompatible',
  'Chat.metaTitle',
  'Chat.metaDescription',
]

describe('chat dictionary', () => {
  it.each(LANGUAGES)('resolves every dynamically used key in %s', (language) => {
    for (const key of dynamicKeys) {
      expect(resolve(language, key), `${language}: ${key}`).toBeTruthy()
    }
  })

  it('translates German and Polish instead of copying English', () => {
    const sameAsEnglishAllowed = new Set(['Chat.metaTitle'])
    const keys = [
      ...dynamicKeys,
      'Chat.newConversationModel',
      'Chat.modelUnavailable',
      'Chat.deleteConversation',
      'Chat.stopReply',
      'Chat.retry',
      'Chat.toolCallsTitle',
      'Chat.toolArguments',
      'Chat.toolResult',
      'Chat.backToConversations',
      'Chat.saveModelError',
    ]
    for (const key of keys) {
      if (sameAsEnglishAllowed.has(key)) continue
      const english = resolve('en', key)
      expect(resolve('de', key), `de: ${key}`).not.toBe(english)
      expect(resolve('pl', key), `pl: ${key}`).not.toBe(english)
    }
  })
})
