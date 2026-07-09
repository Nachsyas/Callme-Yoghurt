from pydantic import BaseModel, Field
from typing import List

class Coordinates(BaseModel):
    lat: float = Field(..., description="Latitude of destination")
    lng: float = Field(..., description="Longitude of destination")

class OrderItem(BaseModel):
    product_id: str = Field(..., min_length=1)
    # 250ml or 1000ml (1L)
    volume_ml: int = Field(..., description="Volume in ml (e.g. 250 or 1000)")
    quantity: int = Field(..., gt=0)

class ShippingRequest(BaseModel):
    destination: Coordinates
    items: List[OrderItem] = Field(..., min_length=1)

class ShippingResponse(BaseModel):
    distance_km: float
    total_weight_kg: float
    estimated_cost: float
    status: str
