# Hash functions

> **Key idea:** a hash function turns a key into a bucket index, quickly and evenly.

## Why hash

A good hash function spreads keys uniformly so lookups stay O(1) on average.

```python
def bucket(key: str, n: int) -> int:
    return hash(key) % n
```
