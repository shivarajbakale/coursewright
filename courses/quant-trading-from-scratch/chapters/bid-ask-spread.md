# The bid-ask spread: the gap you pay to trade at once

As you saw with a quote, a share has two prices at every moment. You buy at the best ask and sell at the best bid. In the last example, the best bid was 99.98 pounds and the best ask was 100.02 pounds. Suppose you buy one share and sell it again a second later. Nothing about the company changed. Do you get your money back?

## Changing money and changing it back

Go back to the airport currency booth. You change pounds into dollars at the booth's "We sell" price. Your flight is cancelled, so you change the dollars straight back at its "We buy" price. You end with fewer pounds than you started with. The gap between the two prices went to the booth.

The same loss happens on an exchange. Here is the round trip with the quote from before, for 300 shares:

1. You buy 300 shares at once. You pay the best ask, 100.02 per share.
2. You sell the 300 shares at once. You get the best bid, 99.98 per share.
3. You lose 100.02 − 99.98 = 0.04 per share.
4. On 300 shares, the loss is 0.04 × 300 = 12 pounds.

The price people agree on did not move at all. You lost 12 pounds only because you traded at once, in both directions.

The booth picture stops holding in two ways. The booth is one dealer who chooses its gap, and that gap is wide. On an exchange, the gap comes from many waiting buyers and sellers who compete with each other. Because they compete, the gap on a busy share is narrow. Also, the booth's gap stays fixed all day. The gap on an exchange changes every time a waiting price arrives or leaves.

## Measuring the gap

The bid-ask spread is the best ask minus the best bid. It is the price of being impatient. If you want a trade now, you must accept the price that someone is already waiting at. Someone who waits with their own price, and gets matched later, earns that gap instead of paying it. Firms that do this all day are called market makers.

The fair middle of the two prices is the mid price: the best bid plus the best ask, divided by 2. For the quote above, (99.98 + 100.02) / 2 = 100.00. A buyer who trades at once pays 0.02 above the mid price. A seller who trades at once gets 0.02 below it. So each immediate trade costs half the spread, and a round trip costs the whole spread.

A spread of 0.04 means little on its own. It matters relative to the price. Compare two illustrative shares:

```python
def spread_stats(bid, ask):
    spread = ask - bid
    mid = (bid + ask) / 2
    return round(spread, 4), round(mid, 4), round(spread / mid, 6)

print(spread_stats(99.98, 100.02))   # a busy, large company
print(spread_stats(4.95, 5.05))      # a small, quiet company
```

```
(0.04, 100.0, 0.0004)
(0.1, 5.0, 0.02)
```

1. For the busy share, 0.04 / 100.00 = 0.0004, which is 0.04% of the mid price.
2. For the quiet share, 0.10 / 5.00 = 0.02, which is 2% of the mid price.

The second share costs 50 times as much to trade, as a fraction of its price. A rule that buys and sells it often must earn more than 2% per round trip, or it loses money.

```inkling
title "Two spreads side by side"
layout compare
columns "Busy share", "Quiet share"
row "Best bid": "99.98", "4.95"
row "Best ask": "100.02", "5.05"
row "Spread": "0.04", "0.10"
row "Mid price": "100.00", "5.00"
row "Spread / mid": "0.04%"!, "2%"
step 1: best-bid, best-ask "Two quotes, at very different price levels"
step 2: spread "The quiet share has the bigger gap in pounds"
step 3: mid-price, spread-mid "Divided by the mid price, it costs 50 times more"
```

> **Key idea:** The bid-ask spread is the best ask minus the best bid, and every trade made at once pays half of it, measured from the mid price.

## What you have now

A quote has two prices, and the spread between them is a cost you pay each time you trade at once. You now know the price of a share at one moment. A trading rule, though, looks at prices over hours, days or years. With thousands of trades a day, how do you store a share's price history in a form you can work with?
