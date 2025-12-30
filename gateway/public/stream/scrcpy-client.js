/**
 * Scrcpy Client - Lightweight H.264 Decoder
 * 
 * Aria 명세서 (2025-01-15) - Appsmith Integration
 * 
 * WebCodecs API를 사용한 하드웨어 가속 H.264 디코딩
 * 의존성 없음 (Vanilla JS)
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 * @size ~10KB (minified)
 */

/**
 * Scrcpy 클라이언트 초기화
 * @param {string} canvasId - Canvas 엘리먼트 ID
 * @param {string} wsUrl - WebSocket URL
 * @param {string} statusId - Status 엘리먼트 ID
 */
function initScrcpyClient(canvasId, wsUrl, statusId) {
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext('2d');
    const statusEl = document.getElementById(statusId);

    // 상태 관리
    let ws = null;
    let decoder = null;
    let frameCount = 0;
    let lastFpsTime = Date.now();
    let currentFps = 0;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;
    const RECONNECT_DELAY = 3000;

    // NAL Unit 파서 상태
    let nalBuffer = new Uint8Array(0);

    /**
     * WebSocket 연결
     */
    function connect() {
        updateStatus('Connecting...', 'connecting');

        ws = new WebSocket(wsUrl);
        ws.binaryType = 'arraybuffer';

        ws.onopen = () => {
            updateStatus('Connected', 'connected');
            reconnectAttempts = 0;
            initDecoder();
        };

        ws.onmessage = (event) => {
            if (typeof event.data === 'string') {
                // JSON 상태 업데이트
                handleStatusMessage(JSON.parse(event.data));
            } else {
                // Binary H.264 프레임
                handleBinaryFrame(new Uint8Array(event.data));
            }
        };

        ws.onclose = (event) => {
            updateStatus('Disconnected', 'disconnected');
            cleanupDecoder();
            scheduleReconnect();
        };

        ws.onerror = (err) => {
            console.error('[ScrcpyClient] WebSocket error:', err);
            updateStatus('Connection Error', 'error');
        };
    }

    /**
     * 재연결 스케줄링
     */
    function scheduleReconnect() {
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            showOfflineMessage('연결 재시도 한계 초과');
            return;
        }

        reconnectAttempts++;
        const delay = RECONNECT_DELAY * reconnectAttempts;
        
        updateStatus(`Reconnecting in ${delay/1000}s...`, 'reconnecting');
        setTimeout(connect, delay);
    }

    /**
     * VideoDecoder 초기화 (WebCodecs API)
     */
    function initDecoder() {
        // WebCodecs 지원 확인
        if (typeof VideoDecoder === 'undefined') {
            console.warn('[ScrcpyClient] WebCodecs not supported, using fallback');
            initFallbackDecoder();
            return;
        }

        try {
            decoder = new VideoDecoder({
                output: (frame) => renderFrame(frame),
                error: (e) => {
                    console.error('[ScrcpyClient] Decoder error:', e);
                    // 디코더 재초기화 시도
                    cleanupDecoder();
                    setTimeout(initDecoder, 1000);
                }
            });

            decoder.configure({
                codec: 'avc1.42E01E', // H.264 Baseline Profile
                optimizeForLatency: true
            });

            console.log('[ScrcpyClient] VideoDecoder initialized');
        } catch (e) {
            console.error('[ScrcpyClient] Failed to init decoder:', e);
            initFallbackDecoder();
        }
    }

    /**
     * Fallback 디코더 (Broadway.js 또는 이미지 기반)
     */
    function initFallbackDecoder() {
        console.log('[ScrcpyClient] Using image fallback decoder');
        decoder = {
            type: 'fallback',
            decode: (data) => {
                // PNG/JPEG 이미지로 가정
                const blob = new Blob([data], { type: 'image/png' });
                const url = URL.createObjectURL(blob);
                const img = new Image();
                img.onload = () => {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);
                    URL.revokeObjectURL(url);
                    updateFps();
                };
                img.src = url;
            }
        };
    }

    /**
     * Binary H.264 프레임 처리
     */
    function handleBinaryFrame(data) {
        // Fallback 디코더인 경우
        if (decoder && decoder.type === 'fallback') {
            decoder.decode(data);
            return;
        }

        // NAL Unit 추출 및 디코딩
        const nalUnits = extractNalUnits(data);
        
        for (const nal of nalUnits) {
            if (decoder && decoder.state === 'configured') {
                try {
                    const chunk = new EncodedVideoChunk({
                        type: isKeyFrame(nal) ? 'key' : 'delta',
                        timestamp: performance.now() * 1000,
                        data: nal
                    });
                    decoder.decode(chunk);
                } catch (e) {
                    console.warn('[ScrcpyClient] Decode error:', e);
                }
            }
        }
    }

    /**
     * NAL Unit 추출
     * H.264 스트림에서 NAL Unit 분리
     */
    function extractNalUnits(data) {
        const nalUnits = [];
        
        // 기존 버퍼와 합치기
        const combined = new Uint8Array(nalBuffer.length + data.length);
        combined.set(nalBuffer);
        combined.set(data, nalBuffer.length);
        
        // NAL 시작 코드 찾기 (0x00 0x00 0x00 0x01 또는 0x00 0x00 0x01)
        let start = -1;
        for (let i = 0; i < combined.length - 4; i++) {
            if (combined[i] === 0 && combined[i+1] === 0) {
                if (combined[i+2] === 0 && combined[i+3] === 1) {
                    if (start >= 0) {
                        nalUnits.push(combined.slice(start, i));
                    }
                    start = i;
                    i += 3;
                } else if (combined[i+2] === 1) {
                    if (start >= 0) {
                        nalUnits.push(combined.slice(start, i));
                    }
                    start = i;
                    i += 2;
                }
            }
        }
        
        // 남은 데이터는 버퍼에 저장
        if (start >= 0) {
            nalBuffer = combined.slice(start);
        } else {
            nalBuffer = combined;
        }
        
        return nalUnits;
    }

    /**
     * Key Frame 확인
     * NAL Unit Type 5 (IDR) = Key Frame
     */
    function isKeyFrame(nalUnit) {
        // NAL 시작 코드 건너뛰기
        let offset = 0;
        if (nalUnit[0] === 0 && nalUnit[1] === 0) {
            if (nalUnit[2] === 0 && nalUnit[3] === 1) {
                offset = 4;
            } else if (nalUnit[2] === 1) {
                offset = 3;
            }
        }
        
        // NAL Unit Type 추출 (하위 5비트)
        const nalType = nalUnit[offset] & 0x1F;
        
        // Type 5 = IDR, Type 7 = SPS, Type 8 = PPS
        return nalType === 5 || nalType === 7 || nalType === 8;
    }

    /**
     * 프레임 렌더링
     */
    function renderFrame(frame) {
        // Canvas 크기 조정
        if (canvas.width !== frame.displayWidth || canvas.height !== frame.displayHeight) {
            canvas.width = frame.displayWidth;
            canvas.height = frame.displayHeight;
        }
        
        ctx.drawImage(frame, 0, 0);
        frame.close();
        
        updateFps();
    }

    /**
     * FPS 업데이트
     */
    function updateFps() {
        frameCount++;
        const now = Date.now();
        const elapsed = now - lastFpsTime;
        
        if (elapsed >= 1000) {
            currentFps = Math.round(frameCount * 1000 / elapsed);
            frameCount = 0;
            lastFpsTime = now;
            
            if (statusEl && statusEl.dataset.showFps !== 'false') {
                statusEl.textContent = `${currentFps} fps`;
            }
        }
    }

    /**
     * 상태 메시지 처리
     */
    function handleStatusMessage(status) {
        console.log('[ScrcpyClient] Status:', status);
        
        if (status.type === 'status') {
            if (statusEl) {
                const fpsInfo = status.fps ? ` | ${status.fps}fps` : '';
                const bitrateInfo = status.bitrate ? ` | ${Math.round(status.bitrate/1000)}kbps` : '';
                statusEl.textContent = `${status.status}${fpsInfo}${bitrateInfo}`;
            }
        }
    }

    /**
     * 상태 업데이트
     */
    function updateStatus(message, state) {
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.className = `status ${state}`;
        }
    }

    /**
     * 오프라인 메시지 표시
     */
    function showOfflineMessage(reason) {
        const container = canvas.parentElement;
        container.innerHTML = `
            <div class="offline">
                <div class="offline-icon">📴</div>
                <div>${reason || 'Device Offline'}</div>
                <button onclick="location.reload()">Retry</button>
            </div>
        `;
    }

    /**
     * 디코더 정리
     */
    function cleanupDecoder() {
        if (decoder && decoder.close) {
            try {
                decoder.close();
            } catch (e) {
                // 무시
            }
        }
        decoder = null;
        nalBuffer = new Uint8Array(0);
    }

    /**
     * 터치 이벤트 설정
     */
    function setupTouchHandling() {
        if (canvas.dataset.touchable !== 'true') return;

        // 클릭 → 터치
        canvas.addEventListener('click', (e) => {
            if (!ws || ws.readyState !== WebSocket.OPEN) return;
            
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            
            ws.send(JSON.stringify({
                type: 'touch',
                action: 'tap',
                x: Math.max(0, Math.min(1, x)),
                y: Math.max(0, Math.min(1, y))
            }));
        });

        // 터치 이벤트 (모바일)
        let touchStartPos = null;
        
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = canvas.getBoundingClientRect();
            touchStartPos = {
                x: (touch.clientX - rect.left) / rect.width,
                y: (touch.clientY - rect.top) / rect.height
            };
            
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'touch',
                    action: 'down',
                    x: touchStartPos.x,
                    y: touchStartPos.y
                }));
            }
        });

        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!touchStartPos) return;
            
            const touch = e.touches[0];
            const rect = canvas.getBoundingClientRect();
            const x = (touch.clientX - rect.left) / rect.width;
            const y = (touch.clientY - rect.top) / rect.height;
            
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'touch',
                    action: 'move',
                    x: Math.max(0, Math.min(1, x)),
                    y: Math.max(0, Math.min(1, y))
                }));
            }
        });

        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (!touchStartPos) return;
            
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'touch',
                    action: 'up',
                    x: touchStartPos.x,
                    y: touchStartPos.y
                }));
            }
            touchStartPos = null;
        });

        canvas.style.cursor = 'pointer';
        canvas.style.touchAction = 'none';
    }

    // 초기화
    setupTouchHandling();
    connect();

    // 공개 API
    return {
        reconnect: () => {
            if (ws) ws.close();
            reconnectAttempts = 0;
            connect();
        },
        disconnect: () => {
            if (ws) ws.close();
            cleanupDecoder();
        },
        getFps: () => currentFps,
        isConnected: () => ws && ws.readyState === WebSocket.OPEN
    };
}

// 글로벌 export
if (typeof window !== 'undefined') {
    window.initScrcpyClient = initScrcpyClient;
}

