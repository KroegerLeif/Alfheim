import uuid

from src.core.database import async_session_factory
from src.features.categories.models import CategoryCreate, CategoryUpdate
from src.features.categories.service import CategoryService
from src.mcp.server import mcp


@mcp.tool()
async def list_categories(
    household_id: str,
    name: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> str:
    """Retrieve all categories (global and custom) visible to the household.

    Parameters:
    - household_id: UUID string of the household space.
    - name: Optional exact name to filter categories.
    - limit: Maximum number of categories to return (default 100).
    - offset: Number of records to skip (default 0).
    """
    try:
        home_uuid = uuid.UUID(household_id)
        async with async_session_factory() as session:
            categories = await CategoryService.list_categories(
                session=session,
                home_id=home_uuid,
                name=name,
                limit=limit,
                offset=offset,
            )

            if not categories:
                return "No product categories found."

            lines = []
            for cat in categories:
                global_tag = " [Global]" if cat.is_global else ""
                desc = f" ({cat.description})" if cat.description else ""
                lines.append(f"- {cat.name} (ID: {cat.id}){global_tag}{desc}")
            return "\n".join(lines)

    except Exception as e:
        return f"Error: Failed to list categories: {str(e)}"


@mcp.tool()
async def get_category(household_id: str, category_id: str) -> str:
    """Retrieve details of a specific category by ID.

    Parameters:
    - household_id: UUID string of the household space.
    - category_id: UUID string of the product category.
    """
    try:
        home_uuid = uuid.UUID(household_id)
        cat_uuid = uuid.UUID(category_id)
        async with async_session_factory() as session:
            cat = await CategoryService.get_category(
                session=session,
                category_id=cat_uuid,
                home_id=home_uuid,
            )

            if not cat:
                return f"Category with ID {category_id} not found or not authorized."

            global_tag = " [Global]" if cat.is_global else ""
            desc = f"\nDescription: {cat.description}" if cat.description else ""
            return (
                f"Category: {cat.name}{global_tag}\n"
                f"ID: {cat.id}{desc}\n"
                f"Created: {cat.created_at} | Updated: {cat.updated_at}"
            )

    except ValueError as e:
        return f"Error: Invalid ID format: {str(e)}"
    except Exception as e:
        return f"Error: Failed to retrieve category: {str(e)}"


@mcp.tool()
async def create_category(
    household_id: str,
    user_id: str,
    name: str,
    description: str | None = None,
) -> str:
    """Create a new custom category inside the household space.

    Parameters:
    - household_id: UUID string of the household space.
    - user_id: UUID string of the creating user.
    - name: Unique name of the custom category.
    - description: Optional text details describing the category.
    """
    try:
        home_uuid = uuid.UUID(household_id)
        user_uuid = uuid.UUID(user_id)
        payload = CategoryCreate(name=name, description=description)
        async with async_session_factory() as session:
            cat = await CategoryService.create_category(
                session=session,
                payload=payload,
                owner_id=user_uuid,
                home_id=home_uuid,
            )
            return f"Success: Created category '{cat.name}' with ID {cat.id}."

    except ValueError as e:
        return f"Error: Failed to create category: {str(e)}"
    except Exception as e:
        return f"Error: An unexpected database error occurred: {str(e)}"


@mcp.tool()
async def update_category(
    household_id: str,
    category_id: str,
    name: str | None = None,
    description: str | None = None,
) -> str:
    """Update details of an existing custom category (Global categories cannot be updated).

    Parameters:
    - household_id: UUID string of the household space.
    - category_id: UUID string of the custom category to update.
    - name: Optional new name of the category.
    - description: Optional new description details.
    """
    try:
        home_uuid = uuid.UUID(household_id)
        cat_uuid = uuid.UUID(category_id)
        payload = CategoryUpdate(name=name, description=description)

        async with async_session_factory() as session:
            cat = await CategoryService.update_category(
                session=session,
                category_id=cat_uuid,
                home_id=home_uuid,
                payload=payload,
            )

            if not cat:
                return f"Category with ID {category_id} not found or not authorized."

            return f"Success: Updated category {cat.id} (Name: '{cat.name}')."

    except ValueError as e:
        return f"Error: Update failed: {str(e)}"
    except Exception as e:
        return f"Error: An unexpected database error occurred: {str(e)}"


@mcp.tool()
async def delete_category(household_id: str, category_id: str) -> str:
    """Delete a custom category from the household space.

    Parameters:
    - household_id: UUID string of the household space.
    - category_id: UUID string of the custom category to delete.
    """
    try:
        home_uuid = uuid.UUID(household_id)
        cat_uuid = uuid.UUID(category_id)
        async with async_session_factory() as session:
            success = await CategoryService.delete_category(
                session=session,
                category_id=cat_uuid,
                home_id=home_uuid,
            )

            if not success:
                return f"Category with ID {category_id} not found or not authorized."

            return f"Success: Deleted category {category_id}."

    except ValueError as e:
        return f"Error: Deletion failed: {str(e)}"
    except Exception as e:
        return f"Error: An unexpected database error occurred: {str(e)}"
