export default function Loading() {
    return (
        <div className="p-6 animate-fadeInUp">
            <div className="grid gap-4 md:grid-cols-3">
                <div className="card h-36 animate-pulse" />
                <div className="card h-36 animate-pulse" />
                <div className="card h-36 animate-pulse" />
            </div>
            <div className="card h-64 mt-6 animate-pulse" />
        </div>
    );
}
