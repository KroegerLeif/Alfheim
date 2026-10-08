'use client';

import React, { useEffect, useRef, useState } from 'react';
import type * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { createMarkerDot, createPopupElement } from './osmMapMarkup';

// Marker definitions used by the OSM map component.
export interface MapMarker {
	id: string;
	lat: number;
	lng: number;
	/**
	 * Optional bold first popup line. Rendered as plain text, never as HTML,
	 * so user-provided values need no escaping.
	 */
	popupTitle?: string;
	/**
	 * Popup body. Rendered as plain text, never as HTML; line breaks (`\n`)
	 * are kept. Pass raw user data here, not pre-escaped strings, or the
	 * entities will be shown literally.
	 */
	popupContent?: string;
	/** Optional CSS color for a dot marker; invalid color values are ignored. */
	color?: string;
}

interface OSMMapViewerProps {
	center: [number, number];
	zoom?: number;
	markers?: MapMarker[];
	interactive?: boolean;
	onMapClick?: (lat: number, lng: number) => void;
	style?: React.CSSProperties;
}

export function OSMMapViewer({
	center,
	zoom = 13,
	markers = [],
	interactive = true,
	onMapClick,
	style = { height: '100%', width: '100%', borderRadius: '0.75rem', overflow: 'hidden' }
}: OSMMapViewerProps) {
	const mapContainerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<L.Map | null>(null);
	const leafletRef = useRef<typeof L | null>(null);
	const markersGroupRef = useRef<L.FeatureGroup | null>(null);
	const [isMounted, setIsMounted] = useState(false);

	// Refs to avoid dynamic closure race conditions during async Leaflet load
	const centerRef = useRef(center);
	const zoomRef = useRef(zoom);
	const markersRef = useRef(markers);

	centerRef.current = center;
	zoomRef.current = zoom;
	markersRef.current = markers;

	const syncMarkers = (
		map: L.Map | null,
		leafletInstance: typeof L | null,
		group: L.FeatureGroup | null,
		markersList: MapMarker[]
	) => {
		if (!map || !leafletInstance || !group) return;

		// Clear existing layers in group
		group.clearLayers();

		markersList.forEach((m) => {
			const markerOptions: L.MarkerOptions = {};

			// If a custom color is defined, use a colored dot built from DOM nodes
			if (m.color) {
				markerOptions.icon = leafletInstance.divIcon({
					className: 'custom-leaflet-marker',
					html: createMarkerDot(m.color),
					iconSize: [14, 14],
					iconAnchor: [7, 7],
				});
			}

			const marker = leafletInstance.marker([m.lat, m.lng], markerOptions);
			const popup = createPopupElement(m);
			if (popup) {
				marker.bindPopup(popup);
			}
			group.addLayer(marker);
		});

		// Auto fit bounds if there are multiple markers to map. A container that
		// is not laid out yet (hidden, or smaller than the padding) has no usable
		// size, and Leaflet would compute a NaN zoom for it, so skip fitting then.
		if (markersList.length > 1) {
			const bounds = group.getBounds();
			const size = map.getSize();
			const padding = 30;
			if (bounds.isValid() && size.x > 2 * padding && size.y > 2 * padding) {
				map.fitBounds(bounds, { padding: [padding, padding] });
			}
		}
	};

	useEffect(() => {
		setIsMounted(true);
	}, []);

	useEffect(() => {
		if (!isMounted || !mapContainerRef.current) return;

		let isCancelled = false;

		const initMap = async () => {
			// Dynamically import Leaflet to bypass Server-Side Rendering
			const LeafletModule = await import('leaflet');
			const L = LeafletModule.default || LeafletModule;

			if (isCancelled || !mapContainerRef.current) return;
			leafletRef.current = L;

			// Override default icon assets paths to load from cloud CDN
			delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
			L.Icon.Default.mergeOptions({
				iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
				iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
				shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
			});

			// Cleanup existing map if present
			if (mapRef.current) {
				mapRef.current.remove();
				mapRef.current = null;
			}

			const map = L.map(mapContainerRef.current, {
				center: centerRef.current,
				zoom: zoomRef.current,
				zoomControl: interactive,
				dragging: interactive,
				doubleClickZoom: interactive,
				scrollWheelZoom: interactive,
			});

			// Standard map tiles provider
			L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
				attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
				subdomains: 'abcd',
				maxZoom: 20
			}).addTo(map);

			// Initialize a feature group to manage markers dynamically
			const markersGroup = L.featureGroup().addTo(map);
			markersGroupRef.current = markersGroup;

			mapRef.current = map;

			if (onMapClick && interactive) {
				map.on('click', (e: L.LeafletMouseEvent) => {
					onMapClick(e.latlng.lat, e.latlng.lng);
				});
			}

			// Perform initial marker synchronization using latest props
			syncMarkers(map, L, markersGroup, markersRef.current);
		};

		initMap();

		return () => {
			isCancelled = true;
			if (mapRef.current) {
				mapRef.current.remove();
				mapRef.current = null;
				markersGroupRef.current = null;
			}
		};
	}, [isMounted]);

	// Update Map Center and Zoom dynamically
	useEffect(() => {
		const map = mapRef.current;
		if (map) {
			map.setView(center, map.getZoom() || zoom);
		}
	}, [center]);

	// Sync Markers dynamically
	useEffect(() => {
		syncMarkers(mapRef.current, leafletRef.current, markersGroupRef.current, markers);
	}, [markers]);

	return (
		<div style={{ position: 'relative', width: '100%', height: '100%' }}>
			<div ref={mapContainerRef} style={style} />
		</div>
	);
}
