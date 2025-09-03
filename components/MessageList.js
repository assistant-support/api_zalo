'use client';

export default function MessageList({ messages }) {
    const styles = {
        container: {
            height: '500px',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            padding: '16px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column-reverse',
            backgroundColor: '#f9f9f9',
        },
        emptyState: {
            textAlign: 'center',
            color: '#888',
            alignSelf: 'center',
            margin: 'auto',
        },
        messageBubble: {
            backgroundColor: '#ffffff',
            padding: '12px 16px',
            borderRadius: '18px',
            marginBottom: '10px',
            maxWidth: '75%',
            alignSelf: 'flex-start',
            border: '1px solid #eee',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        },
        header: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '4px',
        },
        sender: {
            fontWeight: 'bold',
            color: '#005ae0',
        },
        timestamp: {
            fontSize: '0.75rem',
            color: '#999',
        },
        content: {
            margin: 0,
            wordWrap: 'break-word',
        }
    };

    return (
        <div style={styles.container}>
            <div style={{ flexGrow: 1 }}></div>
            {messages.length > 0 ? (
                messages.map((msg) => (
                    <div key={msg.id} style={styles.messageBubble}>
                        <div style={styles.header}>
                            <span style={styles.sender}>{msg.sender}</span>
                            <span style={styles.timestamp}>{msg.timestamp}</span>
                        </div>
                        <p style={styles.content}>{msg.content}</p>
                    </div>
                ))
            ) : (
                <p style={styles.emptyState}>Chưa có tin nhắn nào...</p>
            )}
        </div>
    );
}