export default function Template({ children }) {
    // Slight fade/translate on each page mount for smoother transitions
    return <div className="animate-fadeInUp">{children}</div>;
}