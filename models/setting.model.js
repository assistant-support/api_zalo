
import mongoose, { Schema } from 'mongoose';

/**
 * @typedef {object} AuthProviderSettings
 * @property {boolean} enabled - Bật/tắt nhà cung cấp này.
 * // Các trường clientId và clientSecret nên được lưu trong .env để bảo mật tối đa.
 * // Model này chỉ quản lý việc bật/tắt.
 */

/**
 * Schema Settings lưu trữ các cấu hình toàn cục cho ứng dụng.
 * Đây là một "singleton model", tức là collection này sẽ chỉ có một document duy nhất.
 * Nó cho phép admin quản lý các tính năng cốt lõi như phương thức đăng nhập,
 * cho phép đăng ký, và vai trò mặc định cho người dùng mới mà không cần sửa code.
 */
const SettingsSchema = new Schema({
    // --- Cài đặt Xác thực & Đăng nhập ---
    auth: {
        // Quản lý các nhà cung cấp đăng nhập (OAuth Providers)
        providers: {
            credentials: { enabled: { type: Boolean, default: true } }, // Bật/tắt đăng nhập bằng Email/Password.
            github: { enabled: { type: Boolean, default: false } },      // Bật/tắt đăng nhập bằng GitHub.
            google: { enabled: { type: Boolean, default: false } },      // Bật/tắt đăng nhập bằng Google.
        },

        // Cho phép người dùng tự đăng ký tài khoản từ bên ngoài
        allowPublicRegistration: { type: Boolean, default: true },

        // Vai trò mặc định sẽ được gán cho tài khoản mới khi đăng ký
        defaultRoles: [{ type: Schema.Types.ObjectId, ref: 'role' }],
    },

    // --- Các cài đặt khác cho dự án ---
    siteName: { type: String, default: 'My Awesome Project' },
    siteUrl: { type: String },
}, { timestamps: true });

const Settings = mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);

export default Settings;