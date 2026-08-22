import logging
import os
import uuid
from collections.abc import Sequence

import httpx
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.exceptions import (
    ShoppingListNotFoundError,
    ShoppingListProtectedError,
)
from src.features.shopping_lists.models import ShoppingList
from src.features.shopping_lists.schemas import (
    ShoppingListCreate,
)

logger = logging.getLogger(__name__)


class ListManagementService:
    """Service class encapsulating auto-provisioning and CRUD operations for Shopping Lists."""

    @staticmethod
    def personal_list_name(username: str | None, user_id: uuid.UUID) -> str:
        """Build a deterministic Personal List display name.

        Falls back to a UUID-derived short name when the username claim is absent or non-string.
        The suffix ' - Liste' corresponds to the i18n key shopping.personalListSuffix.
        """
        label = username.strip() if isinstance(username, str) and username.strip() else str(user_id)[:8]
        if label.startswith("NAVIGATION.") or "NAVIGATION" in label.upper():
            label = "Personal"
        return f"{label} - Liste"

    @staticmethod
    async def ensure_personal_list(
        session: AsyncSession,
        home_id: uuid.UUID,
        owner_id: uuid.UUID,
        username: str | None,
    ) -> ShoppingList:
        """Return the caller's Personal List, creating it if it does not yet exist.

        The lookup is scoped to owner_id only — the Personal List deliberately
        ignores home_id so it follows the user across households.
        """
        stmt = select(ShoppingList).where(
            ShoppingList.owner_id == owner_id,
            ShoppingList.is_personal == True,  # noqa: E712
        )
        result = await session.exec(stmt)
        personal = result.first()

        if not personal:
            personal = ShoppingList(
                name=ListManagementService.personal_list_name(username, owner_id),
                home_id=home_id,
                owner_id=owner_id,
                is_personal=True,
                is_default=False,
            )
            session.add(personal)
            await session.commit()
            await session.refresh(personal)
        else:
            if personal.name.startswith("NAVIGATION.") or "NAVIGATION" in personal.name.upper():
                personal.name = ListManagementService.personal_list_name(username, owner_id)
                session.add(personal)
                await session.commit()
                await session.refresh(personal)

        if personal.items is None:
            personal.items = []

        return personal

    @staticmethod
    async def ensure_household_list(
        session: AsyncSession,
        home_id: uuid.UUID,
        owner_id: uuid.UUID,
    ) -> ShoppingList:
        """Return the shared Household List for a home_id, creating it if absent."""
        stmt = select(ShoppingList).where(
            ShoppingList.home_id == home_id,
            ShoppingList.is_default == True,  # noqa: E712
        )
        result = await session.exec(stmt)
        household = result.first()

        if not household:
            # Fallback check for existing list named "Haushalt"
            fallback_stmt = select(ShoppingList).where(
                ShoppingList.home_id == home_id,
                ShoppingList.name == "Haushalt",
            )
            fallback_res = await session.exec(fallback_stmt)
            legacy_household = fallback_res.first()
            if legacy_household:
                legacy_household.is_default = True
                legacy_household.is_personal = False
                session.add(legacy_household)
                await session.commit()
                await session.refresh(legacy_household)
                if legacy_household.items is None:
                    legacy_household.items = []
                return legacy_household

            household = ShoppingList(
                name="Haushalt",
                home_id=home_id,
                owner_id=owner_id,
                is_default=True,
                is_personal=False,
            )
            session.add(household)
            await session.commit()
            await session.refresh(household)

        if household.name.startswith("NAVIGATION.") or "NAVIGATION" in household.name.upper():
            household.name = "Haushalt"
            session.add(household)
            await session.commit()
            await session.refresh(household)

        if household.items is None:
            household.items = []

        return household

    @staticmethod
    async def create_list(
        session: AsyncSession,
        payload: ShoppingListCreate,
        home_id: uuid.UUID,
        owner_id: uuid.UUID,
    ) -> ShoppingList:
        """Create a new user-defined shopping list scoped to a home space."""
        name = payload.name.strip()
        if name.upper().startswith("NAVIGATION") or "NAVIGATION" in name.upper():
            name = "Custom List"

        db_list = ShoppingList(
            name=name,
            home_id=home_id,
            owner_id=owner_id,
            is_default=False,
            is_personal=False,
        )
        session.add(db_list)
        await session.commit()
        await session.refresh(db_list)
        if db_list.items is None:
            db_list.items = []
        return db_list

    @staticmethod
    async def get_lists(
        session: AsyncSession,
        home_id: uuid.UUID,
        owner_id: uuid.UUID | None = None,
        username: str | None = None,
        token: str | None = None,
    ) -> Sequence[ShoppingList]:
        """Retrieve all shopping lists visible to the caller.

        Returns in a guaranteed stable order:
          - Personal List  (caller's private list — always first)
          - Household Lists (one per enrolled household)
          - Custom Lists (additional user-created lists for these households)
        """
        effective_owner = owner_id or uuid.UUID("00000000-0000-0000-0000-000000000001")

        # 1. Fetch user's enrolled households from dashboard backend
        households = []
        if token:
            dashboard_url = os.getenv("DASHBOARD_BACKEND_URL", "http://dashboard-backend:8080")
            async with httpx.AsyncClient() as client:
                try:
                    response = await client.get(
                        f"{dashboard_url}/api/v1/households/me", headers={"Authorization": token}, timeout=5.0
                    )
                    if response.status_code == 200:
                        households = response.json()
                except Exception as e:
                    logger.error(f"Failed to fetch user households in get_lists: {e}")

        # If we couldn't fetch households or it's empty, fall back to the active home_id
        if not households:
            households = [{"id": str(home_id), "name": "Haushalt"}]

        # 2. Ensure default lists exist for all enrolled households
        household_lists = []
        hh_ids = []
        for hh in households:
            try:
                hh_id = uuid.UUID(hh["id"])
                hh_ids.append(hh_id)
                hh_list = await ListManagementService.ensure_household_list(session, hh_id, effective_owner)
                household_lists.append(hh_list)
            except Exception as e:
                logger.error(f"Error ensuring household list: {e}")

        # 3. Ensure personal list exists
        personal = await ListManagementService.ensure_personal_list(session, home_id, effective_owner, username)

        # 4. Fetch remaining user-created lists for all enrolled households ordered by position
        stmt = (
            select(ShoppingList)
            .where(
                col(ShoppingList.home_id).in_(hh_ids),
                ShoppingList.is_default == False,  # noqa: E712
                col(ShoppingList.is_personal) == False,  # noqa: E712
            )
            .order_by(col(ShoppingList.position).asc(), col(ShoppingList.created_at).asc())
        )
        result = await session.exec(stmt)
        custom_lists = list(result.all())

        all_lists = [personal, *household_lists, *custom_lists]
        for lst in all_lists:
            if lst.items is None:
                lst.items = []

        return all_lists

    @staticmethod
    async def get_list(
        session: AsyncSession,
        list_id: uuid.UUID,
        home_id: uuid.UUID,
    ) -> ShoppingList:
        """Retrieve a specific shopping list with boundary checks.

        Personal Lists are accessible from any household context — the home_id
        constraint is relaxed for is_personal=True lists.
        """
        stmt = select(ShoppingList).where(ShoppingList.id == list_id)
        result = await session.exec(stmt)
        db_list = result.first()

        if not db_list:
            raise ShoppingListNotFoundError(f"Shopping list with ID '{list_id}' not found.")

        # Allow access if the list belongs to this household, OR if it is the caller's personal list
        if db_list.home_id != home_id and not db_list.is_personal:
            raise ShoppingListNotFoundError(f"Shopping list with ID '{list_id}' not found.")

        return db_list

    @staticmethod
    async def delete_list(
        session: AsyncSession,
        list_id: uuid.UUID,
        home_id: uuid.UUID,
    ) -> bool:
        """Delete a user-created shopping list.

        Protected lists (is_default=True or is_personal=True) cannot be deleted.
        Raises ShoppingListProtectedError (→ HTTP 400 via global handler) on violation.
        """
        db_list = await ListManagementService.get_list(session, list_id, home_id)

        if db_list.is_default:
            raise ShoppingListProtectedError("The Household List is protected and cannot be deleted.")
        if db_list.is_personal:
            raise ShoppingListProtectedError("The Personal List is protected and cannot be deleted.")

        await session.delete(db_list)
        await session.commit()
        return True

    @staticmethod
    async def reorder_lists(
        session: AsyncSession,
        list_ids: list[uuid.UUID],
        home_id: uuid.UUID,
    ) -> bool:
        """Update the position index of multiple user-defined shopping lists."""
        for index, list_id in enumerate(list_ids):
            stmt = select(ShoppingList).where(
                ShoppingList.id == list_id,
                ShoppingList.home_id == home_id,
                ShoppingList.is_default == False,  # noqa: E712
                col(ShoppingList.is_personal) == False,  # noqa: E712
            )
            res = await session.exec(stmt)
            db_list = res.first()
            if db_list:
                db_list.position = index
                session.add(db_list)
        await session.commit()
        return True
