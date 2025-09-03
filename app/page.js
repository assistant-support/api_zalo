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
            setStatus('Đang yêu cầu mã QR...');
            socketRef.current.emit('request_qr_login');
        }
    };

    useEffect(() => {
        const socket = io();
        socketRef.current = socket;

        socket.on('connect', () => setStatus('Đã kết nối.'));

        socket.on('initial_state', (data) => {
            setConversations(data.conversations || {});
            setUserInfo(data.userInfo || {});
        });

        socket.on('login_status', (data) => {
            const wasLoggedIn = isLoggedIn;
            setIsLoggedIn(data.isLoggedIn);

            if (data.isLoggedIn) {
                setStatus('Đã kết nối và đang lắng nghe...');
                setQrCodeUrl(null);
            } else {
                setConversations({});
                setUserInfo({});
                setQrCodeUrl(null);
                if (wasLoggedIn) {
                    setStatus(`Phiên hết hạn: ${data.reason || 'Lỗi không xác định'}. Vui lòng đăng nhập lại.`);
                } else {
                    setStatus('Sẵn sàng để đăng nhập.');
                }
            }
        });

        socket.on('qr_code_generated', (dataUrl) => {
            setQrCodeUrl(dataUrl);
            setStatus('Vui lòng quét mã QR...');
        });

        socket.on('new_message', (data) => {
            const { threadId, message, userInfo: updatedUserInfo } = data;

            setConversations(prev => ({
                ...prev,
                [threadId]: [message, ...(prev[threadId] || [])]
            }));

            if (updatedUserInfo && !userInfo[threadId]) {
                setUserInfo(prev => ({ ...prev, [threadId]: updatedUserInfo }));
            }
        });

        socket.on('login_error', (error) => {
            setStatus(`Lỗi đăng nhập: ${error.message}`);
        });

        return () => socket.disconnect();
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