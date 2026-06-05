import uuid

MOCK_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
MOCK_HOME_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")


class UserHomeContext:
    """Carries mocked authentication and authorization context for the current request.

    In the future, this will be populated from a JWT token or session auth.
    """
    def __init__(self, user_id: uuid.UUID, home_id: uuid.UUID):
        self.user_id = user_id
        self.home_id = home_id


async def get_current_user_and_home() -> UserHomeContext:
    """Dependency injector providing the mocked current user and home context.

    Returns:
        UserHomeContext: Containing stubbed IDs for the current user and home space.
    """
    return UserHomeContext(user_id=MOCK_USER_ID, home_id=MOCK_HOME_ID)

