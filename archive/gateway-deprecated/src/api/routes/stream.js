/**
 * Stream Route Handler
 * 
 * Aria 명세서 (2025-01-15) - Appsmith Integration
 * 
 * Endpoints:
 * - GET /stream/:device_id/view  - Iframe-embeddable HTML
 * - GET /stream/scrcpy-client.js - Decoder script (static)
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

const express = require('express');
const path = require('path');
const router = express.Router();

/**
 * GET /stream/:device_id/view
 * Appsmith Iframe에 삽입 가능한 최소 HTML 페이지
 * 
 * Query Parameters:
 * - quality: low | medium | high (default: medium)
 * - showStatus: true | false (default: true)
 * - touchable: true | false (default: false)
 */
router.get('/:device_id/view', (req, res) => {
    const { logger, deviceTracker, streamServer } = req.context;
    const { device_id } = req.params;
    const { quality, showStatus, touchable } = req.query;

    // 기기 확인
    const device = deviceTracker.getDevice(device_id);
    
    if (!device) {
        return res.status(404).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { 
                        background: #1a1a1a; color: #666; 
                        font: 16px sans-serif;
                        display: flex; align-items: center; justify-content: center;
                        height: 100vh; margin: 0;
                        flex-direction: column; gap: 16px;
                    }
                    .icon { font-size: 48px; }
                </style>
            </head>
            <body>
                <div class="icon">📴</div>
                <div>Device Not Found: ${device_id}</div>
            </body>
            </html>
        `);
    }

    // HTML 생성
    const html = streamServer.generateViewHtml(device_id, {
        quality,
        showStatus,
        touchable
    });

    res.type('html').send(html);
});

/**
 * GET /stream/scrcpy-client.js
 * Scrcpy 클라이언트 스크립트 (정적 파일)
 */
router.get('/scrcpy-client.js', (req, res) => {
    const clientPath = path.join(__dirname, '../../../public/stream/scrcpy-client.js');
    res.sendFile(clientPath);
});

module.exports = router;

