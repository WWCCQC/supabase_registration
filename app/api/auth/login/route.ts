export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

// Supabase Client (Admin)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables. Please check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
}

const supabase = createClient(
  supabaseUrl,
  supabaseKey,
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
    const body = await request.json();
    const { employee_id, password } = body;

    if (!employee_id || !password) {
      return NextResponse.json(
        { error: 'กรุณาใส่รหัสพนักงานและรหัสผ่าน' }, 
        { status: 400 }
      );
    }

    console.log('🔐 Login attempt for employee_id:', employee_id);

    // ค้นหาผู้ใช้จากฐานข้อมูล (ไม่ต้องใช้ bcrypt เพราะเป็น plain text)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('employee_id', employee_id)
      .eq('is_active', true)
      .single();

    if (userError || !user) {
      console.log('❌ User not found:', userError?.message);
      return NextResponse.json(
        { error: 'รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง' }, 
        { status: 401 }
      );
    }

    // เปรียบเทียบรหัสผ่าน (plain text)
    if (user.password !== password) {
      console.log('❌ Password mismatch for user:', employee_id);
      return NextResponse.json(
        { error: 'รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง' }, 
        { status: 401 }
      );
    }

    // อัปเดต last_login
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    // สร้าง JWT Token
    const token = jwt.sign(
      { 
        userId: user.id,
        employee_id: user.employee_id,
        role: user.role,
        full_name: user.full_name
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // บันทึก Activity Log
    const clientIP = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') ||
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    await supabase
      .from('activity_logs')
      .insert({
        user_id: user.id,
        employee_id: user.employee_id,
        action: 'LOGIN',
        details: {
          login_time: new Date().toISOString(),
          user_agent: userAgent
        },
        ip_address: clientIP,
        user_agent: userAgent,
        session_id: token.substring(0, 16) // ใช้ส่วนของ token เป็น session_id
      });

    console.log('✅ Login successful for:', user.employee_id);

    // สร้าง Response และตั้ง Cookie
    const response = NextResponse.json({
      success: true,
      message: 'เข้าสู่ระบบสำเร็จ',
      user: {
        id: user.id,
        employee_id: user.employee_id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        last_login: user.last_login
      }
    });

    // ตั้ง JWT Token เป็น Cookie (Session Cookie - จะหายเมื่อปิด browser)
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
      // ไม่ใส่ maxAge หรือ expires จะทำให้เป็น session cookie
    });

    return response;

  } catch (error) {
    console.error('💥 Login error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในระบบ' }, 
      { status: 500 }
    );
  }
}