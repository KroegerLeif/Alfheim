import { vi } from 'vitest'
import { setupAlfheimTests } from '@alfheim/shared/testing'
import { server } from './mocks/server'

setupAlfheimTests({ server, onUnhandledFrame: 'error', afterEach: () => localStorage.clear() })

vi.mock('next/navigation', async () => (await import('@alfheim/shared/testing')).nextNavigationMock())
