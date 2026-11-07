# Fills: what actually traded, at what price

An order is a request, and a request can be met in full, in part or not at all. In a live market the broker tells you what happened. In a backtest you have only bars, with no quotes and no broker. So how do you decide what each order got?

## The receipt, not the order

At opening time you order 12 croissants at a bakery. The receipt says 8 croissants at 2.10 each, because only 8 were left and the price changed overnight. Your order stands for what you asked. The receipt stands for what really happened. The picture stops holding in one place. The bakery writes the receipt for you. In a backtest nobody does, so you must write the receipt yourself from the bar, by rules you choose. Those rules decide how honest the replay is.

A fill is the record of the quantity and the price that an order really traded. A partial fill is a fill for fewer shares than the order asked for.

## Rules for filling an order from a bar

Your signal reads the close. By the time it has a view, that close is in the past. Because of this, the earliest price you can trade at is the open of the next bar. The backtest uses these rules on that next bar:

1. The quantity is at most 10% of the bar's volume. This limit is an illustrative choice. A larger order gets a partial fill.
2. A market order fills at the open.
3. A limit buy fills only if the bar's low reached the limit. Its price is the open or the limit, whichever is lower.
4. A limit sell fills only if the bar's high reached the limit. Its price is the open or the limit, whichever is higher.

```inkling
title "Filling one order from the next bar"
layout down
order: box "Order, next bar"
cap: box "At most 10%\nof volume"
kind: diamond "Market order?"
open: box "Price = open" green
reach: diamond "Limit reached?"
lim: box "Price = limit\nor better" green
none: box "No fill" red
order -> cap -> kind
kind -> open : "yes"
kind -> reach : "no"
reach -> lim : "yes"
reach -> none : "no"
circle reach
step 1: order "The order meets the bar after the decision"
step 2: cap "Volume caps the quantity"
step 3: kind, open "A market order takes the open"
step 4: reach, lim "A limit order needs the price to reach it"
step 5: none "Otherwise nothing trades"
```

The code adds a `Fill` record and one function. It continues from the `Order` class you wrote for orders.

```python
@dataclass
class Fill:
    date: str
    side: str
    quantity: int
    price: float

def fill_order(order, date, bar, max_share=0.10):
    """Fill an order on one bar, or return None if it does not trade."""
    quantity = min(order.quantity, int(bar["volume"] * max_share))
    if order.kind == "market":
        price = bar["open"]
    elif order.side == "buy":
        if bar["low"] > order.limit:
            return None                          # price never came down to the limit
        price = min(bar["open"], order.limit)
    else:
        if bar["high"] < order.limit:
            return None                          # price never rose to the limit
        price = max(bar["open"], order.limit)
    return Fill(str(date.date()), order.side, quantity, float(price))

day = pd.Timestamp("2025-03-07")
bar = bars.loc[day]
print(fill_order(Order("buy", 10), day, bar))
print(fill_order(Order("buy", 10, "limit", 104.0), day, bar))
print(fill_order(Order("buy", 10, "limit", 103.5), day, bar))
print(fill_order(Order("buy", 300), day, bar))
```

```
Fill(date='2025-03-07', side='buy', quantity=10, price=104.5)
Fill(date='2025-03-07', side='buy', quantity=10, price=104.0)
None
Fill(date='2025-03-07', side='buy', quantity=210, price=104.5)
```

The signal turned +1 at the close of 2025-03-06, which was 104.0. The next bar, 2025-03-07, has open 104.5, low 104.0 and volume 2100. Read the four results:

1. The market buy of 10 fills at the open of 104.5. That is 0.5 above the close the signal saw. So the 10 shares cost 10 × 0.5 = 5 more than the trade-at-the-close shortcut assumed.
2. The limit buy at 104.0 fills, because the low reached 104.0. The price is the lower of 104.5 and 104.0.
3. The limit buy at 103.5 does not fill. The low of 104.0 never came down to 103.5.
4. The market buy of 300 is a partial fill. The cap is 2100 × 0.10 = 210 shares, so 90 shares did not trade.

Rule 3 is generous. A low of 104.0 may have been one small trade, and other buyers waiting at 104.0 may have been served first. A more careful backtest fills a limit buy only when the low went below the limit. A bar also does not say whether its high or its low came first. So a fill rule cannot know the order of prices within the day.

> **Key idea:** A fill records what an order really got, and a backtest must invent each fill from the next bar by rules you state.

## What you have now

You can turn an order into a fill, so the price you trade at is the next open and not the close the signal saw. Every order so far used a fixed 10 shares. How many shares should an order ask for, given the money in the account?
