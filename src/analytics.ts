
export class AnalyticsService {
    private sessionId: string;
    private apiUrl: string;

    constructor(apiUrl: string = '/api/analytics') {
        this.apiUrl = apiUrl;
        this.sessionId = this.generateSessionId();
    }

    private generateSessionId(): string {
        return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    public startSession(): void {
        this.sendRequest('/session/start', { sessionId: this.sessionId });
        
        window.addEventListener('beforeunload', () => {
            this.sendRequest('/session/end', { sessionId: this.sessionId }, true);
        });
    }

    public trackEvent(category: string, action: string, label?: string): void {
        this.sendRequest('/event', {
            sessionId: this.sessionId,
            category,
            action,
            label
        });
    }

    private sendRequest(endpoint: string, data: any, keepAlive: boolean = false): void {
        const url = `${this.apiUrl}${endpoint}`;
        
        if (keepAlive && navigator.sendBeacon) {
            const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
            navigator.sendBeacon(url, blob);
        } else {
            fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            }).catch(console.error);
        }
    }
}

export const analytics = new AnalyticsService();
