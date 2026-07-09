import math

# Fixed origin: Bambu Apus, Cipayung, Jakarta Timur
ORIGIN_LAT = -6.3214
ORIGIN_LNG = 106.8967

def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0 # Earth radius in kilometers

    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    
    a = math.sin(dLat / 2)**2 + \
        math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLon / 2)**2
        
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c

def calculate_distance(dest_lat: float, dest_lng: float) -> float:
    """Calculate distance from Cipayung origin to destination."""
    return haversine(ORIGIN_LAT, ORIGIN_LNG, dest_lat, dest_lng)

def calculate_total_weight(items) -> float:
    """
    Accumulates volumetric weight based on preset rules:
    250ml = 0.3 kg
    1L (1000ml) = 1.1 kg
    """
    total_weight = 0.0
    for item in items:
        if item.volume_ml == 250:
            weight_per_item = 0.3
        elif item.volume_ml == 1000:
            weight_per_item = 1.1
        else:
            # Fallback for unknown volumes assuming 1ml = 1g + 20% packaging
            weight_per_item = (item.volume_ml * 1.2) / 1000.0
            
        total_weight += (weight_per_item * item.quantity)
        
    return total_weight
