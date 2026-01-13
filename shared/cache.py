"""
🚀 DoAi.Me Cache Layer
Redis-based caching for scaling to 100+ nodes

Usage:
    from shared.cache import get_cache, CacheKey

    cache = get_cache()

    # Store with TTL
    await cache.set(CacheKey.NODE_HEALTH, node_id, data, ttl=60)

    # Retrieve
    data = await cache.get(CacheKey.NODE_HEALTH, node_id)

    # Delete
    await cache.delete(CacheKey.NODE_HEALTH, node_id)
"""

import asyncio
import inspect
import json
import os
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Optional, Union

try:
    from loguru import logger
except ImportError:
    import logging

    logger = logging.getLogger(__name__)
    logging.basicConfig(level=logging.INFO)


class CacheKey(str, Enum):
    """Cache key prefixes"""

    NODE_HEALTH = "node:health"
    NODE_METRICS = "node:metrics"
    DEVICE_STATUS = "device:status"
    JOB_STATS = "stats:jobs"
    VIDEO_QUEUE_STATS = "stats:video_queue"
    SYSTEM_STATS = "stats:system"
    RATE_LIMIT = "ratelimit"


class CacheBackend:
    """Abstract cache backend"""

    async def get(self, key: str) -> Optional[Any]:
        raise NotImplementedError

    async def set(self, key: str, value: Any, ttl: int = 60) -> bool:
        raise NotImplementedError

    async def delete(self, key: str) -> bool:
        raise NotImplementedError

    async def exists(self, key: str) -> bool:
        raise NotImplementedError

    async def incr(self, key: str, ttl: int = 60) -> int:
        raise NotImplementedError

    async def close(self):
        pass


class RedisBackend(CacheBackend):
    """Redis cache backend using aioredis"""

    def __init__(self, url: str = "redis://localhost:6379"):
        self.url = url
        self._redis = None
        self._lock = asyncio.Lock()

    async def _get_client(self):
        if self._redis is None:
            async with self._lock:
                if self._redis is None:
                    try:
                        import redis.asyncio as aioredis

                        self._redis = await aioredis.from_url(
                            self.url,
                            encoding="utf-8",
                            decode_responses=True,
                        )
                        logger.info(f"Redis connected: {self.url}")
                    except ImportError:
                        logger.warning("redis package not installed, falling back to memory cache")
                        raise
        return self._redis

    async def get(self, key: str) -> Optional[Any]:
        try:
            client = await self._get_client()
            value = await client.get(key)
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            logger.warning(f"Redis GET failed: {e}")
            return None

    async def set(self, key: str, value: Any, ttl: int = 60) -> bool:
        try:
            client = await self._get_client()
            serialized = json.dumps(value, default=str)
            await client.setex(key, ttl, serialized)
            return True
        except Exception as e:
            logger.warning(f"Redis SET failed: {e}")
            return False

    async def delete(self, key: str) -> bool:
        try:
            client = await self._get_client()
            await client.delete(key)
            return True
        except Exception as e:
            logger.warning(f"Redis DELETE failed: {e}")
            return False

    async def exists(self, key: str) -> bool:
        try:
            client = await self._get_client()
            return await client.exists(key) > 0
        except Exception as e:
            logger.warning(f"Redis EXISTS failed: {e}")
            return False

    async def incr(self, key: str, ttl: int = 60) -> int:
        try:
            client = await self._get_client()
            pipe = client.pipeline()
            pipe.incr(key)
            pipe.expire(key, ttl)
            results = await pipe.execute()
            return results[0]
        except Exception as e:
            logger.warning(f"Redis INCR failed: {e}")
            return 0

    async def close(self):
        if self._redis:
            await self._redis.close()
            self._redis = None


class MemoryBackend(CacheBackend):
    """In-memory cache backend (fallback when Redis unavailable)"""

    def __init__(self, max_size: int = 10000):
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._max_size = max_size
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Optional[Any]:
        async with self._lock:
            entry = self._cache.get(key)
            if entry:
                if entry["expires_at"] > datetime.now(timezone.utc).timestamp():
                    return entry["value"]
                else:
                    del self._cache[key]
            return None

    async def set(self, key: str, value: Any, ttl: int = 60) -> bool:
        async with self._lock:
            # Evict oldest entries if at capacity
            if len(self._cache) >= self._max_size:
                oldest_key = min(self._cache.keys(), key=lambda k: self._cache[k]["expires_at"])
                del self._cache[oldest_key]

            self._cache[key] = {
                "value": value,
                "expires_at": datetime.now(timezone.utc).timestamp() + ttl,
            }
            return True

    async def delete(self, key: str) -> bool:
        async with self._lock:
            if key in self._cache:
                del self._cache[key]
            return True

    async def exists(self, key: str) -> bool:
        return await self.get(key) is not None

    async def incr(self, key: str, ttl: int = 60) -> int:
        async with self._lock:
            entry = self._cache.get(key)
            if entry and entry["expires_at"] > datetime.now(timezone.utc).timestamp():
                entry["value"] = int(entry["value"]) + 1
                return entry["value"]
            else:
                self._cache[key] = {
                    "value": 1,
                    "expires_at": datetime.now(timezone.utc).timestamp() + ttl,
                }
                return 1


