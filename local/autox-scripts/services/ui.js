/**
 * UI Service
 * 범용 UI 조작 유틸리티
 * 
 * Aria 명세서 (2025-01-15) 준수
 * - 랜덤 오프셋/딜레이: 봇 탐지 회피
 * - 오타 시뮬레이션: 인간적 행동
 * - Promise 기반 체인
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

'nodejs';

/**
 * 스와이프 방향
 */
const Direction = {
    UP: 'UP',
    DOWN: 'DOWN',
    LEFT: 'LEFT',
    RIGHT: 'RIGHT'
};

/**
 * 셀렉터 전략
 * 
 * 참고: 이 enum은 현재 UIService 내부 메서드에서 직접 사용되지 않지만,
 * 외부 코드에서 selector 객체 구성 시 타입 안전성을 위해 export됨.
 * 향후 selector 타입 검증 로직에서 활용 가능.
 * 
 * @example
 * const selector = { [SelectorStrategy.ID]: 'my-button' };
 */
const SelectorStrategy = {
    ID: 'id',
    DESC: 'desc',
    TEXT: 'text',
    CLASS: 'className',
    COORDS: 'coords'
};

class UIService {
    constructor(logger) {
        this.logger = logger;
        
        // 화면 크기 (기본값)
        this.screenWidth = device.width || 1080;
        this.screenHeight = device.height || 2280;
    }

    /**
     * 요소 클릭
     * @param {Object|Array} target - Selector 객체 또는 좌표 배열 [x, y]
     * @returns {boolean} 성공 여부
     */
    click(target) {
        try {
            let x, y;

            if (Array.isArray(target)) {
                // 좌표 직접 사용
                [x, y] = target;
            } else if (typeof target === 'object' && target.bounds) {
                // UiObject
                const bounds = target.bounds();
                x = bounds.centerX();
                y = bounds.centerY();
            } else {
                this.logger.warn('[UI] 잘못된 클릭 대상', { target });
                return false;
            }

            // 랜덤 오프셋 추가 (±5px)
            x += Math.floor(Math.random() * 11) - 5;
            y += Math.floor(Math.random() * 11) - 5;

            // 클릭 실행
            click(x, y);

            // 클릭 후 랜덤 딜레이 (100-300ms)
            const delay = 100 + Math.floor(Math.random() * 200);
            sleep(delay);

            this.logger.debug('[UI] 클릭', { x, y, delay });
            return true;

        } catch (e) {
            this.logger.error('[UI] 클릭 실패', { error: e.message });
            return false;
        }
    }

    /**
     * 요소 찾기
     * @param {Object} selector - 셀렉터 정의
     * @param {number} timeout - 대기 시간 (ms)
     * @returns {UiObject|null}
     */
    findElement(selector, timeout = 5000) {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            try {
                let element = null;

                // 다중 셀렉터 전략 시도
                if (selector.id) {
                    element = id(selector.id).findOne(500);
                }
                
                if (!element && selector.desc) {
                    element = desc(selector.desc).findOne(500);
                }
                
                if (!element && selector.text) {
                    element = text(selector.text).findOne(500);
                }
                
                if (!element && selector.className) {
                    let query = className(selector.className);
                    if (selector.clickable !== undefined) {
                        query = query.clickable(selector.clickable);
                    }
                    if (selector.editable !== undefined) {
                        query = query.editable(selector.editable);
                    }
                    element = query.findOne(500);
                }

                if (element) {
                    this.logger.debug('[UI] 요소 발견', { 
                        selector: Object.keys(selector)[0] 
                    });
                    return element;
                }

            } catch (e) {
                // 무시하고 계속 시도
            }

            sleep(100);
        }

