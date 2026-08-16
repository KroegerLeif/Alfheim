import React from 'react'
import { render, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { OSMMapViewer, MapMarker } from '../OSMMapViewer'

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
