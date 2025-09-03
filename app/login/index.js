'use client';

import { useState, useEffect } from 'react';
import { startZaloLogin, getZaloMessages } from './zalo/actions';

export default function ZaloPage() {
    const [qrCode, setQrCode] = useState(null);
    const [status, setStatus] = useState('Chưa đăng nhập');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [messages, setMessages] = useState([]);

    const handleLogin = async () => {
        setStatus('Đang tạo mã QR, vui lòng chờ...');
        setQrCode(null);

        const result = await startZaloLogin();

        if (result.qrCode) {
            setQrCode(`data:image/png;base64,${result.qrCode}`);
            setStatus('Vui lòng quét mã QR bằng ứng dụng Zalo của bạn.');
        } else if (result.error) {
            setStatus(`Lỗi: ${result.error}`);
        }
    };

    useEffect(() => {
        const interval = setInterval(async () => {
            const { isLoggedIn: loggedInStatus, messages: newMessages } = await getZaloMessages();
            setIsLoggedIn(loggedInStatus);
            setMessages(newMessages);

            if (loggedInStatus && status !== 'Đã đăng nhập và đang lắng nghe...') {
                setStatus('Đã đăng nhập và đang lắng nghe...');
                setQrCode(null);
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [status]);

    return (
        <div style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: '800px', margin: 'auto' }}>
            <h1>Tích hợp Zalo Listener với Next.js</h1>
            <hr style={{ margin: '1rem 0' }} />

            <div style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
                <p><strong>Trạng thái:</strong> {status}</p>
                {!isLoggedIn && !qrCode && (
                    <button
                        onClick={handleLogin}
                        style={{ padding: '0.5rem 1rem', fontSize: '1rem', cursor: 'pointer' }}
                    >
                        Bắt đầu Đăng nhập Zalo
                    </button>
                )}
            </div>

            {qrCode && (
                <div style={{ textAlign: 'center' }}>
                    <p>Quét mã này để đăng nhập</p>

                    <img src={qrCode} alt="Zalo QR Code" width={250} height={250} />
                </div>
            )}

            {isLoggedIn && (
                <div>
                    <h2>Tin nhắn nhận được (20 tin gần nhất)</h2>
                    <div style={{ border: '1px solid #eee', height: '400px', overflowY: 'auto', padding: '1rem', borderRadius: '8px' }}>
                        {messages.length > 0 ? (
                            messages.map((msg) => (
                                <div key={msg.id} style={{ marginBottom: '1rem', borderBottom: '1px solid #f0f0f0', paddingBottom: '0.5rem' }}>
                                    <p><strong>{msg.sender}</strong> <span style={{ fontSize: '0.8rem', color: '#888' }}>({msg.timestamp})</span></p>
                                    <p>{msg.content}</p>
                                </div>
                            ))
                        ) : (
                            <p>Chưa có tin nhắn nào...</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}