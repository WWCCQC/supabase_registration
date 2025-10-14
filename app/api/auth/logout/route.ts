import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

// Supabase Client (Admin)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'ไม่พบ token การเข้าสู่ระบบ' }, 
        { status: 401 }
      );
    }

    // ตรวจสอบ JWT Token
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
      console.log('❌ Invalid token:', jwtError);
      return NextResponse.json(
        { error: 'Token ไม่ถูกต้อง' }, 
        { status: 401 }
      );
    }

    // บันทึก Activity Log
    const clientIP = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') ||
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    await supabase
      .from('activity_logs')
      .insert({
        user_id: decoded.userId,
        employee_id: decoded.employee_id,
        action: 'LOGOUT',
        details: {
          logout_time: new Date().toISOString(),
          user_agent: userAgent
        },
        ip_address: clientIP,
        user_agent: userAgent,
        session_id: token.substring(0, 16)
      });

    console.log('✅ Logout successful for:', decoded.employee_id);

    // สร้าง Response และลบ Cookie
    const response = NextResponse.json({
      success: true,
      message: 'ออกจากระบบสำเร็จ'
    });

    // ลบ JWT Token Cookie
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: new Date(0) // ตั้งให้หมดอายุทันที
    });

    return response;

  } catch (error) {
    console.error('💥 Logout error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในระบบ' }, 
      { status: 500 }
    );
  }
}