'use client';

import { useState, useEffect } from 'react';
import { useTranslation, AddressAutocomplete } from '@loeger-os/shared';
import dynamic from 'next/dynamic';

const OSMMapViewer = dynamic(
	() => import('@loeger-os/shared').then((mod) => mod.OSMMapViewer),
	{ ssr: false }
);
import { useHouseholds, useCreateHousehold, useCreateInvite, useJoinHousehold } from '@/features/household';
import {
	useContacts,
	useCreateContact,
	useUpdateContact,
	useDeleteContact,
	useCategories,
	useCreateCategory,
	useUpdateCategory,
	useDeleteCategory,
	useUpdateHouseholdAddress,
	useUpdateMemberRole,
	useRemoveMember
} from '@/features/contact/queries';
import { QRCodeModal } from '@/features/household/components/QRCodeModal';
import { InviteCodeResponse, HouseholdMember, Contact, ContactCategory } from '@/shared/types';

export default function HouseholdPage() {
	const { t } = useTranslation();
	const { data: households, isLoading, isError } = useHouseholds();
	const createHouseholdMutation = useCreateHousehold();
	const createInviteMutation = useCreateInvite();
	const joinMutation = useJoinHousehold();

	const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | null>(null);
	const [activeInvite, setActiveInvite] = useState<InviteCodeResponse | null>(null);
	const [joinTokenInput, setJoinTokenInput] = useState('');
	const [joinStatus, setJoinStatus] = useState<string | null>(null);

	// Create Household Modal state
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
	const [newHouseholdName, setNewHouseholdName] = useState('');
	const [createStatus, setCreateStatus] = useState<string | null>(null);

	// Address Modal state
	const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

	// Category Modal state
	const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
	const [editingCategory, setEditingCategory] = useState<ContactCategory | null>(null);
	const [categoryName, setCategoryName] = useState('');
	const [categoryIcon, setCategoryIcon] = useState('person');
	const [categoryColor, setCategoryColor] = useState('#2563eb');

	// Contact Modal state
	const [isContactModalOpen, setIsContactModalOpen] = useState(false);
	const [editingContact, setEditingContact] = useState<Contact | null>(null);
	const [contactName, setContactName] = useState('');
	const [contactPhone, setContactPhone] = useState('');
	const [contactEmail, setContactEmail] = useState('');
	const [contactAddress, setContactAddress] = useState('');
	const [contactLat, setContactLat] = useState<number | null>(null);
	const [contactLng, setContactLng] = useState<number | null>(null);
	const [contactDesc, setContactDesc] = useState('');
	const [contactLinks, setContactLinks] = useState('');
	const [contactCatId, setContactCatId] = useState<string>('');

	// Contacts view mode toggle
	const [isMapView, setIsMapView] = useState(false);

	const handleHouseholdSelect = (id: string, role?: string) => {
		setSelectedHouseholdId(id);
		localStorage.setItem('loeger_os_active_household_id', id);
		if (role) {
			localStorage.setItem('loeger_os_active_household_role', role);
		} else {
			localStorage.removeItem('loeger_os_active_household_role');
		}
		window.dispatchEvent(new Event('storage-household-changed'));
	};

	useEffect(() => {
		if (households && households.length > 0) {
			const saved = localStorage.getItem('loeger_os_active_household_id');
			const found = households.find((h) => h.id === saved);
			if (saved && found) {
				setSelectedHouseholdId(saved);
				localStorage.setItem('loeger_os_active_household_role', found.role || 'MEMBER');
			} else {
				const defaultHh = households[0];
				handleHouseholdSelect(defaultHh.id, defaultHh.role);
			}
		}
	}, [households]);

	const activeHousehold = households && households.length > 0
		? households.find((h) => h.id === selectedHouseholdId) || households[0]
		: null;

	const householdId = activeHousehold?.id || '';

	// Active role checks
	const activeRole = (activeHousehold?.role || 'MEMBER').toUpperCase();
	const isOwnerOrAdmin = activeRole === 'OWNER' || activeRole === 'ADMIN';
	const isGuest = activeRole === 'GUEST';

	// Contacts and Categories Queries & Mutations
	const { data: contacts = [] } = useContacts(householdId);
	const { data: categories = [] } = useCategories(householdId);

	const updateAddressMutation = useUpdateHouseholdAddress();
	const updateMemberRoleMutation = useUpdateMemberRole(householdId);
	const removeMemberMutation = useRemoveMember(householdId);

	const createContactMutation = useCreateContact(householdId);
	const updateContactMutation = useUpdateContact(householdId);
	const deleteContactMutation = useDeleteContact(householdId);

	const createCategoryMutation = useCreateCategory(householdId);
	const updateCategoryMutation = useUpdateCategory(householdId);
	const deleteCategoryMutation = useDeleteCategory(householdId);

	const handleGenerateInvite = () => {
		if (!activeHousehold) return;
		createInviteMutation.mutate(
			{
				household_id: activeHousehold.id,
				role: 'MEMBER',
				ttl_minutes: 60,
				max_uses: 5,
			},
			{
				onSuccess: (data) => {
					setActiveInvite(data);
				},
			}
		);
	};

	const handleCreateHouseholdSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!newHouseholdName.trim()) return;
		setCreateStatus(null);

		createHouseholdMutation.mutate(
			{ name: newHouseholdName.trim() },
			{
				onSuccess: (newHh) => {
					setNewHouseholdName('');
					setIsCreateModalOpen(false);
					if (newHh?.id) {
						handleHouseholdSelect(newHh.id, 'OWNER');
					}
				},
				onError: (err) => {
					setCreateStatus(t('household.create_failed', { error: err.message }));
				},
			}
		);
	};

	const handleJoinSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!joinTokenInput.trim()) return;
		setJoinStatus(null);

		joinMutation.mutate(
			{ token: joinTokenInput.trim() },
			{
				onSuccess: (household) => {
					setJoinStatus(t('household.join_success', { name: household.name }));
					setJoinTokenInput('');
					if (household?.id) {
						handleHouseholdSelect(household.id, household.role);
					}
				},
				onError: (err) => {
					setJoinStatus(t('household.join_failed', { error: err.message }));
				},
			}
		);
	};

	// Save Address Address Geocoding
	const handleAddressSelect = (addr: any) => {
		if (!activeHousehold) return;
		updateAddressMutation.mutate({
			householdId: activeHousehold.id,
			payload: {
				street: addr.street,
				zip: addr.zip,
				city: addr.city,
				country: addr.country,
				latitude: addr.lat,
				longitude: addr.lng,
			}
		}, {
			onSuccess: () => {
				setIsAddressModalOpen(false);
			}
		});
	};

	// Member role actions
	const handleRoleChange = (userId: string, currentRole: string, newRole: string) => {
		if (currentRole === 'OWNER') return;
		updateMemberRoleMutation.mutate({ userId, role: newRole });
	};

	const handleRemoveMemberClick = (userId: string, displayName: string) => {
		if (confirm(`${t('household.confirm_remove')} (${displayName})`)) {
			removeMemberMutation.mutate(userId);
		}
	};

	// Category Modal actions
	const openCategoryModal = (cat: ContactCategory | null = null) => {
		if (cat) {
			setEditingCategory(cat);
			setCategoryName(cat.name);
			setCategoryIcon(cat.icon || 'person');
			setCategoryColor(cat.color || '#2563eb');
		} else {
			setEditingCategory(null);
			setCategoryName('');
			setCategoryIcon('person');
			setCategoryColor('#2563eb');
		}
		setIsCategoryModalOpen(true);
	};

	const handleCategorySubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!categoryName.trim()) return;

		const payload = {
			name: categoryName.trim(),
			icon: categoryIcon,
			color: categoryColor,
		};

		if (editingCategory) {
			updateCategoryMutation.mutate({ catId: editingCategory.id, payload }, {
				onSuccess: () => setIsCategoryModalOpen(false)
			});
		} else {
			createCategoryMutation.mutate(payload, {
				onSuccess: () => setIsCategoryModalOpen(false)
			});
		}
	};

	const handleDeleteCategory = (catId: string) => {
		if (confirm(t('household.confirm_delete_category'))) {
			deleteCategoryMutation.mutate(catId);
		}
	};

	// Contact Modal actions
	const openContactModal = (c: Contact | null = null) => {
		if (c) {
			setEditingContact(c);
			setContactName(c.name);
			setContactPhone(c.phone);
			setContactEmail(c.email);
			setContactAddress(c.address);
			setContactLat(c.latitude || null);
			setContactLng(c.longitude || null);
			setContactDesc(c.description);
			setContactLinks(c.links.join('\n'));
			setContactCatId(c.category_id || '');
		} else {
			setEditingContact(null);
			setContactName('');
			setContactPhone('');
			setContactEmail('');
			setContactAddress('');
			setContactLat(null);
			setContactLng(null);
			setContactDesc('');
			setContactLinks('');
			setContactCatId('');
		}
		setIsContactModalOpen(true);
	};

	const handleContactSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!contactName.trim()) return;

		const payload = {
			category_id: contactCatId || null,
			name: contactName.trim(),
			phone: contactPhone.trim(),
			email: contactEmail.trim(),
			address: contactAddress.trim(),
			latitude: contactLat,
			longitude: contactLng,
			description: contactDesc.trim(),
			links: contactLinks.split('\n').map(l => l.trim()).filter(Boolean),
		};

		if (editingContact) {
			updateContactMutation.mutate({ contactId: editingContact.id, payload }, {
				onSuccess: () => setIsContactModalOpen(false)
			});
		} else {
			createContactMutation.mutate(payload, {
				onSuccess: () => setIsContactModalOpen(false)
			});
		}
	};

	const handleDeleteContact = (contactId: string) => {
		if (confirm(t('household.confirm_delete_contact'))) {
			deleteContactMutation.mutate(contactId);
		}
	};

	if (isLoading) {
		return (
			<div className="col-span-12 p-8 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] animate-pulse space-y-4">
				<div className="h-8 w-64 bg-[var(--surface-elevated)] rounded" />
				<div className="h-40 w-full bg-[var(--surface-elevated)] rounded-xl" />
			</div>
		);
	}

	const getMemberDisplayName = (m: HouseholdMember) => {
		if (m.first_name || m.last_name) {
			return `${m.first_name || ''} ${m.last_name || ''}`.trim();
		}
		if (m.username) return `@${m.username}`;
		if (m.email) return m.email;
		if (m.user_id) {
			return `User (${m.user_id.substring(0, 8)}...)`;
		}
		return t('household.member_user');
	};

	const getMemberInitials = (m: HouseholdMember) => {
		if (m.first_name && m.last_name) {
			return `${m.first_name[0]}${m.last_name[0]}`.toUpperCase();
		}
		if (m.username) return m.username.substring(0, 2).toUpperCase();
		if (m.email) return m.email.substring(0, 2).toUpperCase();
		return 'MU';
	};

	const hasGeocodedAddress = activeHousehold?.latitude && activeHousehold?.longitude;
	const mapCenter: [number, number] = hasGeocodedAddress
		? [activeHousehold.latitude!, activeHousehold.longitude!]
		: [52.520008, 13.404954]; // Fallback Berlin center

	const contactMarkers = contacts
		.filter((c) => c.latitude && c.longitude)
		.map((c) => {
			const cat = categories.find((cat) => cat.id === c.category_id);
			return {
				id: c.id,
				lat: c.latitude!,
				lng: c.longitude!,
				popupContent: `<strong>${c.name}</strong><br/>${c.address || ''}<br/>${c.phone || ''}`,
				color: cat?.color || '#2563eb',
			};
		});

	return (
		<>
			{isError || !households || households.length === 0 || !activeHousehold ? (
				/* Zero Household Empty State */
				<div className="col-span-12 min-h-[65vh] flex flex-col items-center justify-center p-8 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] relative overflow-hidden shadow-2xl">
					<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[var(--primary-main)]/5 rounded-full blur-3xl pointer-events-none" />

					<div className="w-16 h-16 rounded-2xl bg-[var(--primary-main)]/10 border border-[var(--border-accent)] flex items-center justify-center text-[var(--primary-main)] mb-4 shadow-[0_0_20px_var(--accent-glow)]">
						<span className="material-symbols-outlined text-3xl">home_app_logo</span>
					</div>

					<h1 className="text-2xl font-bold text-[var(--text-main)] mb-2">{t('household.no_household')}</h1>
					<p className="text-xs text-[var(--text-muted)] max-w-md text-center mb-8 leading-relaxed font-sans">
						{t('household.no_household_desc')}
					</p>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-xl">
						{/* Create Household Card */}
						<div className="p-5 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] flex flex-col justify-between space-y-4">
							<div>
								<div className="flex items-center gap-2 text-sm font-bold text-[var(--text-main)] mb-1">
									<span className="material-symbols-outlined text-[var(--primary-main)]">add_home</span>
									<span>{t('household.create_household')}</span>
								</div>
								<p className="text-xs text-[var(--text-muted)]">
									{t('household.create_household_desc')}
								</p>
							</div>
							<button
								onClick={() => setIsCreateModalOpen(true)}
								className="w-full py-2.5 rounded-lg bg-[var(--primary-main)] text-slate-950 font-bold text-xs hover:bg-[var(--primary-hover)] transition-all cursor-pointer shadow-md"
							>
								{t('household.create_household')}
							</button>
						</div>

						{/* Join Household Card */}
						<div className="p-5 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] flex flex-col justify-between space-y-4">
							<div>
								<div className="flex items-center gap-2 text-sm font-bold text-[var(--text-main)] mb-1">
									<span className="material-symbols-outlined text-[var(--primary-main)]">qr_code_scanner</span>
									<span>{t('household.join_household')}</span>
								</div>
								<p className="text-xs text-[var(--text-muted)]">
									{t('household.join_household_desc')}
								</p>
							</div>

							<form onSubmit={handleJoinSubmit} className="space-y-2">
								<input
									type="text"
									placeholder={t('household.invite_token_placeholder')}
									value={joinTokenInput}
									onChange={(e) => setJoinTokenInput(e.target.value)}
									className="w-full px-3 py-2 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
									required
								/>
								<button
									type="submit"
									disabled={joinMutation.isPending}
									className="w-full py-2 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50 text-xs font-semibold text-[var(--text-main)] transition-all cursor-pointer disabled:opacity-50"
								>
									{joinMutation.isPending ? t('household.joining') : t('household.submit_token')}
								</button>
							</form>
						</div>
					</div>
				</div>
			) : (
				/* Active Household Layout */
				<>
					{/* Household Header */}
					<div className="col-span-12 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
						<div>
							<div className="flex items-center gap-3 mb-2">
								<div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--primary-main)]/10 text-[var(--primary-main)] text-xs font-mono border border-[var(--border-accent)]">
									<span className="material-symbols-outlined text-sm">home</span>
									{t('household.title')}
								</div>

								{/* Multiple Household Switcher */}
								{households.length > 1 && (
									<select
										value={activeHousehold.id}
										onChange={(e) => {
											const found = households.find(h => h.id === e.target.value);
											handleHouseholdSelect(e.target.value, found?.role);
										}}
										className="px-2.5 py-1 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-main)] cursor-pointer"
									>
										{households.map((h) => (
											<option key={h.id} value={h.id}>
												{h.name}
											</option>
										))}
									</select>
								)}
							</div>

							<h1 className="text-2xl font-bold text-[var(--text-main)]">
								{activeHousehold.name}
							</h1>
							<p className="text-xs font-mono text-[var(--text-muted)] mt-1">
								Slug: {activeHousehold.slug} • {t('common.role')}: {activeHousehold.role || 'Member'}
							</p>
						</div>

						<div className="flex items-center gap-2">
							<button
								onClick={() => setIsCreateModalOpen(true)}
								className="px-3.5 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50 text-[var(--text-main)] font-mono text-xs flex items-center gap-1.5 cursor-pointer transition-all duration-150"
							>
								<span className="material-symbols-outlined text-sm">add_home</span>
								<span>{t('household.create_household')}</span>
							</button>

							{!isGuest && (
								<button
									onClick={handleGenerateInvite}
									disabled={createInviteMutation.isPending}
									className="px-4 py-2 rounded-lg bg-[var(--primary-main)] text-slate-950 font-bold text-xs hover:bg-[var(--primary-hover)] transition-all duration-200 shadow-[0_0_15px_var(--accent-glow)] cursor-pointer flex items-center gap-2 disabled:opacity-50"
								>
									<span className="material-symbols-outlined text-base">qr_code_2</span>
									{createInviteMutation.isPending ? t('common.loading') : t('household.generate_invite')}
								</button>
							)}
						</div>
					</div>

					{/* Top Banner Address details */}
					<div className="col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-6">
						<div className="lg:col-span-4 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] flex flex-col justify-between space-y-4">
							<div className="space-y-2">
								<h2 className="text-sm font-mono uppercase text-[var(--text-muted)] flex items-center gap-1">
									<span className="material-symbols-outlined text-base text-[var(--primary-main)]">pin_drop</span>
									{t('household.address')}
								</h2>
								{activeHousehold.street ? (
									<div className="space-y-1 font-sans text-xs text-[var(--text-main)] leading-relaxed">
										<p className="font-semibold text-sm">{activeHousehold.street}</p>
										<p>{activeHousehold.zip} {activeHousehold.city}</p>
										<p className="text-[var(--text-muted)]">{activeHousehold.country}</p>
										{hasGeocodedAddress && (
											<p className="text-[10px] font-mono text-[var(--text-muted)] mt-2">
												Lat: {activeHousehold.latitude?.toFixed(5)} • Lng: {activeHousehold.longitude?.toFixed(5)}
											</p>
										)}
									</div>
								) : (
									<p className="text-xs text-[var(--text-muted)] italic font-sans">
										No address registered. Update household settings.
									</p>
								)}
							</div>

							{isOwnerOrAdmin && (
								<button
									onClick={() => setIsAddressModalOpen(true)}
									className="w-full py-2 bg-[var(--surface-elevated)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50 rounded-lg text-xs font-mono text-[var(--text-main)] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
								>
									<span className="material-symbols-outlined text-sm">edit_location</span>
									{t('household.save_address')}
								</button>
							)}
						</div>

						{/* Map Container widget */}
						<div className="lg:col-span-8 h-60 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] relative overflow-hidden">
							<OSMMapViewer
								center={mapCenter}
								zoom={hasGeocodedAddress ? 15 : 12}
								markers={hasGeocodedAddress ? [{ id: 'household', lat: mapCenter[0], lng: mapCenter[1], popupContent: activeHousehold.name }] : []}
								interactive={false}
							/>
						</div>
					</div>

					{/* QR Code Modal Popup */}
					{activeInvite && (
						<QRCodeModal invite={activeInvite} onClose={() => setActiveInvite(null)} />
					)}

					{/* Members List Section */}
					<div className="col-span-12 lg:col-span-5 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-4">
						<div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
							<h2 className="text-base font-bold text-[var(--text-main)]">{t('household.registry_and_members')}</h2>
							<span className="text-xs font-mono text-[var(--text-muted)] bg-[var(--surface-canvas)] px-2 py-0.5 rounded border border-[var(--border-subtle)]">
								{t('household.enrolled_count', { count: activeHousehold.members?.length || 0 })}
							</span>
						</div>

						<div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
							{activeHousehold.members && activeHousehold.members.length > 0 ? (
								activeHousehold.members.map((member) => (
									<div
										key={member.user_id}
										className="p-3.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-between text-xs hover:border-[var(--border-accent)] transition-colors duration-150"
									>
										<div className="flex items-center gap-3">
											<div className="w-9 h-9 rounded-full bg-[var(--surface-canvas)] border border-[var(--border-subtle)] flex items-center justify-center font-mono font-bold text-[var(--primary-main)] shrink-0 overflow-hidden">
												{member.avatar_url ? (
													// eslint-disable-next-line @next/next/no-img-element
													<img src={member.avatar_url} alt={getMemberDisplayName(member)} className="w-full h-full object-cover" />
												) : (
													getMemberInitials(member)
												)}
											</div>
											<div>
												<div className="font-semibold text-[var(--text-main)]">
													{getMemberDisplayName(member)}
												</div>
												<div className="text-[var(--text-muted)] text-[10px] font-mono leading-normal">
													{member.email ? `${member.email}` : ''}
												</div>
											</div>
										</div>

										<div className="flex items-center gap-2">
											{isOwnerOrAdmin && member.role !== 'OWNER' && member.user_id !== activeHousehold.owner_id ? (
												<div className="flex items-center gap-1.5">
													<select
														value={member.role}
														onChange={(e) => handleRoleChange(member.user_id, member.role, e.target.value)}
														className="bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-[10px] font-mono text-[var(--text-main)] rounded px-1.5 py-0.5 cursor-pointer focus:outline-none"
													>
														<option value="ADMIN">ADMIN</option>
														<option value="MEMBER">MEMBER</option>
														<option value="GUEST">GUEST</option>
													</select>
													<button
														onClick={() => handleRemoveMemberClick(member.user_id, getMemberDisplayName(member))}
														className="text-red-400 hover:text-red-300 font-bold cursor-pointer inline-flex items-center p-0.5 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded hover:border-red-400/40"
													>
														<span className="material-symbols-outlined text-sm">person_remove</span>
													</button>
												</div>
											) : (
												<span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-[var(--surface-canvas)] text-[var(--primary-main)] border border-[var(--border-subtle)]">
													{member.role}
												</span>
											)}
										</div>
									</div>
								))
							) : (
								<div className="p-8 text-center text-xs text-[var(--text-muted)] font-mono bg-[var(--surface-elevated)] border border-dashed border-[var(--border-subtle)] rounded-xl">
									No members enrolled in this household.
								</div>
							)}
						</div>
					</div>

					{/* Contacts Directory Section */}
					<div className="col-span-12 lg:col-span-7 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-4 flex flex-col justify-between">
						<div>
							<div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)] mb-4">
								<div className="flex items-center gap-2">
									<h2 className="text-base font-bold text-[var(--text-main)]">{t('household.contacts')}</h2>
									<button
										onClick={() => setIsMapView(!isMapView)}
										className="px-2 py-0.5 rounded bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[10px] font-mono text-[var(--text-main)] hover:border-[var(--primary-main)]/50 transition-colors flex items-center gap-1 cursor-pointer"
									>
										<span className="material-symbols-outlined text-[12px]">
											{isMapView ? 'list' : 'map'}
										</span>
										<span>{isMapView ? t('household.list_view') : t('household.map_view')}</span>
									</button>
								</div>

								{!isGuest && (
									<div className="flex items-center gap-1.5">
										<button
											onClick={() => openCategoryModal()}
											className="px-2 py-1 rounded bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-[10px] font-mono text-[var(--text-main)] flex items-center gap-1 hover:border-[var(--primary-main)]/40 cursor-pointer"
										>
											<span className="material-symbols-outlined text-xs">folder_open</span>
											{t('household.add_category')}
										</button>
										<button
											onClick={() => openContactModal()}
											className="px-2.5 py-1 rounded bg-[var(--primary-main)] text-slate-950 font-bold text-[10px] flex items-center gap-1 hover:bg-[var(--primary-hover)] cursor-pointer"
										>
											<span className="material-symbols-outlined text-xs">person_add</span>
											{t('household.add_contact')}
										</button>
									</div>
								)}
							</div>

							{isMapView ? (
								/* Contacts Map View */
								<div className="h-[400px] w-full rounded-xl border border-[var(--border-subtle)] overflow-hidden">
									<OSMMapViewer
										center={mapCenter}
										zoom={14}
										markers={contactMarkers}
										interactive={true}
									/>
								</div>
							) : (
								/* Contacts List View grouped by category */
								<div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
									{/* Category Badges Toolbar to manage existing groups */}
									{categories.length > 0 && !isGuest && (
										<div className="flex items-center gap-1.5 flex-wrap pb-2 border-b border-[var(--border-subtle)] mb-2">
											{categories.map((cat) => (
												<div
													key={cat.id}
													className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-medium border cursor-default"
													style={{ borderColor: `${cat.color}40`, backgroundColor: `${cat.color}15`, color: cat.color }}
												>
													<span className="material-symbols-outlined text-[10px]">{cat.icon || 'folder'}</span>
													<span>{cat.name}</span>
													<button
														onClick={() => openCategoryModal(cat)}
														className="hover:opacity-75 cursor-pointer inline-flex items-center"
													>
														<span className="material-symbols-outlined text-[10px]">edit</span>
													</button>
													<button
														onClick={() => handleDeleteCategory(cat.id)}
														className="text-red-400 hover:text-red-300 cursor-pointer inline-flex items-center"
													>
														<span className="material-symbols-outlined text-[10px]">delete</span>
													</button>
												</div>
											))}
										</div>
									)}

									{contacts.length > 0 ? (
										contacts.map((c) => {
											const cat = categories.find((cat) => cat.id === c.category_id);
											return (
												<div
													key={c.id}
													className="p-3.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-accent)] transition-colors duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
												>
													<div className="space-y-1.5">
														<div className="flex items-center gap-2 flex-wrap">
															<span className="font-semibold text-[var(--text-main)] text-sm">{c.name}</span>
															{cat && (
																<span
																	className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase border"
																	style={{ borderColor: `${cat.color}40`, backgroundColor: `${cat.color}10`, color: cat.color }}
																>
																	{cat.name}
																</span>
															)}
														</div>
														<p className="text-[var(--text-muted)] font-sans">{c.description}</p>
														<div className="text-[10px] font-mono text-[var(--text-muted)] flex flex-wrap gap-x-3 gap-y-1">
															{c.phone && <span className="flex items-center gap-0.5"><span className="material-symbols-outlined text-xs">phone</span>{c.phone}</span>}
															{c.email && <span className="flex items-center gap-0.5"><span className="material-symbols-outlined text-xs">mail</span>{c.email}</span>}
															{c.address && <span className="flex items-center gap-0.5"><span className="material-symbols-outlined text-xs">map</span>{c.address}</span>}
														</div>
													</div>

													<div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
														{c.phone && (
															<a
																href={`tel:${c.phone}`}
																className="p-2 rounded bg-[var(--surface-canvas)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50 text-[var(--text-main)] cursor-pointer inline-flex items-center"
															>
																<span className="material-symbols-outlined text-sm">call</span>
															</a>
														)}
														{c.email && (
															<a
																href={`mailto:${c.email}`}
																className="p-2 rounded bg-[var(--surface-canvas)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50 text-[var(--text-main)] cursor-pointer inline-flex items-center"
															>
																<span className="material-symbols-outlined text-sm">mail</span>
															</a>
														)}
														{c.links && c.links.length > 0 && (
															<a
																href={c.links[0]}
																target="_blank"
																rel="noreferrer"
																className="p-2 rounded bg-[var(--surface-canvas)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50 text-[var(--text-main)] cursor-pointer inline-flex items-center"
															>
																<span className="material-symbols-outlined text-sm">open_in_new</span>
															</a>
														)}

														{!isGuest && (
															<div className="flex items-center gap-1 border-l border-[var(--border-subtle)] pl-1.5 ml-1">
																<button
																	onClick={() => openContactModal(c)}
																	className="p-2 rounded hover:bg-[var(--surface-canvas)] text-[var(--text-main)] cursor-pointer inline-flex items-center"
																>
																	<span className="material-symbols-outlined text-sm text-[var(--text-muted)] hover:text-[var(--text-main)]">edit</span>
																</button>
																<button
																	onClick={() => handleDeleteContact(c.id)}
																	className="p-2 rounded hover:bg-[var(--surface-canvas)] text-red-400 hover:text-red-300 cursor-pointer inline-flex items-center"
																>
																	<span className="material-symbols-outlined text-sm">delete</span>
																</button>
															</div>
														)}
													</div>
												</div>
											);
										})
									) : (
										<div className="p-8 text-center text-xs text-[var(--text-muted)] font-mono bg-[var(--surface-elevated)] border border-dashed border-[var(--border-subtle)] rounded-xl">
											{t('household.no_contacts')}
										</div>
									)}
								</div>
							)}
						</div>
					</div>
				</>
			)}

			{/* Geocoding Address Search Modal */}
			{isAddressModalOpen && (
				<div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
					<div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
						<div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
							<h3 className="text-base font-bold text-[var(--text-main)]">{t('household.address_search')}</h3>
							<button onClick={() => setIsAddressModalOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer">
								<span className="material-symbols-outlined">close</span>
							</button>
						</div>

						<div className="space-y-4">
							<AddressAutocomplete
								placeholder={t('household.address_search')}
								onSelect={handleAddressSelect}
							/>
						</div>
					</div>
				</div>
			)}

			{/* Contact Category CRUD Modal */}
			{isCategoryModalOpen && (
				<div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
					<div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
						<div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
							<h3 className="text-base font-bold text-[var(--text-main)]">
								{editingCategory ? t('household.edit_category') : t('household.add_category')}
							</h3>
							<button onClick={() => setIsCategoryModalOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer">
								<span className="material-symbols-outlined">close</span>
							</button>
						</div>

						<form onSubmit={handleCategorySubmit} className="space-y-4">
							<div>
								<label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
									{t('household.name')} *
								</label>
								<input
									type="text"
									value={categoryName}
									onChange={(e) => setCategoryName(e.target.value)}
									placeholder="e.g. Health, Utilities"
									className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
									required
								/>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
										Icon (Material symbol)
									</label>
									<input
										type="text"
										value={categoryIcon}
										onChange={(e) => setCategoryIcon(e.target.value)}
										placeholder="e.g. home, call, local_hospital"
										className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
									/>
								</div>
								<div>
									<label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
										Color Indicator
									</label>
									<div className="flex gap-2 items-center">
										<input
											type="color"
											value={categoryColor}
											onChange={(e) => setCategoryColor(e.target.value)}
											className="w-10 h-8 rounded border border-[var(--border-subtle)] bg-transparent cursor-pointer"
										/>
										<input
											type="text"
											value={categoryColor}
											onChange={(e) => setCategoryColor(e.target.value)}
											className="w-full px-2 py-1.5 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded text-xs font-mono text-[var(--text-main)] focus:outline-none"
										/>
									</div>
								</div>
							</div>

							<div className="flex justify-end gap-2 pt-2">
								<button
									type="button"
									onClick={() => setIsCategoryModalOpen(false)}
									className="px-4 py-2 rounded bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-muted)] cursor-pointer"
								>
									{t('common.cancel')}
								</button>
								<button
									type="submit"
									className="px-4 py-2 rounded bg-[var(--primary-main)] text-slate-950 font-bold text-xs hover:bg-[var(--primary-hover)] cursor-pointer"
								>
									{editingCategory ? t('common.edit') : t('household.create_household')}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* Contact Record CRUD Modal */}
			{isContactModalOpen && (
				<div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
					<div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
						<div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
							<h3 className="text-base font-bold text-[var(--text-main)]">
								{editingContact ? t('household.edit_contact') : t('household.add_contact')}
							</h3>
							<button onClick={() => setIsContactModalOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer">
								<span className="material-symbols-outlined">close</span>
							</button>
						</div>

						<form onSubmit={handleContactSubmit} className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
										{t('household.name')} *
									</label>
									<input
										type="text"
										value={contactName}
										onChange={(e) => setContactName(e.target.value)}
										placeholder="e.g. Leif Kröger"
										className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
										required
									/>
								</div>
								<div>
									<label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
										{t('household.category')}
									</label>
									<select
										value={contactCatId}
										onChange={(e) => setContactCatId(e.target.value)}
										className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)] cursor-pointer"
									>
										<option value="">{t('household.none')}</option>
										{categories.map((c) => (
											<option key={c.id} value={c.id}>
												{c.name}
											</option>
										))}
									</select>
								</div>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
										{t('household.phone')}
									</label>
									<input
										type="tel"
										value={contactPhone}
										onChange={(e) => setContactPhone(e.target.value)}
										placeholder="e.g. +49 123 45678"
										className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
									/>
								</div>
								<div>
									<label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
										{t('household.email')}
									</label>
									<input
										type="email"
										value={contactEmail}
										onChange={(e) => setContactEmail(e.target.value)}
										placeholder="e.g. contact@domain.com"
										className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
									/>
								</div>
							</div>

							<div>
								<label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
									{t('household.address')} (Geocoded lookup)
								</label>
								<AddressAutocomplete
									placeholder="Search address for map plotting..."
									initialValue={contactAddress}
									onSelect={(addr) => {
										setContactAddress(addr.display_name);
										setContactLat(addr.lat);
										setContactLng(addr.lng);
									}}
								/>
								{contactLat && contactLng && (
									<p className="text-[10px] font-mono text-[var(--text-muted)] mt-1.5">
										Geocoded location resolved: {contactLat.toFixed(5)}, {contactLng.toFixed(5)}
									</p>
								)}
							</div>

							<div>
								<label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
									{t('household.description')}
								</label>
								<textarea
									value={contactDesc}
									onChange={(e) => setContactDesc(e.target.value)}
									placeholder="Optional notes..."
									rows={2}
									className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
								/>
							</div>

							<div>
								<label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
									{t('household.links')}
								</label>
								<textarea
									value={contactLinks}
									onChange={(e) => setContactLinks(e.target.value)}
									placeholder="e.g. https://website.com"
									rows={2}
									className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
								/>
							</div>

							<div className="flex justify-end gap-2 pt-2">
								<button
									type="button"
									onClick={() => setIsContactModalOpen(false)}
									className="px-4 py-2 rounded bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-muted)] cursor-pointer"
								>
									{t('common.cancel')}
								</button>
								<button
									type="submit"
									className="px-4 py-2 rounded bg-[var(--primary-main)] text-slate-950 font-bold text-xs hover:bg-[var(--primary-hover)] cursor-pointer"
								>
									{editingContact ? t('common.edit') : t('household.create_household')}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* Consolidated Create Household Modal */}
			{isCreateModalOpen && (
				<div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
					<div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
						<div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
							<h3 className="text-base font-bold text-[var(--text-main)]">{t('household.create_household')}</h3>
							<button onClick={() => setIsCreateModalOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer">
								<span className="material-symbols-outlined">close</span>
							</button>
						</div>

						{createStatus && (
							<div className="p-3 rounded bg-red-950/40 border border-red-800/40 text-red-300 text-xs font-mono">
								{createStatus}
							</div>
						)}

						<form onSubmit={handleCreateHouseholdSubmit} className="space-y-4">
							<div>
								<label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
									{t('household.title')} {t('catalog.app_name')} *
								</label>
								<input
									type="text"
									value={newHouseholdName}
									onChange={(e) => setNewHouseholdName(e.target.value)}
									placeholder="e.g. Residence"
									className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
									required
								/>
							</div>

							<div className="flex justify-end gap-2 pt-2">
								<button
									type="button"
									onClick={() => setIsCreateModalOpen(false)}
									className="px-4 py-2 rounded bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-muted)] cursor-pointer"
								>
									{t('common.cancel')}
								</button>
								<button
									type="submit"
									disabled={createHouseholdMutation.isPending}
									className="px-4 py-2 rounded bg-[var(--primary-main)] text-slate-950 font-bold text-xs hover:bg-[var(--primary-hover)] cursor-pointer disabled:opacity-50"
								>
									{createHouseholdMutation.isPending ? t('common.loading') : t('household.create_household')}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</>
	);
}
