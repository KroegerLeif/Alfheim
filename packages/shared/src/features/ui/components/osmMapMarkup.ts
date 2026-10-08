/**
 * DOM builders for OSMMapViewer markers and popups.
 *
 * Leaflet treats string popup content and string `divIcon` HTML as markup, so
 * any user-provided value interpolated into such a string can inject elements
 * and event-handler attributes (stored XSS). These builders create DOM nodes
 * and only ever assign user values through `textContent` and the CSSOM, so
 * the values are rendered as text and invalid colors are dropped.
 */

/** Text shown in a marker popup. Both fields are rendered as plain text. */
export interface MapPopupText {
	/** Optional bold first line, e.g. a contact name. */
	popupTitle?: string;
	/** Plain-text body; line breaks (`\n`) are kept. */
	popupContent?: string;
}

/**
 * Builds the popup element for a marker, or returns `null` when the marker
 * has neither a title nor content.
 */
export function createPopupElement({ popupTitle, popupContent }: MapPopupText): HTMLElement | null {
	if (!popupTitle && !popupContent) return null;

	const root = document.createElement('div');
	root.style.fontFamily = 'inherit';
	root.style.fontSize = '11px';
	root.style.color = '#1e293b';
	root.style.whiteSpace = 'pre-line';

	if (popupTitle) {
		const title = document.createElement('strong');
		title.style.display = 'block';
		title.textContent = popupTitle;
		root.appendChild(title);
	}
	if (popupContent) {
		const body = document.createElement('span');
		body.textContent = popupContent;
		root.appendChild(body);
	}
	return root;
}

/**
 * Builds the colored dot used as a custom marker icon. The color is assigned
 * through the CSSOM, which ignores values that are not valid CSS colors, so a
 * crafted color string cannot break out of the style attribute.
 */
export function createMarkerDot(color: string): HTMLElement {
	const dot = document.createElement('div');
	dot.style.backgroundColor = color;
	dot.style.width = '14px';
	dot.style.height = '14px';
	dot.style.borderRadius = '50%';
	dot.style.border = '2px solid #ffffff';
	dot.style.boxShadow = '0 2px 6px rgba(0,0,0,0.4)';
	dot.style.transform = 'translate(-1px, -1px)';
	return dot;
}
