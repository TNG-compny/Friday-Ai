import { SessionState, LiveTelemetry } from '../types';

export interface LiveSessionCallbacks {
  onStateChange: (state: SessionState) => void;
  onAudioChunk: (base64Audio: string) => void;
  onInterrupted: () => void;
  onTurnComplete?: () => void;
  onToolCall: (toolCall: any) => void;
  onError: (errorMsg: string) => void;
  onTelemetryUpdate?: (telemetry: Partial<LiveTelemetry>) => void;
}

export class LiveSession {
  private ws: WebSocket | null = null;
  private callbacks: LiveSessionCallbacks;
  private state: SessionState = 'disconnected';
  private pingInterval: any = null;
  private packetsSent = 0;
  private packetsReceived = 0;
  private selectedVoice = 'Aoede';

  constructor(callbacks: LiveSessionCallbacks) {
    this.callbacks = callbacks;
  }

  getState(): SessionState {
    return this.state;
  }

  private setState(newState: SessionState) {
    if (this.state !== newState) {
      this.state = newState;
      this.callbacks.onStateChange(newState);
    }
  }

  connect(voice: string = 'Aoede'): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.selectedVoice = voice;
    this.setState('connecting');

    let wsUrl: string;
    const customServer =
      (import.meta as any).env?.VITE_API_SERVER_URL ||
      (typeof window !== 'undefined' ? window.localStorage?.getItem('FRIDAY_SERVER_URL') : null);

    if (customServer) {
      const cleanServer = customServer.replace(/^http/, 'ws').replace(/\/+$/, '');
      wsUrl = `${cleanServer}/api/live`;
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}/api/live`;
    }

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[LiveSession] WebSocket connected');
        this.startPingLoop();
        // Notify backend of preferred voice
        if (this.selectedVoice !== 'Aoede') {
          this.ws?.send(JSON.stringify({ type: 'change_voice', voice: this.selectedVoice }));
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          // 1. Connection established
          if (msg.status === 'connected') {
            this.setState('listening');
            if (this.callbacks.onTelemetryUpdate) {
              this.callbacks.onTelemetryUpdate({
                model: msg.model || 'gemini-3.1-flash-live-preview',
                voice: msg.voice || this.selectedVoice,
                sampleRateIn: 16000,
                sampleRateOut: 24000,
              });
            }
            return;
          }

          // 2. Audio playback chunk received
          if (msg.audio) {
            this.packetsReceived++;
            this.setState('speaking');
            this.callbacks.onAudioChunk(msg.audio);
            return;
          }

          // 3. Model interrupted event (user started talking)
          if (msg.interrupted) {
            this.callbacks.onInterrupted();
            this.setState('listening');
            return;
          }

          // 4. Turn complete event
          if (msg.turnComplete) {
            if (this.callbacks.onTurnComplete) {
              this.callbacks.onTurnComplete();
            }
            // State transitions back to listening after model finishes speaking
            return;
          }

          // 5. Function/Tool call from Gemini
          if (msg.toolCall) {
            this.callbacks.onToolCall(msg.toolCall);
            return;
          }

          // 6. Latency pong
          if (msg.type === 'pong' && msg.clientTimestamp) {
            const latency = Date.now() - msg.clientTimestamp;
            if (this.callbacks.onTelemetryUpdate) {
              this.callbacks.onTelemetryUpdate({
                latencyMs: latency,
                packetsSent: this.packetsSent,
                packetsReceived: this.packetsReceived,
              });
            }
            return;
          }

          // 7. Error event
          if (msg.error) {
            console.error('[LiveSession] Server reported error:', msg.error);
            this.callbacks.onError(msg.error);
            this.setState('error');
            return;
          }
        } catch (err) {
          console.error('[LiveSession] Error parsing message:', err);
        }
      };

      this.ws.onerror = (err) => {
        console.error('[LiveSession] WebSocket error:', err);
        this.callbacks.onError('Connection error to voice server.');
        this.setState('error');
      };

      this.ws.onclose = (e) => {
        console.log('[LiveSession] WebSocket closed:', e.code, e.reason);
        this.stopPingLoop();
        this.setState('disconnected');
      };
    } catch (e: any) {
      console.error('[LiveSession] Failed to connect WebSocket:', e);
      this.callbacks.onError(e?.message || 'Failed to initialize voice connection.');
      this.setState('error');
    }
  }

  sendAudio(base64Audio: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.packetsSent++;
      this.ws.send(JSON.stringify({ audio: base64Audio }));
    }
  }

  sendToolResponse(functionResponses: any[]): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[LiveSession] Sending tool responses:', functionResponses);
      this.ws.send(
        JSON.stringify({
          toolResponse: {
            functionResponses,
          },
        })
      );
    }
  }

  changeVoice(voice: string): void {
    this.selectedVoice = voice;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'change_voice', voice }));
    }
  }

  disconnect(): void {
    this.stopPingLoop();
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.setState('disconnected');
  }

  private startPingLoop(): void {
    this.stopPingLoop();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', clientTimestamp: Date.now() }));
      }
    }, 4000);
  }

  private stopPingLoop(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}