        this.logger.debug('[UI] 요소 미발견', { selector, timeout });
        return null;
    }

    /**
     * 요소 출현 대기
     * @param {Object} selector - 셀렉터 정의
     * @param {number} timeout - 대기 시간 (ms)
     * @returns {boolean}
     */
    waitFor(selector, timeout = 5000) {
        const element = this.findElement(selector, timeout);
        return element !== null;
    }

    /**
     * 스와이프
     * @param {string} direction - Direction enum
     * @param {number} distance - 이동 거리 (px)
     * @param {number} duration - 지속 시간 (ms)
     */
    swipe(direction, distance = 500, duration = 400) {
        const centerX = this.screenWidth / 2;
        const centerY = this.screenHeight / 2;

        let startX, startY, endX, endY;

        switch (direction) {
            case Direction.UP:
                startX = endX = centerX;
                startY = centerY + distance / 2;
                endY = centerY - distance / 2;
                break;

            case Direction.DOWN:
                startX = endX = centerX;
                startY = centerY - distance / 2;
                endY = centerY + distance / 2;
                break;

            case Direction.LEFT:
                startY = endY = centerY;
                startX = centerX + distance / 2;
                endX = centerX - distance / 2;
                break;

            case Direction.RIGHT:
                startY = endY = centerY;
                startX = centerX - distance / 2;
                endX = centerX + distance / 2;
                break;

            default:
                this.logger.warn('[UI] 알 수 없는 방향', { direction });
                return;
        }

        // 자연스러운 곡선 스와이프 (중간점 추가)
        const midX = (startX + endX) / 2 + (Math.random() * 20 - 10);
        const midY = (startY + endY) / 2 + (Math.random() * 20 - 10);

        gesture(duration, [startX, startY], [midX, midY], [endX, endY]);

        this.logger.debug('[UI] 스와이프', { direction, distance });
    }

    /**
     * 텍스트 입력
     * @param {string} text - 입력할 텍스트
     * @param {boolean} humanLike - 인간적 입력 시뮬레이션
     */
    typeText(text, humanLike = true) {
        if (!humanLike) {
            // 빠른 입력
            setText(text);
            return;
        }

        // 인간적 입력 시뮬레이션
        for (let i = 0; i < text.length; i++) {
            const char = text[i];

            // 오타 시뮬레이션 (5% 확률)
            if (Math.random() < 0.05) {
                // 잘못된 문자 입력
                const wrongChar = String.fromCharCode(
                    char.charCodeAt(0) + (Math.random() < 0.5 ? 1 : -1)
                );
                input(wrongChar);
                sleep(50 + Math.floor(Math.random() * 50));
                
                // 백스페이스로 수정 (KEYCODE_DEL = 67)
                pressKeyCode(67);
                sleep(50 + Math.floor(Math.random() * 50));
            }

            // 정상 입력
            input(char);

            // 글자당 딜레이 (50-150ms)
            const delay = 50 + Math.floor(Math.random() * 100);
            sleep(delay);
        }

        this.logger.debug('[UI] 텍스트 입력', { length: text.length, humanLike });
    }

    /**
     * 롱 프레스
     * @param {Object|Array} target - 대상
     * @param {number} duration - 지속 시간 (ms)
     */
    longPress(target, duration = 1000) {
        try {
            let x, y;

            if (Array.isArray(target)) {
                [x, y] = target;
            } else if (typeof target === 'object' && target.bounds) {
                const bounds = target.bounds();
                x = bounds.centerX();
                y = bounds.centerY();
            } else {
                return false;
            }

            press(x, y, duration);
            sleep(100);

            this.logger.debug('[UI] 롱 프레스', { x, y, duration });
            return true;

        } catch (e) {
            this.logger.error('[UI] 롱 프레스 실패', { error: e.message });
            return false;
        }
    }

    /**
     * 스크롤하여 요소 찾기
     * @param {Object} selector - 셀렉터
     * @param {number} maxScrolls - 최대 스크롤 횟수
     * @returns {UiObject|null}
     */
    scrollToFind(selector, maxScrolls = 5) {
        for (let i = 0; i < maxScrolls; i++) {
            // 먼저 찾기 시도
            const element = this.findElement(selector, 1000);
            if (element) {
                return element;
            }

            // 스크롤
            this.swipe(Direction.UP, 400);
            sleep(500);
        }

        return null;
    }

    /**
     * 화면 크기 업데이트
     */
    updateScreenSize() {
        this.screenWidth = device.width || 1080;
        this.screenHeight = device.height || 2280;
    }
}

module.exports = UIService;
module.exports.Direction = Direction;
module.exports.SelectorStrategy = SelectorStrategy;

