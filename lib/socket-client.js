// /lib/socket-client.js
"use client";
import { io } from 'socket.io-client';

let _socket;
export function getSocket() {
    if (typeof window === 'undefined') return null;
    if (!_socket) {
        _socket = io(window.location.origin, {
            path: '/socket.io',
            transports: ['websocket'],
            // withCredentials: true, // bật nếu server yêu cầu cookie (NextAuth…)
        });
    }
    return _socket;
}