class Cache:
    """
    Unified cache interface with key prefix management

    Automatically falls back to memory cache if Redis unavailable.
    """

    def __init__(self, backend: Optional[CacheBackend] = None):
        self._backend = backend
        self._initialized = False

    async def _ensure_backend(self):
        if not self._initialized:
            if self._backend is None:
                redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
                try:
                    self._backend = RedisBackend(redis_url)
                    # Test connection
                    await self._backend._get_client()
                    logger.info("Using Redis cache backend")
                except Exception as e:
                    logger.warning(f"Redis unavailable ({e}), using memory cache")
                    self._backend = MemoryBackend()
            self._initialized = True

    def _make_key(self, prefix: Union[CacheKey, str], *parts: str) -> str:
        """Build cache key from prefix and parts"""
        prefix_str = prefix.value if isinstance(prefix, CacheKey) else prefix
        if parts:
            return f"{prefix_str}:{':'.join(str(p) for p in parts)}"
        return prefix_str

    async def get(self, prefix: Union[CacheKey, str], *key_parts: str) -> Optional[Any]:
        """Get value from cache"""
        await self._ensure_backend()
        key = self._make_key(prefix, *key_parts)
        return await self._backend.get(key)

    async def set(
        self,
        prefix: Union[CacheKey, str],
        *args,
        ttl: int = 60,
    ) -> bool:
        """
        Set value in cache

        Usage:
            await cache.set(CacheKey.NODE_HEALTH, node_id, data, ttl=60)
            # or
            await cache.set("custom:key", data, ttl=120)
        """
        await self._ensure_backend()

        # Last arg before ttl is the value
        if len(args) < 1:
            raise ValueError("Value is required")

        value = args[-1]
        key_parts = args[:-1]
        key = self._make_key(prefix, *key_parts)

        return await self._backend.set(key, value, ttl)

    async def delete(self, prefix: Union[CacheKey, str], *key_parts: str) -> bool:
        """Delete value from cache"""
        await self._ensure_backend()
        key = self._make_key(prefix, *key_parts)
        return await self._backend.delete(key)

    async def exists(self, prefix: Union[CacheKey, str], *key_parts: str) -> bool:
        """Check if key exists in cache"""
        await self._ensure_backend()
        key = self._make_key(prefix, *key_parts)
        return await self._backend.exists(key)

    async def get_or_set(
        self,
        prefix: Union[CacheKey, str],
        *args,
        ttl: int = 60,
        factory,
    ) -> Any:
        """
        Get from cache or compute and store

        Usage:
            data = await cache.get_or_set(
                CacheKey.JOB_STATS,
                ttl=30,
                factory=lambda: compute_stats()
            )
        """
        await self._ensure_backend()

        key_parts = args
        key = self._make_key(prefix, *key_parts)

        # Try cache first
        value = await self._backend.get(key)
        if value is not None:
            return value

        # Compute value
        if inspect.iscoroutinefunction(factory):
            value = await factory()
        else:
            value = factory()

        # Store in cache
        await self._backend.set(key, value, ttl)
        return value

    async def incr(self, prefix: Union[CacheKey, str], *key_parts: str, ttl: int = 60) -> int:
        """Increment counter (for rate limiting)"""
        await self._ensure_backend()
        key = self._make_key(prefix, *key_parts)
        return await self._backend.incr(key, ttl)

    async def close(self):
        """Close cache connections"""
        if self._backend:
            await self._backend.close()


# ===========================================
# Rate Limiter using Cache
# ===========================================


class RateLimiter:
    """
    Simple rate limiter using cache backend

    Usage:
        limiter = RateLimiter(cache, max_requests=10, window_seconds=60)

        if await limiter.is_allowed("node:node_01"):
            # Process request
        else:
            # Rate limited
    """

    def __init__(self, cache: Cache, max_requests: int = 10, window_seconds: int = 60):
        self.cache = cache
        self.max_requests = max_requests
        self.window_seconds = window_seconds

    async def is_allowed(self, identifier: str) -> bool:
        """Check if request is allowed under rate limit"""
        count = await self.cache.incr(CacheKey.RATE_LIMIT, identifier, ttl=self.window_seconds)
        return count <= self.max_requests

    async def get_remaining(self, identifier: str) -> int:
        """Get remaining requests in current window"""
        count = await self.cache.get(CacheKey.RATE_LIMIT, identifier) or 0
        return max(0, self.max_requests - int(count))


# ===========================================
# Singleton Instance
# ===========================================

_cache: Optional[Cache] = None


def get_cache() -> Cache:
    """Get singleton cache instance"""
    global _cache
    if _cache is None:
        _cache = Cache()
    return _cache


def reset_cache():
    """Reset cache (for testing)"""
    global _cache
    _cache = None


# ===========================================
# Convenience Functions
# ===========================================


async def cache_node_health(node_id: str, health_data: Dict[str, Any], ttl: int = 60):
    """Cache node health data"""
    cache = get_cache()
    await cache.set(CacheKey.NODE_HEALTH, node_id, health_data, ttl=ttl)


async def get_node_health(node_id: str) -> Optional[Dict[str, Any]]:
    """Get cached node health data"""
    cache = get_cache()
    return await cache.get(CacheKey.NODE_HEALTH, node_id)


async def cache_system_stats(stats: Dict[str, Any], ttl: int = 30):
    """Cache system statistics"""
    cache = get_cache()
    await cache.set(CacheKey.SYSTEM_STATS, stats, ttl=ttl)


async def get_system_stats() -> Optional[Dict[str, Any]]:
    """Get cached system statistics"""
    cache = get_cache()
    return await cache.get(CacheKey.SYSTEM_STATS)
