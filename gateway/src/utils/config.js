/**
 * Config Utility
 * 설정 관리
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

class Config {
    constructor() {
        this.config = {
            // 서버 설정
            port: parseInt(process.env.PORT) || 3100,
            host: process.env.HOST || '0.0.0.0',
            
            // ADB 설정
            adb: {
                host: process.env.ADB_HOST || '127.0.0.1',
                port: parseInt(process.env.ADB_PORT) || 5037
            },
            
            // Supabase 설정
            supabase: {
                url: process.env.SUPABASE_URL || '',
                anonKey: process.env.SUPABASE_ANON_KEY || '',
                serviceKey: process.env.SUPABASE_SERVICE_KEY || ''
            },
            
            // 모니터링 설정
            heartbeat: {
                interval: parseInt(process.env.HEARTBEAT_INTERVAL) || 30000,
                timeout: parseInt(process.env.HEARTBEAT_TIMEOUT) || 5000,
                failureThreshold: parseInt(process.env.HEARTBEAT_FAILURE_THRESHOLD) || 3
            },
            
            // 로깅 설정
            log: {
                level: process.env.LOG_LEVEL || 'info'
            }
        };
    }

    get(key) {
        const keys = key.split('.');
        let value = this.config;
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return undefined;
            }
        }
        
        return value;
    }

    set(key, value) {
        const keys = key.split('.');
        let obj = this.config;
        
        for (let i = 0; i < keys.length - 1; i++) {
            if (!(keys[i] in obj)) {
                obj[keys[i]] = {};
            }
            obj = obj[keys[i]];
        }
        
        obj[keys[keys.length - 1]] = value;
    }

    getAll() {
        return { ...this.config };
    }
}

module.exports = Config;

