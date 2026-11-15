import { vi } from 'vitest'
import { setupAlfheimTests } from '../testing'

setupAlfheimTests({ sharedStorage: false, matchMedia: true })

vi.mock('next/navigation', async () => (await import('../testing')).nextNavigationMock())
