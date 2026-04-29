export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

export async function GET() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ 
        authenticated: false, 
        user: null 
      });
    }

    // ตรวจสอบ JWT Token
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      return NextResponse.json({
        authenticated: true,
        user: {
          id: decoded.userId,
          employee_id: decoded.employee_id,
          full_name: decoded.full_name,
          role: decoded.role
        }
      });

    } catch (jwtError) {
      console.log('❌ Invalid token in me route:', jwtError);
      
      // Token ไม่ถูกต้อง - ลบ cookie
      const response = NextResponse.json({ 
        authenticated: false, 
        user: null 
      });

      response.cookies.set('auth-token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: new Date(0)
      });

      return response;
    }

  } catch (error) {
    console.error('💥 Me route error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในระบบ' }, 
      { status: 500 }
    );
  }
}