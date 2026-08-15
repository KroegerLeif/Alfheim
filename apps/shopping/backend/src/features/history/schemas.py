import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ShoppingHistoryRead(BaseModel):
    id: uuid.UUID
    home_id: uuid.UUID
    name: str
    brand: str
    barcode: str | None = None
    unit: str
    purchase_count: int
    icon_tag: str | None = None
    last_purchased_at: datetime
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
