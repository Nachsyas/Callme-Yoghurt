import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate request data (Zero-Trust Architecture)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid Payload' }, { status: 400 });
    }

    // Prepare internal payload for ERP (Laravel/FastAPI)
    // Injecting server-side secret key to bypass external firewall logic
    const internalPayload = {
      ...body,
      _bff_secret_key: process.env.INTERNAL_BFF_SECRET || 'fallback-secret-for-dev',
      timestamp: new Date().toISOString()
    };

    // Forward to internal backend API (e.g. Laravel endpoint)
    // const backendRes = await fetch('http://backend-core:8000/api/internal/orders', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(internalPayload)
    // });
    
    // const data = await backendRes.json();
    
    // Simulating successful connection to ERP
    return NextResponse.json({ 
      success: true, 
      message: 'Order routed to ERP successfully',
      data: internalPayload
    }, { status: 200 });
    
  } catch (error) {
    console.error("BFF Error:", error);
    return NextResponse.json({ error: 'BFF Gateway Error' }, { status: 500 });
  }
}
