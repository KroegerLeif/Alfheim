'use client';

import React, { useState, useEffect, useRef } from 'react';

// Structured address result format returned from geocoding autocomplete.
export interface AddressResult {
	display_name: string;
	street: string;
	zip: string;
	city: string;
	country: string;
	lat: number;
	lng: number;
}

interface AddressAutocompleteProps {
	placeholder?: string;
	initialValue?: string;
	onSelect: (result: AddressResult) => void;
	className?: string;
}

export function AddressAutocomplete({
	placeholder = 'Search address...',
	initialValue = '',
	onSelect,
	className = ''
}: AddressAutocompleteProps) {
	const [query, setQuery] = useState(initialValue);
	const [results, setResults] = useState<AddressResult[]>([]);
	const [loading, setLoading] = useState(false);
	const [isOpen, setIsOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	// Sync query state if initial value changes from external components
	useEffect(() => {
		setQuery(initialValue);
	}, [initialValue]);

	// Close dropdown search panel if clicking outside the component context
	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
				setIsOpen(false);
			}
		}
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	// Query Nominatim API with debounce delays
	useEffect(() => {
		if (query.length < 3) {
			setResults([]);
			return;
		}

		// Avoid geocoding checks if query exactly matches a display name that was just clicked
		const matchesAnyResult = results.some((r) => r.display_name === query);
		if (matchesAnyResult) return;

		const timer = setTimeout(async () => {
			setLoading(true);
			try {
				const response = await fetch(
					`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`,
					{
						headers: {
							'User-Agent': 'loeger-os-app'
						}
					}
				);
				if (!response.ok) {
					throw new Error('Nominatim request failed');
				}
				const data = await response.json();

				const mapped = data.map((item: any) => {
					const addr = item.address || {};
					const road = addr.road || addr.street || addr.pedestrian || addr.suburb || '';
					const houseNumber = addr.house_number || '';
					const zip = addr.postcode || '';
					const city = addr.city || addr.town || addr.village || '';
					const country = addr.country || '';

					return {
						display_name: item.display_name,
						street: houseNumber ? `${road} ${houseNumber}` : road,
						zip,
						city,
						country,
						lat: parseFloat(item.lat),
						lng: parseFloat(item.lon),
					};
				});
				setResults(mapped);
				setIsOpen(true);
			} catch (err) {
				console.error('Nominatim autocomplete geocoding failure:', err);
			} finally {
				setLoading(false);
			}
		}, 500);

		return () => clearTimeout(timer);
	}, [query]);

	return (
		<div ref={containerRef} className={`relative ${className}`}>
			<div className="relative">
				<input
					type="text"
					value={query}
					onChange={(e) => {
						setQuery(e.target.value);
						setIsOpen(true);
					}}
					placeholder={placeholder}
					className="w-full px-3.5 py-2.5 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)] pr-10 font-sans"
				/>
				{loading && (
					<div className="absolute right-3.5 top-3.5 animate-spin w-4 h-4 border-2 border-[var(--primary-main)] border-t-transparent rounded-full" />
				)}
			</div>

			{isOpen && results.length > 0 && (
				<ul className="absolute z-[100] w-full mt-1.5 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-lg shadow-2xl max-h-60 overflow-y-auto divide-y divide-[var(--border-subtle)] font-sans">
					{results.map((r, idx) => (
						<li
							key={idx}
							onClick={() => {
								setQuery(r.display_name);
								setIsOpen(false);
								onSelect(r);
							}}
							className="px-4 py-3 text-xs text-[var(--text-main)] hover:bg-[var(--surface-elevated)] cursor-pointer transition-colors duration-150"
						>
							{r.display_name}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
