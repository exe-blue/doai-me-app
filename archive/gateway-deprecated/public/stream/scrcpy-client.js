/**
 * Scrcpy/H.264 WebSocket Client
 * 
 * JMuxer를 사용한 H.264 디코딩 및 Canvas 렌더링
 * 
 * 사용법:
 *   initScrcpyClient('canvas', 'ws://localhost:3100/ws/stream/device123', 'status');
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

(function(global) {
    'use strict';
    
    // JMuxer CDN (없으면 동적 로드)
    const JMUXER_CDN = 'https://cdn.jsdelivr.net/npm/jmuxer@2.0.5/dist/jmuxer.min.js';
    
    /**
     * JMuxer 동적 로드
     */
    function loadJMuxer() {
        return new Promise((resolve, reject) => {
            if (global.JMuxer) {
                resolve(global.JMuxer);
                return;
            }
            
            const script = document.createElement('script');
            script.src = JMUXER_CDN;
            script.onload = () => resolve(global.JMuxer);
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    
    /**
     * Scrcpy Client 클래스
     */
    class ScrcpyClient {
        /**
         * @param {string|HTMLCanvasElement} canvas - Canvas 요소 또는 ID
         * @param {string} wsUrl - WebSocket URL
         * @param {string|HTMLElement} statusElement - 상태 표시 요소 (선택)
         */
        constructor(canvas, wsUrl, statusElement) {
            this.canvas = typeof canvas === 'string' 
                ? document.getElementById(canvas) 
                : canvas;
            this.wsUrl = wsUrl;
            this.statusElement = typeof statusElement === 'string'
                ? document.getElementById(statusElement)
                : statusElement;
            
            this.ws = null;
            this.jmuxer = null;
            this.isConnected = false;
            
            // 통계
            this.stats = {
                bytesReceived: 0,
                framesDecoded: 0,
                errors: 0,
                connectTime: null,
                lastFrameTime: null
            };
            
            // FPS 계산용
            this._frameCount = 0;
            this._lastFpsTime = Date.now();
            this._currentFps = 0;
        }
        
        /**
         * 연결 시작
         */
        async connect() {
            try {
                // JMuxer 로드
                this._updateStatus('JMuxer 로딩 중...');
                const JMuxer = await loadJMuxer();
                
                // JMuxer 초기화
                this._updateStatus('디코더 초기화 중...');
                this.jmuxer = new JMuxer({
                    node: this.canvas,
                    mode: 'video',
                    flushingTime: 0,  // 최소 지연
                    fps: 30,
                    debug: false,
                    onReady: () => {
                        console.log('[ScrcpyClient] JMuxer ready');
                    },
                    onError: (err) => {
                        console.error('[ScrcpyClient] JMuxer error:', err);
                        this.stats.errors++;
                    }
                });
                
                // WebSocket 연결
                this._updateStatus('서버 연결 중...');
                await this._connectWebSocket();
                
            } catch (err) {
                console.error('[ScrcpyClient] 연결 실패:', err);
                this._updateStatus(`오류: ${err.message}`, true);
                throw err;
            }
        }
        
        /**
         * WebSocket 연결
         */
        _connectWebSocket() {
            return new Promise((resolve, reject) => {
                this.ws = new WebSocket(this.wsUrl);
                this.ws.binaryType = 'arraybuffer';
                
                const timeout = setTimeout(() => {
                    reject(new Error('연결 타임아웃'));
                    this.ws.close();
                }, 10000);
                
                this.ws.onopen = () => {
                    clearTimeout(timeout);
                    console.log('[ScrcpyClient] WebSocket 연결됨');
                    this.isConnected = true;
                    this.stats.connectTime = Date.now();
                    resolve();
                };
                
                this.ws.onmessage = (event) => {
                    this._handleMessage(event);
                };
                
                this.ws.onclose = (event) => {
                    clearTimeout(timeout);
                    console.log('[ScrcpyClient] WebSocket 연결 종료:', event.code);
                    this.isConnected = false;
                    this._updateStatus('연결 끊김', true);
                    
                    // 자동 재연결 (5초 후)
                    if (event.code !== 1000) {
                        setTimeout(() => this.connect(), 5000);
                    }
                };
                
                this.ws.onerror = (err) => {
                    clearTimeout(timeout);
                    console.error('[ScrcpyClient] WebSocket 오류:', err);
                    reject(err);
                };
            });
        }
        
        /**
         * 메시지 처리
         */
        _handleMessage(event) {
            if (event.data instanceof ArrayBuffer) {
                // H.264 바이너리 데이터
                this._handleVideoData(event.data);
            } else {
                // JSON 메시지
                try {
                    const msg = JSON.parse(event.data);
                    this._handleJsonMessage(msg);
                } catch (e) {
                    console.warn('[ScrcpyClient] JSON 파싱 실패:', e);
                }
            }
        }
        
        /**
         * H.264 비디오 데이터 처리
         */
        _handleVideoData(data) {
            if (!this.jmuxer) return;
            
            // 통계 업데이트
            this.stats.bytesReceived += data.byteLength;
            this.stats.framesDecoded++;
            this.stats.lastFrameTime = Date.now();
            
            // JMuxer에 피드
            try {
                this.jmuxer.feed({
                    video: new Uint8Array(data)
                });
            } catch (e) {
                console.error('[ScrcpyClient] 디코딩 오류:', e);
                this.stats.errors++;
            }
            
            // FPS 계산
            this._frameCount++;
            const now = Date.now();
            if (now - this._lastFpsTime >= 1000) {
                this._currentFps = Math.round(this._frameCount * 1000 / (now - this._lastFpsTime));
                this._frameCount = 0;
                this._lastFpsTime = now;
                
                // 상태 업데이트
                this._updateStatus(`${this._currentFps} FPS | ${this._formatBytes(this.stats.bytesReceived)}`);
            }
        }
        
        /**
         * JSON 메시지 처리
         */
        _handleJsonMessage(msg) {
            console.log('[ScrcpyClient] JSON 메시지:', msg);
            
            switch (msg.type) {
                case 'connected':
                    this._updateStatus(`연결됨 (${msg.quality || 'medium'})`);
                    break;
                    
                case 'error':
                    this._updateStatus(`오류: ${msg.message}`, true);
                    break;
                    
                case 'status':
                    this._updateStatus(msg.message || 'OK');
                    break;
            }
        }
        
        /**
         * 상태 업데이트
         */
        _updateStatus(message, isError = false) {
            if (this.statusElement) {
                this.statusElement.textContent = message;
                this.statusElement.style.color = isError ? '#f44' : '#4f4';
            }
        }
        
        /**
         * 바이트 포맷팅
         */
        _formatBytes(bytes) {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
            return (bytes / 1024 / 1024).toFixed(1) + ' MB';
        }
        
        /**
         * 터치 이벤트 전송
         */
        sendTouch(action, x, y, endX, endY) {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
            
            const msg = {
                type: 'control:touch',
                payload: { action, x, y, endX, endY }
            };
            
            this.ws.send(JSON.stringify(msg));
        }
        
        /**
         * 키 이벤트 전송
         */
        sendKey(keycode) {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
            
            const msg = {
                type: 'control:key',
                payload: { keycode }
            };
            
            this.ws.send(JSON.stringify(msg));
        }
        
        /**
         * 연결 종료
         */
        disconnect() {
            if (this.ws) {
                this.ws.close(1000, 'Client disconnect');
                this.ws = null;
            }
            
            if (this.jmuxer) {
                this.jmuxer.destroy();
                this.jmuxer = null;
            }
            
            this.isConnected = false;
        }
        
        /**
         * 통계 조회
         */
        getStats() {
            return {
                ...this.stats,
                fps: this._currentFps,
                isConnected: this.isConnected,
                uptime: this.stats.connectTime 
                    ? Date.now() - this.stats.connectTime 
                    : 0
            };
        }
    }
    
    /**
     * 초기화 함수 (전역)
     * 
     * @param {string} canvasId - Canvas 요소 ID
     * @param {string} wsUrl - WebSocket URL
     * @param {string} statusId - 상태 요소 ID (선택)
     * @returns {ScrcpyClient}
     */
    function initScrcpyClient(canvasId, wsUrl, statusId) {
        const client = new ScrcpyClient(canvasId, wsUrl, statusId);
        client.connect().catch(err => {
            console.error('[initScrcpyClient] 연결 실패:', err);
        });
        return client;
    }
    
    // 전역 노출
    global.ScrcpyClient = ScrcpyClient;
    global.initScrcpyClient = initScrcpyClient;
    
})(typeof window !== 'undefined' ? window : global);

