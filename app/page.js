'use client';

import { useState, useEffect } from 'react';
import { getZaloState } from '@/app/actions/zalo.action';
import MessageList from '@/components/MessageList';
import io from 'socket.io-client'; // Import socket.io-client

export default function ZaloPage() {
    const [status, setStatus] = useState('Đang kết nối đến server...');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [messages, setMessages] = useState([]);

    useEffect(() => {
        // 1. Lấy lịch sử tin nhắn cũ ngay khi tải trang
        const fetchInitialState = async () => {
            const initialState = await getZaloState();
            setIsLoggedIn(initialState.isLoggedIn);
            setMessages(initialState.messages);
            if (initialState.isLoggedIn) {
                setStatus('Đã kết nối và đang lắng nghe tin nhắn...');
            } else {
                setStatus('Chưa kết nối. Kiểm tra console của server.');
            }
        };
        fetchInitialState();

        // 2. Thiết lập kết nối WebSocket
        const socket = io();

        socket.on('connect', () => {
            console.log('Connected to WebSocket server!');
        });

        // 3. Lắng nghe sự kiện 'new_zalo_message' từ server
        socket.on('new_zalo_message', (newMessage) => {
            console.log('Received new message from server:', newMessage);
            // Thêm tin nhắn mới vào đầu danh sách
            setMessages((prevMessages) => [newMessage, ...prevMessages]);
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from WebSocket server.');
        });

        // 4. Dọn dẹp: Ngắt kết nối khi component bị hủy
        return () => {
            socket.disconnect();
        };

    }, []); // Mảng rỗng đảm bảo useEffect chỉ chạy một lần

    return (
        <div style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: '800px', margin: 'auto' }}>
            <h1>Zalo Listener (Real-time with WebSockets)</h1>
            <hr style={{ margin: '1rem' }} />
            <div style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
                <p><strong>Trạng thái:</strong> {status}</p>
            </div>

            {isLoggedIn ? (
                <div>
                    <h2>Tin nhắn nhận được</h2>
                    <MessageList messages={messages} />
                </div>
            ) : (
                <p>Đang chờ kết nối từ server...</p>
            )}
        </div>
    );
}