import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// หน้าที่ต้อง login
const PROTECTED_PATHS = [
  '/',        // หน้าแรกต้อง login
  '/dashboard',
  '/chart',
  '/blacklist',
  '/admin',
  '/ww-provider'
];

// หน้าที่ admin เท่านั้น
const ADMIN_ONLY_PATHS = [
  '/admin',
];

// หน้าที่ manager และ admin เข้าได้
const MANAGER_ADMIN_PATHS = [
  '/chart',
  '/blacklist'
];

// หน้าที่ user เข้าได้
const USER_ALLOWED_PATHS = [
  '/',           // หน้าแรก
  '/dashboard'   // หน้าหลัก
];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // ข้าม API routes ที่ user ควรเข้าถึงได้
  if (pathname.startsWith('/api/technicians') || 
      pathname.startsWith('/api/kpis') ||
      pathname.startsWith('/api/img') ||
      pathname.startsWith('/api/db-health') ||
      pathname.startsWith('/api/auth')) {
    console.log('🔍 Middleware: Bypassing API route:', pathname);
    return NextResponse.next();
  }
  
  // เช็คว่าเป็นหน้าที่ต้องป้องกันหรือไม่
  const isProtectedPath = PROTECTED_PATHS.some(path => {
    if (path === '/') {
      return pathname === '/';  // หน้าแรกต้องตรงทุกตัว
    }
    return pathname.startsWith(path);
  });
  
  if (!isProtectedPath) {
    return NextResponse.next();
  }

  // ดึง token จาก cookies
  const token = request.cookies.get('auth-token')?.value;
  
  if (!token) {
    // ไม่มี token - redirect ไป login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    // ตรวจสอบ JWT token ด้วย jose (รองรับ Edge Runtime)
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    const userRole = (payload as any).role;

    // เช็ค role permissions
    if (ADMIN_ONLY_PATHS.some(path => pathname.startsWith(path))) {
      if (userRole !== 'admin') {
        // User/Manager ไม่ได้เข้าหน้า admin - ส่งไปหน้าหลัก
        return NextResponse.redirect(new URL('/', request.url));
      }
    }

    if (MANAGER_ADMIN_PATHS.some(path => pathname.startsWith(path))) {
      if (userRole !== 'admin' && userRole !== 'manager') {
        // User ไม่ได้เข้าหน้า chart - ส่งไปหน้าหลัก
        return NextResponse.redirect(new URL('/', request.url));
      }
    }

    // สร้าง response และเพิ่ม user info ใน headers
  const response = NextResponse.next();
  // ตั้งค่าเฉพาะค่า ASCII-safe เท่านั้น เพื่อหลีกเลี่ยงข้อผิดพลาด ByteString ใน Edge runtime
  if ((payload as any).userId) response.headers.set('x-user-id', String((payload as any).userId));
  if ((payload as any).employee_id) response.headers.set('x-employee-id', String((payload as any).employee_id));
  if ((payload as any).role) response.headers.set('x-user-role', String((payload as any).role));
  // งดใส่ full_name ที่อาจมีอักขระ non-ASCII เช่นภาษาไทย

    return response;

  } catch (error) {
    // เกิดข้อผิดพลาดใน middleware (รวมถึง JWT verify หรือการตั้ง header)
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: new Date(0)
    });
    
    return response;
  }
}

export const config = {
  matcher: [
    // กำหนดเส้นทางที่ต้องการให้ middleware ทำงาน
    '/',
    '/dashboard',
    '/dashboard/:path*',
    '/chart',
    '/chart/:path*',
    '/blacklist',
    '/blacklist/:path*',
    '/admin',
    '/admin/:path*',
    '/test-login',
    '/test-login/:path*'
  ],
}