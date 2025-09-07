// Minimal inline SVG icon set
// Usage: <Icon path={icons.home} size={20} className="text-gray-700" />

export const Icon = ({ path, className = "", size = 20 }) => (
    <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d={path} />
    </svg>
);

export const icons = {
    logo: "M12 2l7 4v8l-7 4-7-4V6l7-4z",
    chevronRight: "M9 18l6-6-6-6",
    chevronLeft: "M15 18L9 12l6-6",
    chevronDown: "M6 9l6 6 6-6",
    home: "M3 11l9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
    clock: "M12 8v5l3 3M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z",
    star: "M12 17.27L18.18 21 16.54 13.97 22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z",
    settings: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 7.03 3.4l.06.06c.46.46 1.12.6 1.7.39.53-.19 1.1-.29 1.68-.29s1.15.1 1.68.29c.58.21 1.24.07 1.7-.39l.06-.06A2 2 0 1 1 20.6 7.03l-.06.06c-.46.46-.6 1.12-.39 1.7.19.53.29 1.1.29 1.68s-.1 1.15-.29 1.68c-.21.58-.07 1.24.39 1.7z",
    cube: "M21 16V8l-9-5-9 5v8l9 5 9-5z M3 8l9 5 9-5",
    book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 4h16v13H6.5A2.5 2.5 0 0 0 4 19.5z",
    file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6",
    users: "M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 7a4 4 0 1 1 0-8 4 4 0 0 1 0 8z M20 21v-2a4 4 0 0 0-3-3.87",
    bell: "M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8 M13.73 21a2 2 0 01-3.46 0",
    logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9"
};
