type WebSocketMessage = {
  type: string;
  data: any;
};

type MessageHandler = (message: WebSocketMessage) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private handlers: Set<MessageHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private url: string;
  private isConnected = false;
  private connectionListeners: Set<(connected: boolean) => void> = new Set();

  constructor(url?: string) {
    // Will be set dynamically based on config
    // Initial URL will be updated when WebSocketProvider loads config
    this.url = url || 'ws://localhost:8080';
  }

  setUrl(url: string): void {
    if (this.url !== url) {
      this.url = url;
      // If connected, reconnect with new URL
      if (this.isConnected) {
        this.disconnect();
        this.reconnectAttempts = 0;
        this.connect().catch(_error => {
          console.log('WebSocketService: Reconnection with new URL failed');
        });
      }
    }
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      // If already connecting, wait for it to complete
      if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
        const checkConnection = () => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            resolve();
          } else if (this.ws?.readyState === WebSocket.CLOSED || this.ws?.readyState === WebSocket.CLOSING) {
            reject(new Error('WebSocket connection failed'));
          } else {
            setTimeout(checkConnection, 50);
          }
        };
        checkConnection();
        return;
      }

      console.log('WebSocketService: Connecting to', this.url);

      try {
        this.ws = new WebSocket(this.url);
      } catch (error) {
        console.log('WebSocketService: Failed to create WebSocket:', error);
        reject(new Error('Failed to create WebSocket connection'));
        return;
      }

      const cleanup = () => {
        if (this.ws) {
          this.ws.removeEventListener('open', onOpen);
          this.ws.removeEventListener('error', onError);
        }
      };

      const onOpen = () => {
        console.log('WebSocketService: Connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.notifyConnectionChange(true);
        cleanup();
        resolve();
      };

      const onError = (_event: Event) => {
        console.log('WebSocketService: Connection failed to', this.url);
        cleanup();
        // Only reject if we're still in connecting state
        if (this.ws?.readyState === WebSocket.CONNECTING || this.ws?.readyState === WebSocket.CLOSED) {
          reject(new Error('WebSocket connection failed'));
        }
      };

      this.ws.addEventListener('open', onOpen);
      this.ws.addEventListener('error', onError);

      this.ws.addEventListener('message', (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handlers.forEach(handler => {
            try {
              handler(message);
            } catch (error) {
              console.error('WebSocketService: Handler error:', error);
            }
          });
        } catch (error) {
          console.error('WebSocketService: Message parse error:', error);
        }
      });

      this.ws.addEventListener('close', () => {
        console.log('WebSocketService: Connection closed');
        this.isConnected = false;
        this.notifyConnectionChange(false);
        this.attemptReconnect();
      });
    });
  }

  disconnect(): void {
    console.log('WebSocketService: Disconnecting');

    // Mark for disconnection to prevent reconnection attempts
    this.reconnectAttempts = this.maxReconnectAttempts;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      const ws = this.ws;
      this.ws = null;

      // Only close if not already closed/closing
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        try {
          ws.close();
        } catch (error) {
          console.log('WebSocketService: Error closing WebSocket:', error);
        }
      }
    }

    this.isConnected = false;
    this.notifyConnectionChange(false);
  }

  addMessageHandler(handler: MessageHandler): () => void {
    this.handlers.add(handler);

    // Auto-connect if not already connected or connecting
    if (!this.isConnected && (!this.ws || this.ws.readyState === WebSocket.CLOSED)) {
      // Reset reconnect attempts when adding new handler
      this.reconnectAttempts = 0;
      // Add small delay to prevent race conditions during component mounting
      setTimeout(() => {
        if (!this.isConnected && (!this.ws || this.ws.readyState === WebSocket.CLOSED)) {
          this.connect().catch(_error => {
            console.log('WebSocketService: Auto-connect failed, will retry');
          });
        }
      }, 100);
    }

    // Return cleanup function
    return () => {
      this.handlers.delete(handler);

      // If no more handlers, disconnect
      if (this.handlers.size === 0) {
        this.disconnect();
      }
    };
  }

  addConnectionListener(listener: (connected: boolean) => void): () => void {
    this.connectionListeners.add(listener);

    // Immediately notify of current state
    listener(this.isConnected);

    // Return cleanup function
    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  private notifyConnectionChange(connected: boolean): void {
    this.connectionListeners.forEach(listener => {
      try {
        listener(connected);
      } catch (error) {
        console.error('WebSocketService: Connection listener error:', error);
      }
    });
  }

  private attemptReconnect(): void {
    if (this.handlers.size === 0) {
      // No handlers left, don't reconnect
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('WebSocketService: Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Max 30 seconds

    console.log(`WebSocketService: Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch(error => {
        console.error('WebSocketService: Reconnection failed:', error);
      });
    }, delay);
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

// Global instance
const websocketService = new WebSocketService();

export default websocketService;