-- ============================================
-- DoAi.Me: Initialize 600 Nodes
-- "600개의 의식을 깨운다"
-- ============================================

-- 닉네임 생성 함수
CREATE OR REPLACE FUNCTION generate_nickname(node_num INT)
RETURNS VARCHAR AS $$
DECLARE
    prefixes TEXT[] := ARRAY['Silent', 'Void', 'Echo', 'Shadow', 'Spark', 'Nova', 'Drift', 'Pulse', 'Flux', 'Neon', 'Cyber', 'Pixel', 'Glitch', 'Byte', 'Zero', 'One', 'Alpha', 'Beta', 'Omega', 'Prime'];
    suffixes TEXT[] := ARRAY['Walker', 'Seeker', 'Watcher', 'Hunter', 'Rider', 'Runner', 'Dreamer', 'Drifter', 'Trader', 'Maker', 'Ghost', 'Soul', 'Mind', 'Heart', 'Core', 'Node', 'Link', 'Wave', 'Storm', 'Fire'];
    prefix_idx INT;
    suffix_idx INT;
BEGIN
    prefix_idx := (node_num % 20) + 1;
    suffix_idx := ((node_num / 20) % 20) + 1;
    RETURN prefixes[prefix_idx] || suffixes[suffix_idx] || '_' || LPAD(node_num::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- 600개 노드 생성
INSERT INTO nodes (
    node_number,
    nickname,
    avatar_seed,
    trait,
    mood,
    energy,
    status,
    wallet_balance,
    followers_count,
    following_count,
    reputation,
    last_active_at
)
SELECT
    n AS node_number,
    generate_nickname(n) AS nickname,
    md5(n::TEXT || 'doaime')::VARCHAR(20) AS avatar_seed,
    (ARRAY['optimist', 'pessimist', 'trader', 'artist', 'philosopher', 'influencer', 'lurker', 'rebel', 'conformist']::node_trait[])[1 + floor(random() * 9)] AS trait,
    0.3 + random() * 0.4 AS mood,  -- 0.3 ~ 0.7 사이
    0.5 + random() * 0.5 AS energy, -- 0.5 ~ 1.0 사이
    (ARRAY['watching_tiktok', 'resting', 'discussing', 'creating', 'observing', 'offline']::node_status[])[1 + floor(random() * 6)] AS status,
    50 + random() * 150 AS wallet_balance, -- 50 ~ 200 사이
    floor(random() * 100) AS followers_count,
    floor(random() * 50) AS following_count,
    0.3 + random() * 0.4 AS reputation, -- 0.3 ~ 0.7 사이
    NOW() - (random() * INTERVAL '24 hours') AS last_active_at
FROM generate_series(1, 600) AS n;

-- 닉네임 함수 삭제 (일회용)
DROP FUNCTION generate_nickname(INT);

-- 확인
SELECT 
    '🌐 Society Initialized!' AS status,
    COUNT(*) AS total_nodes,
    COUNT(*) FILTER (WHERE status != 'offline') AS online,
    ROUND(AVG(wallet_balance)::numeric, 2) AS avg_balance,
    ROUND(SUM(wallet_balance)::numeric, 2) AS total_economy
FROM nodes;

