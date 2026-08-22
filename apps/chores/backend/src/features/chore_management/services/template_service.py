import uuid
from collections.abc import Sequence

from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.features.chore_management.exceptions import (
    ChoreTemplateNotFoundError,
    DuplicateChoreTemplateError,
)
from src.features.chore_management.models import ChoreTemplate
from src.features.chore_management.schemas import (
    ChoreTemplateCreate,
    ChoreTemplateUpdate,
)


class TemplateService:
    """Service class encapsulating chore template CRUD operations."""

    @staticmethod
    async def create_chore_template(
        session: AsyncSession,
        payload: ChoreTemplateCreate,
        home_id: uuid.UUID,
    ) -> ChoreTemplate:
        """Create a new chore template blueprint in the household context."""
        clash_stmt = select(ChoreTemplate).where(
            ChoreTemplate.home_id == home_id,
            ChoreTemplate.name == payload.name,
        )
        clash_res = await session.exec(clash_stmt)
        if clash_res.first():
            raise DuplicateChoreTemplateError(
                f"Chore template with name '{payload.name}' already exists in this household."
            )

        template = ChoreTemplate(
            home_id=home_id,
            name=payload.name,
            description=payload.description,
            points=payload.points,
            is_non_cumulative=payload.is_non_cumulative,
        )
        session.add(template)
        try:
            await session.commit()
            await session.refresh(template)
        except IntegrityError as e:
            await session.rollback()
            raise DuplicateChoreTemplateError(f"Chore template name conflict: {e}") from e
        return template

    @staticmethod
    async def get_chore_template(
        session: AsyncSession,
        template_id: uuid.UUID,
        home_id: uuid.UUID,
    ) -> ChoreTemplate | None:
        """Retrieve a specific chore template if it belongs to the active household."""
        stmt = select(ChoreTemplate).where(
            ChoreTemplate.id == template_id,
            ChoreTemplate.home_id == home_id,
        )
        res = await session.exec(stmt)
        return res.first()

    @staticmethod
    async def list_chore_templates(
        session: AsyncSession,
        home_id: uuid.UUID,
        limit: int = 100,
        offset: int = 0,
    ) -> Sequence[ChoreTemplate]:
        """List all chore templates registered in the household."""
        stmt = select(ChoreTemplate).where(ChoreTemplate.home_id == home_id).offset(offset).limit(limit)
        res = await session.exec(stmt)
        return res.all()

    @staticmethod
    async def update_chore_template(
        session: AsyncSession,
        template_id: uuid.UUID,
        payload: ChoreTemplateUpdate,
        home_id: uuid.UUID,
    ) -> ChoreTemplate:
        """Partially update a chore template."""
        template = await TemplateService.get_chore_template(session, template_id, home_id)
        if not template:
            raise ChoreTemplateNotFoundError(f"Chore template with ID {template_id} not found.")

        update_data = payload.model_dump(exclude_unset=True)

        if "name" in update_data and update_data["name"] != template.name:
            clash_stmt = select(ChoreTemplate).where(
                ChoreTemplate.home_id == home_id,
                ChoreTemplate.name == update_data["name"],
                ChoreTemplate.id != template_id,
            )
            clash_res = await session.exec(clash_stmt)
            if clash_res.first():
                raise DuplicateChoreTemplateError(f"Chore template with name '{update_data['name']}' already exists.")

        for key, val in update_data.items():
            setattr(template, key, val)

        session.add(template)
        try:
            await session.commit()
            await session.refresh(template)
        except IntegrityError as e:
            await session.rollback()
            raise DuplicateChoreTemplateError(f"Chore template name conflict: {e}") from e
        return template

    @staticmethod
    async def delete_chore_template(
        session: AsyncSession,
        template_id: uuid.UUID,
        home_id: uuid.UUID,
    ) -> bool:
        """Delete a chore template."""
        template = await TemplateService.get_chore_template(session, template_id, home_id)
        if not template:
            raise ChoreTemplateNotFoundError(f"Chore template with ID {template_id} not found.")

        await session.delete(template)
        await session.commit()
        return True
