# Handling collisions

> **Key idea:** collisions are normal; chaining or open addressing resolves them.

## Chaining

Each bucket holds a small list of entries. Lookups scan the list for the key.

```python
buckets[bucket(key, n)].append((key, value))
```
