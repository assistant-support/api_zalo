"use server";

import { signIn } from "@/auth";
import { signOut } from '@/auth';
import { AuthError } from "next-auth";

/**
 * Action để xử lý đăng nhập bằng Credentials (Email/Password).
 * Được thiết kế để hoạt động với hook `useFormState`.
 * @param {string | undefined} prevState - Trạng thái trước đó (dùng để chứa thông báo lỗi).
 * @param {FormData} formData - Dữ liệu từ form.
 */
export async function authenticate(prevState, formData) {
    try {
        // Gọi hàm signIn của NextAuth với provider là 'credentials' và dữ liệu form
        await signIn("credentials", formData);
    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
                case 'CredentialsSignin':
                    return 'Email hoặc mật khẩu không chính xác.';
                default:
                    return 'Đã xảy ra lỗi. Vui lòng thử lại.';
            }
        }
        // Lỗi không phải từ AuthError thì re-throw để Next.js xử lý
        throw error;
    }
}

/**
 * Action để xử lý đăng nhập bằng OAuth (Google, GitHub,...).
 * @param {FormData} formData - Dữ liệu từ form, chứa provider.
 */
export async function socialLogin(formData) {
    const provider = formData.get('provider');
    if (provider) {
        await signIn(provider);
    }
}

export async function logoutAction() {
    await signOut({ redirectTo: '/login' });
}