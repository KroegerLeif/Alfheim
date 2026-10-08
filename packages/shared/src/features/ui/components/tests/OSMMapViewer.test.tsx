import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { OSMMapViewer, MapMarker } from '../OSMMapViewer'
import { createMarkerDot, createPopupElement } from '../osmMapMarkup'

describe('OSMMapViewer Component', () => {
  const center: [number, number] = [52.52, 13.405] // Berlin coordinates
  const markers: MapMarker[] = [
    { id: 'm1', lat: 52.52, lng: 13.405, popupContent: 'Berlin Center', color: '#2563eb' },
    { id: 'm2', lat: 52.53, lng: 13.41, popupContent: 'Berlin North' },
  ]

  it('passes accessibility audit', async () => {
    const { container } = render(
      <OSMMapViewer center={center} markers={markers} zoom={12} />
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('renders map container with provided dimensions and mounts leaflet', async () => {
    const { container } = render(
      <OSMMapViewer
        center={center}
        markers={markers}
        zoom={13}
        style={{ width: '500px', height: '300px' }}
      />
    )

    const mapElement = container.querySelector('div[style*="height: 300px"]')
    expect(mapElement).toBeInTheDocument()

    // Wait for dynamic Leaflet initialization
    await waitFor(() => {
      expect(container.querySelector('.leaflet-container')).toBeInTheDocument()
    })
  })
})

describe('OSMMapViewer popup safety', () => {
  const payload = '<img src=x onerror="window.__osmXss = true">'

  it('renders a marker popup payload as text, not markup', async () => {
    const markers: MapMarker[] = [
      { id: 'xss', lat: 52.52, lng: 13.405, popupTitle: payload, popupContent: `${payload}\nline 2` },
    ]
    const { container } = render(<OSMMapViewer center={[52.52, 13.405]} markers={markers} />)

    const icon = await waitFor(() => {
      const el = container.querySelector('.leaflet-marker-icon')
      expect(el).toBeInTheDocument()
      return el as HTMLElement
    })
    fireEvent.click(icon)

    const content = await waitFor(() => {
      const el = container.querySelector('.leaflet-popup-content')
      expect(el).toBeInTheDocument()
      return el as HTMLElement
    })
    expect(content.querySelector('img')).toBeNull()
    expect(content.querySelector('strong')).toHaveTextContent(payload)
    expect(content.textContent).toContain(`${payload}\nline 2`)
    expect((window as unknown as { __osmXss?: boolean }).__osmXss).toBeUndefined()
  })

  it('keeps a crafted marker color out of the icon markup', async () => {
    const markers: MapMarker[] = [
      { id: 'c', lat: 52.52, lng: 13.405, color: `red"></div>${payload}<div style="` },
    ]
    const { container } = render(<OSMMapViewer center={[52.52, 13.405]} markers={markers} />)

    const icon = await waitFor(() => {
      const el = container.querySelector('.custom-leaflet-marker')
      expect(el).toBeInTheDocument()
      return el as HTMLElement
    })
    expect(icon.querySelector('img')).toBeNull()
    expect(icon.firstElementChild?.getAttribute('style') ?? '').not.toContain('onerror')
  })
})

describe('osmMapMarkup', () => {
  it('returns null without a title or content', () => {
    expect(createPopupElement({})).toBeNull()
  })

  it('builds a text-only popup with an optional title', () => {
    const titleOnly = createPopupElement({ popupTitle: '<b>Home</b>' })!
    expect(titleOnly.querySelector('b')).toBeNull()
    expect(titleOnly.textContent).toBe('<b>Home</b>')

    const contentOnly = createPopupElement({ popupContent: 'Cost $& <i>more</i>' })!
    expect(contentOnly.querySelector('strong')).toBeNull()
    expect(contentOnly.querySelector('i')).toBeNull()
    expect(contentOnly.textContent).toBe('Cost $& <i>more</i>')
  })

  it('applies valid colors and drops invalid ones', () => {
    expect(createMarkerDot('#2563eb').style.backgroundColor).toBe('rgb(37, 99, 235)')
    expect(createMarkerDot('red"><img src=x>').style.backgroundColor).toBe('')
  })
})
