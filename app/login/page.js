export const runtime = 'nodejs';

import { auth, signIn } from '@/auth';
import { redirect } from 'next/navigation';
import {
    LogIn, Mail, Lock, Users, Network, Settings2, ShieldCheck, Gauge, Globe
} from 'lucide-react';

export default async function LoginPage({ searchParams }) {
    const session = await auth();
    if (session?.user) redirect('/');

    const error = searchParams?.error;

    async function loginWithCredentials(formData) {
        'use server';
        const email = formData.get('email');
        const password = formData.get('password');
        await signIn('credentials', { email, password, redirectTo: '/' });
    }

    async function loginWithGoogle() {
        'use server';
        await signIn('google', { redirectTo: '/' });
    }

    return (
        <main className="min-h-screen grid lg:grid-cols-2 bg-[var(--surface-2)]">
            {/* Form */}
            <section className="flex items-center justify-center p-6">
                <div className="w-full max-w-md">
                    <div className="mb-8 text-center">
                        <h1 className="text-2xl font-semibold text-[var(--text)]">Đăng nhập</h1>
                        <p className="mt-1 text-sm text-[var(--muted)]">Truy cập bảng điều khiển Zalo multi-account</p>
                    </div>

                    {error === 'CredentialsSignin' && (
                        <div className="mb-4 rounded-xl border border-[var(--danger-200)] bg-[var(--danger-50)] p-3 text-sm text-[var(--danger-700)]">
                            Email hoặc mật khẩu không đúng.
                        </div>
                    )}

                    <form action={loginWithCredentials} className="space-y-4 rounded-2xl bg-[var(--surface)] p-6 shadow-sm border border-[var(--border)]">
                        <div className="relative">
                            <label htmlFor="email" className="block text-sm font-medium text-[var(--text)]">Email</label>
                            <Mail className="absolute left-3 top-9 h-4 w-4 text-[var(--muted)]" aria-hidden />
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                className="input mt-1 pl-10"
                                placeholder="you@example.com"
                            />
                        </div>

                        <div className="relative">
                            <label htmlFor="password" className="block text-sm font-medium text-[var(--text)]">Mật khẩu</label>
                            <Lock className="absolute left-3 top-9 h-4 w-4 text-[var(--muted)]" aria-hidden />
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                className="input mt-1 pl-10"
                                placeholder="••••••••"
                            />
                        </div>

                        <button type="submit" className="btn btn-primary w-full gap-2">
                            <LogIn className="h-4 w-4" aria-hidden />
                            Đăng nhập
                        </button>
                    </form>

                    <div className="my-5 flex items-center gap-3">
                        <span className="h-px flex-1 bg-[var(--border)]" />
                        <span className="text-xs text-[var(--muted)]">hoặc</span>
                        <span className="h-px flex-1 bg-[var(--border)]" />
                    </div>

                    <form action={loginWithGoogle}>
                        <button type="submit" className="btn btn-outline w-full gap-2">
                            <Globe className="h-4 w-4" aria-hidden />
                            Đăng nhập với Google
                        </button>
                    </form>

                    <p className="mt-6 text-center text-xs text-[var(--muted)]">
                        Bằng việc tiếp tục, bạn đồng ý với các điều khoản sử dụng.
                    </p>
                </div>
            </section>

            {/* Hero + nội dung tính năng Zalo multi-account */}
            <section className="relative hidden lg:block">
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary-600)] to-[var(--primary-800)]" />
                <div
                    className="absolute inset-0 opacity-20"
                    style={{ backgroundImage: 'radial-gradient(closest-side, rgba(255,255,255,.6), transparent 65%)', backgroundSize: '24px 24px' }}
                />
                <div className="relative h-full w-full flex items-center justify-center p-10">
                    <div className="max-w-xl text-white">
                        <h2 className="text-3xl font-semibold leading-snug">Quản lý nhiều tài khoản Zalo trong một trình duyệt</h2>
                        <p className="mt-3 text-sm text-white/85">
                            Tách phiên an toàn, gán <b>proxy riêng</b> cho từng tài khoản, hạn chế dấu vết trình duyệt và tối ưu hiệu suất gửi/nhận.
                        </p>

                        <ul className="mt-6 space-y-3">
                            <li className="flex items-start gap-3">
                                <Users className="mt-0.5 h-5 w-5 text-white/90" />
                                <div>
                                    <div className="font-medium">Multi-account, multi-session</div>
                                    <p className="text-sm text-white/80">Tạo và chuyển nhanh giữa nhiều Zalo, session tách biệt cookie/localStorage.</p>
                                </div>
                            </li>
                            <li className="flex items-start gap-3">
                                <Network className="mt-0.5 h-5 w-5 text-white/90" />
                                <div>
                                    <div className="font-medium">Proxy riêng cho từng tài khoản</div>
                                    <p className="text-sm text-white/80">HTTP/SOCKS5, có auth; thay đổi IP theo tài khoản để hạn chế liên đới.</p>
                                </div>
                            </li>
                            <li className="flex items-start gap-3">
                                <Settings2 className="mt-0.5 h-5 w-5 text-white/90" />
                                <div>
                                    <div className="font-medium">Tuỳ biến fingerprint</div>
                                    <p className="text-sm text-white/80">Header, UA, timezone, language… thích ứng theo proxy/location.</p>
                                </div>
                            </li>
                            <li className="flex items-start gap-3">
                                <ShieldCheck className="mt-0.5 h-5 w-5 text-white/90" />
                                <div>
                                    <div className="font-medium">Cách ly & bảo mật</div>
                                    <p className="text-sm text-white/80">Mỗi tài khoản là một sandbox đăng nhập, giảm rủi ro khoá chéo.</p>
                                </div>
                            </li>
                            <li className="flex items-start gap-3">
                                <Gauge className="mt-0.5 h-5 w-5 text-white/90" />
                                <div>
                                    <div className="font-medium">Hiệu suất ổn định</div>
                                    <p className="text-sm text-white/80">Bộ nhớ/CPU tối ưu, phù hợp thao tác đồng thời trên nhiều tài khoản.</p>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
            </section>
        </main>
    );
}
