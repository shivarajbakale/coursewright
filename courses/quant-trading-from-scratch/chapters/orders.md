# Orders: instructions to buy or sell

So far you changed a position by saying "buy 10 at the close". A real market does not let you take a price. You send an instruction, and the market decides what happens to it. What exactly is that instruction, and what choices does it give you?

## Two ways to buy a bike

You want a used bike, and a board shows the lowest asking price, 100. You can pay 100 now and ride home. Or you can pin a note to the board: "I pay up to 95 for this bike." Then you wait, and you buy only if a seller accepts 95. The lowest asking price stands for the best ask from the quote. Paying it now stands for the first type of instruction, and the note stands for the second. The picture stops holding in two places. A market's best prices change many times a second. Also, many notes compete at the same price, so another buyer can be served first.

An order is an instruction to buy or sell a stated number of shares. You send it to a broker. A broker is the firm that holds your account and passes your orders to the exchange. An order has a side (buy or sell), a quantity and a type. There are two basic types:

- A market order trades at once at the best price available. A buy pays the best ask, and a sell receives the best bid.
- A limit order trades only at a price you name, the limit, or better. A buy trades at the limit or lower. A sell trades at the limit or higher. If no one accepts that price now, the order waits.

## One quote, three orders

Take an illustrative quote for XYZ: best bid 103.90, best ask 104.10, so the mid price is 104.00. You want to buy 10 shares.

1. A market order buys at once at 104.10. It costs 10 × 104.10 = 1041.
2. A limit order at 104.00 cannot trade now, because no seller asks 104.00. It waits. If a seller later accepts 104.00, it costs 10 × 104.00 = 1040.
3. A limit order at 104.20 trades at once. A seller asks 104.10, which is better than your limit, so you pay 104.10.

The trade-off follows from those cases. A market order is sure to trade, but you learn the price only after it trades. A limit order is sure of its worst price, but it may never trade. In case 2 the limit saves 1041 − 1040 = 1 if it trades. If the price rises instead, you have no shares at all.

```inkling
title "Two kinds of order"
layout compare
columns "Market order", "Limit order"
row "Trades at once": yes, partly
row "Worst price known": no, yes
row "Buy 10, ask 104.10": "pays 104.10", "waits at 104.00"
row "Main risk": "a worse price", "no trade"
step 1: trades-at-once "A market order always trades now"
step 2: worst-price-known "A limit order fixes the worst price"
step 3: buy-10-ask-104-10 "With this quote, the two orders differ by 0.10 a share"
step 4: main-risk "Each choice keeps one risk"
```

## Orders in the backtest

In code, an order is a small record. The function `order_for` compares the position you want with the position you hold and returns the order that closes the gap.

```python
from dataclasses import dataclass

@dataclass
class Order:
    side: str                    # "buy" or "sell"
    quantity: int                # number of shares, always positive
    kind: str = "market"         # "market" or "limit"
    limit: float | None = None   # worst price you accept, for a limit order

def order_for(target, current, kind="market", limit=None):
    """The order that moves the position from current to target shares."""
    change = target - current
    if change == 0:
        return None
    side = "buy" if change > 0 else "sell"
    return Order(side, abs(change), kind, limit)

print(order_for(10, 0))
print(order_for(-10, 10))
print(order_for(10, 10))
print(order_for(10, 0, "limit", 104.0))
```

```
Order(side='buy', quantity=10, kind='market', limit=None)
Order(side='sell', quantity=20, kind='market', limit=None)
None
Order(side='buy', quantity=10, kind='limit', limit=104.0)
```

Each line shows one case:

1. From 0 to 10 shares needs a buy of 10.
2. From +10 to −10 needs a sell of 20. One order sells the 10 you own and sells 10 borrowed shares.
3. From 10 to 10 needs nothing, so the function returns `None`.
4. The same buy of 10 as a limit order at 104.0.

The quantity is always positive and the side carries the direction. This matches how brokers take orders.

> **Key idea:** An order tells the market what to trade: a market order trades now at the best price, and a limit order trades only at your price or better.

## What you have now

You have orders built from the gap between the position you want and the position you hold, using the bid and ask of a quote. An order is a request. In the backtest you see bars, not live quotes. So how do you decide whether an order traded, how many shares it got, and at what price?
