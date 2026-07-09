from fastapi import FastAPI, HTTPException
from schemas import ShippingRequest, ShippingResponse
from services.logistics import calculate_distance, calculate_total_weight
import asyncio

app = FastAPI(title="Callme Yoghurt Logistics Microservice")

@app.post("/api/v1/calculate-shipping", response_model=ShippingResponse)
async def calculate_shipping(request: ShippingRequest):
    try:
        # Simulate circuit breaker or async heavy processing
        await asyncio.sleep(0.01)
        
        # Calculate distance
        distance_km = calculate_distance(request.destination.lat, request.destination.lng)
        
        # Calculate total weight
        total_weight_kg = calculate_total_weight(request.items)
        
        # Basic cost logic based on distance and weight (example simulation)
        # Rp 10,000 flat + Rp 5,000 per kg + Rp 2,000 per km
        estimated_cost = 10000 + (total_weight_kg * 5000) + (distance_km * 2000)
        
        return ShippingResponse(
            distance_km=round(distance_km, 2),
            total_weight_kg=round(total_weight_kg, 2),
            estimated_cost=round(estimated_cost, 2),
            status="SUCCESS"
        )
    except Exception as e:
        # Fallback payload (Circuit Breaker simulation)
        return ShippingResponse(
            distance_km=0.0,
            total_weight_kg=0.0,
            estimated_cost=0.0,
            status="FALLBACK_ERROR: " + str(e)
        )
