'use client';

import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import MessageList from '@/components/MessageList';

export default function ZaloPage() {
    const [status, setStatus] = useState('Đang kết nối đến server...');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState(null);
    const [messages, setMessages] = useState([]);

    const socketRef = useRef(null);

    // Hàm yêu cầu QR, tách ra để có thể gọi lại
    const requestQrLogin = () => {
        if (socketRef.current) {
            setStatus('Đang yêu cầu mã QR, vui lòng chờ...');
            socketRef.current.emit('request_qr_login');
        }
    };

    useEffect(() => {
        if (!socketRef.current) {
            const socket = io();
            socketRef.current = socket;

            socket.on('connect', () => {
                console.log('[CLIENT-SIDE] ✅ SUCCESS: Connected to WebSocket server!');
                socket.emit('get_initial_state');
            });

            socket.on('login_status', (data) => {
                console.log('[CLIENT-SIDE] Received login_status:', data);
                const wasLoggedIn = isLoggedIn;
                setIsLoggedIn(data.isLoggedIn);

                if (data.isLoggedIn) {
                    setStatus('Đã kết nối và đang lắng nghe tin nhắn...');
                    setQrCodeUrl(null);
                } else {
                    if (wasLoggedIn) {
                        setStatus(`Phiên hết hạn: ${data.reason || 'Unknown reason'}. Đang tự động lấy QR mới...`);
                        requestQrLogin();
                    } else {
                        setStatus('Sẵn sàng để đăng nhập.');
                    }
                }
            });

            socket.on('qr_code_generated', (dataUrl) => {
                console.log('[CLIENT-SIDE] ✅ SUCCESS: Received qr_code_generated event!');
                setQrCodeUrl(dataUrl);
                setStatus('Vui lòng quét mã QR bằng ứng dụng Zalo...');
            });

            socket.on('new_zalo_message', (newMessage) => {
                console.log('[CLIENT-SIDE] Received new_zalo_message:', newMessage);
                setMessages((prevMessages) => [newMessage, ...prevMessages]);
            });

            socket.on('login_error', (error) => {
                console.log('[CLIENT-SIDE] Received login_error:', error);
                setStatus(`Lỗi đăng nhập: ${error.message}`);
                setQrCodeUrl(null);
            });
        }

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [isLoggedIn]);

    return (
        <div style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: '800px', margin: 'auto' }}>
            <h1>Zalo Listener (Auto-Reconnect)</h1>
            <hr style={{ margin: '1rem' }} />

            <div style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
                <p><strong>Trạng thái:</strong> {status}</p>
                {!isLoggedIn && !qrCodeUrl && (
                    <button onClick={requestQrLogin} style={{ padding: '0.5rem 1rem', fontSize: '1rem' }}>
                        Đăng nhập bằng mã QR
                    </button>
                )}
            </div>

            {qrCodeUrl && (
                <div style={{ textAlign: 'center', padding: '1rem', border: '1px solid #eee', borderRadius: '8px' }}>

                    <img src={qrCodeUrl} alt="Zalo QR Code" style={{ width: '250px', height: '250px' }} />
                </div>
            )}

            {isLoggedIn && (
                <div>
                    <h2>Tin nhắn nhận được</h2>
                    <MessageList messages={messages} />
                </div>
            )}
        </div>
    );
}