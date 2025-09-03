'use client';

import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import ChatLayout from '@/components/ChatLayout';

export default function ZaloPage() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState(null);
    const [status, setStatus] = useState('Đang kết nối...');
    const [conversations, setConversations] = useState({});
    const [userInfo, setUserInfo] = useState({});

    const socketRef = useRef(null);

    const requestQrLogin = () => {
        if (socketRef.current) {
            // --- LOG: Người dùng yêu cầu đăng nhập ---
            console.log("[CLIENT] ➡️ User action: Emitting 'request_qr_login' to server.");
            setStatus('Đang yêu cầu mã QR...');
            socketRef.current.emit('request_qr_login');
        }
    };

    useEffect(() => {
        // --- LOG: Component bắt đầu chạy ---
        console.log('[CLIENT LIFECYCLE] useEffect triggered. Initializing Socket.IO connection...');
        const socket = io();
        socketRef.current = socket;

        // --- LOG: Sự kiện kết nối thành công ---
        socket.on('connect', () => {
            console.info('[CLIENT SOCKET] ✅ SUCCESS: Connected to WebSocket server with ID:', socket.id);
            setStatus('Đã kết nối.');
        });

        // --- LOG: Nhận trạng thái ban đầu từ server ---
        socket.on('initial_state', (data) => {
            console.log("[CLIENT SOCKET] ⬅️ Received 'initial_state'. Conversations found:", Object.keys(data.conversations || {}).length);
            setConversations(data.conversations || {});
            setUserInfo(data.userInfo || {});
        });

        // --- LOG: Nhận cập nhật trạng thái đăng nhập ---
        socket.on('login_status', (data) => {
            console.log("[CLIENT SOCKET] ⬅️ Received 'login_status':", data);
            const wasLoggedIn = isLoggedIn;
            setIsLoggedIn(data.isLoggedIn);

            if (data.isLoggedIn) {
                console.log('[CLIENT STATE] Updating state: Logged In.');
                setStatus('Đã kết nối và đang lắng nghe...');
                setQrCodeUrl(null);
            } else {
                console.log('[CLIENT STATE] Updating state: Logged Out.');
                setConversations({});
                setUserInfo({});
                setQrCodeUrl(null);
                if (wasLoggedIn) {
                    const reason = `Phiên hết hạn: ${data.reason || 'Lỗi không xác định'}. Vui lòng đăng nhập lại.`;
                    console.warn(`[CLIENT STATE] Session ended. Reason: ${data.reason}`);
                    setStatus(reason);
                } else {
                    setStatus('Sẵn sàng để đăng nhập.');
                }
            }
        });

        // --- LOG: Nhận được mã QR ---
        socket.on('qr_code_generated', (dataUrl) => {
            console.log("[CLIENT SOCKET] ⬅️ Received 'qr_code_generated'. Displaying QR code.");
            setQrCodeUrl(dataUrl);
            setStatus('Vui lòng quét mã QR...');
        });

        // --- LOG: Nhận được tin nhắn mới ---
        socket.on('new_message', (data) => {
            console.log(`[CLIENT SOCKET] ⬅️ Received 'new_message' for thread: ${data.threadId}`, data.message);
            const { threadId, message, userInfo: updatedUserInfo } = data;

            setConversations(prev => ({
                ...prev,
                [threadId]: [message, ...(prev[threadId] || [])]
            }));

            if (updatedUserInfo && !userInfo[threadId]) {
                setUserInfo(prev => ({ ...prev, [threadId]: updatedUserInfo }));
            }
        });

        // --- LOG: Nhận được thông báo lỗi ---
        socket.on('login_error', (error) => {
            console.error("[CLIENT SOCKET] ⬅️ Received 'login_error':", error);
            setStatus(`Lỗi đăng nhập: ${error.message}`);
        });

        // --- LOG: Mất kết nối ---
        socket.on('disconnect', () => {
            console.warn('[CLIENT SOCKET] ❌ Disconnected from WebSocket server.');
            setStatus('Mất kết nối. Đang thử kết nối lại...');
        });

        // Dọn dẹp khi component bị hủy
        return () => {
            console.log('[CLIENT LIFECYCLE] Component unmounting. Disconnecting socket.');
            socket.disconnect();
        };
    }, [isLoggedIn]); // Thêm isLoggedIn để `wasLoggedIn` luôn được cập nhật chính xác

    if (!isLoggedIn) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', textAlign: 'center' }}>
                <h1>Đăng nhập Zalo</h1>
                <p style={{ minHeight: '24px' }}>{status}</p>
                {qrCodeUrl ? (
                    <img src={qrCodeUrl} alt="QR Code" style={{ width: 250, height: 250, border: '1px solid #ccc' }} />
                ) : (
                    <button onClick={requestQrLogin} style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}>Đăng nhập bằng mã QR</button>
                )}
            </div>
        );
    }

    return (
        <ChatLayout
            socket={socketRef.current}
            conversations={conversations}
            setConversations={setConversations}
            userInfo={userInfo}
        />
    );
}