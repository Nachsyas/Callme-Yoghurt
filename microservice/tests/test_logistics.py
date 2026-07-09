import pytest
from services.logistics import calculate_distance, calculate_total_weight
from schemas import OrderItem, ShippingRequest, Coordinates
from pydantic import ValidationError
import time

def test_distance_calculation():
    # Test distance from Cipayung to Monas (-6.1754, 106.8272)
    distance = calculate_distance(-6.1754, 106.8272)
    assert distance > 0
    assert 10 < distance < 30 # roughly 15-20km

def test_weight_calculation():
    items = [
        OrderItem(product_id="y-250", volume_ml=250, quantity=2), # 0.6 kg
        OrderItem(product_id="y-1000", volume_ml=1000, quantity=1) # 1.1 kg
    ]
    total = calculate_total_weight(items)
    assert total == 1.7

def test_strict_typing_validation_error():
    with pytest.raises(ValidationError):
        # Invalid payload (missing lat/lng)
        ShippingRequest(
            destination={"lat": "invalid"},
            items=[]
        )

@pytest.mark.asyncio
async def test_performance_latency():
    start_time = time.time()
    # Execute heavy synchronous simulation
    calculate_distance(-6.1754, 106.8272)
    
    items = [OrderItem(product_id="y-250", volume_ml=250, quantity=100)]
    calculate_total_weight(items)
    
    end_time = time.time()
    duration_ms = (end_time - start_time) * 1000
    
    # Assert latency under 200ms
    assert duration_ms < 200
