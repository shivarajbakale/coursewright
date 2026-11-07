# The limit order book: every waiting order, queued by price and time

With orders, you saw that a limit order waits until someone trades at your price. A quote shows you only the best bid and the best ask. So where do all the other waiting orders sit, and when your buy order waits at $100.00, who gets filled first?

## Queues at each price

Think of a market hall with one counter for each price. Buyers who will pay $100.00 stand in one line. Buyers who will pay only $99.99 stand in the next line. Sellers have their own lines on the other side of the hall. When a seller who wants to sell at once walks in, the seller goes to the highest-paying buyers first. Inside that line, the person who arrived first is served first.

The picture stops holding in two places. In a hall you see each person, but the book shows only how many shares wait at each price, not who owns them. Also, people in a hall move slowly. Traders can add or cancel an order in under one second, at no charge. Because of this, the lines you see can change before your order arrives.

The exchange keeps this list of waiting orders for each ticker. It shows the buy side, with the highest price on top, and the sell side, with the lowest price on top. The top of each side is the quote: the best bid and the best ask.

```inkling
title "One side of the book, one queue per price"
layout stack
- Ask 100.03: 500 shares
- Ask 100.02: 300 shares
- Bid 100.00: A 250, B 150, you 100
- Bid 99.99: C 600
brace ask-100-02-300-shares..bid-100-00-a-250-b-150-you-100 "the quote"
highlight bid-100-00-a-250-b-150-you-100
step 1: ask-100-03-500-shares, ask-100-02-300-shares "Sellers wait above, lowest price nearest the middle"
step 2: bid-100-00-a-250-b-150-you-100 "Buyers at 100.00 wait in arrival order"
step 3: bid-99-99-c-600 "Lower bids wait behind the best bid"
```

## Who fills first

Here is a buy side with four waiting orders, each with its price, its arrival time, its owner and its size. The owner names are only for this example. Your order of 100 shares arrived third at $100.00. Then a market sell order for 450 shares arrives.

```python
bids = [  # price, time, owner, shares
    (100.00, "09:30:01", "A", 250),
    (100.00, "09:30:04", "B", 150),
    (100.00, "09:30:07", "you", 100),
    (99.99, "09:30:02", "C", 600),
]
# best price first; at one price, earliest time first
bids.sort(key=lambda o: (-o[0], o[1]))

to_sell = 450  # a market sell order arrives
for price, time, owner, shares in bids:
    if to_sell == 0:
        break
    filled = min(shares, to_sell)
    to_sell -= filled
    print(f"{owner:>3} buys {filled} at {price:.2f}")
```

```
  A buys 250 at 100.00
  B buys 150 at 100.00
you buys 50 at 100.00
```

Walk through it:

1. The sort puts every $100.00 order above the $99.99 order. Inside $100.00, it orders by time: A, B, then you.
2. A is first in line. A gets all 250 shares, and 200 shares are left to sell.
3. B gets all 150 shares, and 50 shares are left.
4. You get the last 50 shares. This is a partial fill: 50 of your 100 shares are still waiting.
5. C never trades, although C arrived before you. C bid one cent less, and price comes before time.

Before the sell order came, 400 shares stood ahead of you: 250 + 150 = 400. You could trade only after 400 shares were sold at your price.

## Name it

The **limit order book** is the exchange's list of all waiting limit orders for one ticker. It is sorted by price first and by arrival time second. Two small words describe it. **Depth** is the number of shares waiting at a price, or at all prices near the best one. Here the depth at $100.00 is 500 shares, and the depth of the buy side within one cent is 1,100 shares. **Queue position** is the number of shares ahead of your order at its price. Your queue position was 400 shares. A cancelled order that you send again joins the back of its queue. Only a better price moves you ahead.

> **Key idea:** The limit order book fills waiting orders best price first, and at one price in the order they arrived, so your place in the queue decides when you trade.

## What you have now

The book shows what stands behind the best bid and the best ask that a quote shows. It also explains a partial fill: your order trades only as far as the queue in front of it allows. The sell order here was small and stopped at the best bid. What happens to the price you pay when your order is larger than the depth at the best price?
