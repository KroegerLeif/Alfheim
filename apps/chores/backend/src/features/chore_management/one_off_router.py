"""``POST /api/v1/chores/instances``: create one chore instance from a template now (#959).

Household members with a write role may call it, and so may a household-bound service principal
whose binding grants ``chores:create_instance`` (#958), which is how Home Assistant events create
chores. The template must belong to the confirmed household.
"""

import re

from backend_shared.household import (
    CODE_HOUSEHOLD_SERVICE_UNAVAILABLE,
    HouseholdContext,
    MemberDirectory,
    MembershipServiceError,
    get_member_directory,
    require_household_access,
)
from backend_shared.household.permissions import WRITE_ROLES
from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.database import get_db_session
from src.features.chore_management.exceptions import (
    AssigneeNotAssignableError,
    AssigneeNotMemberError,
    AssignmentForbiddenError,
    ChoreTemplateNotFoundError,
    IdempotencyKeyConflictError,
)
from src.features.chore_management.schemas import ChoreInstanceRead, ChoreOneOffCreate
from src.features.chore_management.services.one_off_service import OneOffInstanceService

#: Scope a service principal's binding needs to create chore instances.
CREATE_INSTANCE_SCOPE = "chores:create_instance"

# Printable ASCII without spaces, as sent by webhook senders and HTTP clients.
_IDEMPOTENCY_KEY = re.compile(r"^[\x21-\x7e]{1,200}$")

router = APIRouter(tags=["chores"])

require_instance_creator = require_household_access(roles=WRITE_ROLES, allow_service_scopes=[CREATE_INSTANCE_SCOPE])


@router.post(
    "/instances",
    response_model=ChoreInstanceRead,
    status_code=status.HTTP_201_CREATED,
    responses={200: {"model": ChoreInstanceRead, "description": "Repeat of an earlier Idempotency-Key."}},
)
async def create_one_off_instance(
    payload: ChoreOneOffCreate,
    response: Response,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    session: AsyncSession = Depends(get_db_session),
    context: HouseholdContext = Depends(require_instance_creator),
    members: MemberDirectory = Depends(get_member_directory),
):
    """Create a pending chore instance from a template without changing its schedule.

    Answers 201 with the new instance, or 200 with the stored one when the household already used
    the ``Idempotency-Key``. 404 when the template is not the household's, 409 when the key was
    used for another template, 400 for a malformed key.
    """
    if idempotency_key is not None and not _IDEMPOTENCY_KEY.match(idempotency_key):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Idempotency-Key must be 1-200 printable ASCII characters without spaces.",
        )
    try:
        await OneOffInstanceService.check_assignee(members, context, payload.assignee_id)
        instance, created = await OneOffInstanceService.create_instance(
            session=session,
            home_id=context.household_id,
            template_id=payload.template_id,
            due_date=payload.due_at,
            assignee_id=payload.assignee_id,
            idempotency_key=idempotency_key,
        )
    except MembershipServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": CODE_HOUSEHOLD_SERVICE_UNAVAILABLE, "message": "Household members cannot be checked."},
        ) from e
    except AssignmentForbiddenError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e)) from e
    except (ChoreTemplateNotFoundError, AssigneeNotMemberError) as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    except AssigneeNotAssignableError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(e)) from e
    except IdempotencyKeyConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e)) from e
    if not created:
        response.status_code = status.HTTP_200_OK
    return instance
