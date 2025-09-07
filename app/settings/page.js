export default function Settings() {
    return (
        <div className="p-6">
            <div className="card p-6">
                <div className="grid gap-4 max-w-xl">
                    <label className="grid gap-1">
                        <span className="text-sm">Name</span>
                        <input className="input" placeholder="Your name" />
                    </label>
                    <button className="btn btn-primary w-fit">Save changes</button>
                </div>
            </div>
        </div>
    );
}