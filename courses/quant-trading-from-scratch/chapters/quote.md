# A quote: the best prices to buy and sell now

As you saw with a market, every trade sets a price. On an exchange, a busy share can go a few seconds without a trade. During those seconds, buyers and sellers still wait, each with their own price. If you want to buy a share right now, the last trade price is old news. What price can you actually get?

## Two prices, not one

Picture a currency booth at an airport. Its board shows two prices for US dollars: "We buy" and "We sell". The booth buys dollars from you at the lower price and sells dollars to you at the higher price. You never get one single price. You get one price for each direction.

A share on an exchange works the same way, with one difference. The booth is one dealer who chooses both prices. On an exchange, the two prices come from many different people who are waiting. Each waiting buyer has said the most they will pay. Each waiting seller has said the least they will accept.

Here is a small example. For one share, the waiting people are:

- Buyers: 300 shares wanted at 99.98, 500 at 99.97 and 200 at 99.95.
- Sellers: 400 shares offered at 100.02, 100 at 100.03 and 600 at 100.05.

Ask the two questions a trader asks:

1. If I want to sell now, who pays me the most? The buyer at 99.98, for up to 300 shares.
2. If I want to buy now, who charges me the least? The seller at 100.02, for up to 400 shares.

```python
buyers = {99.98: 300, 99.97: 500, 99.95: 200}    # price: shares wanted
sellers = {100.02: 400, 100.03: 100, 100.05: 600} # price: shares offered

best_bid = max(buyers)
best_ask = min(sellers)
print(f"best bid {best_bid} for {buyers[best_bid]} shares")
print(f"best ask {best_ask} for {sellers[best_ask]} shares")
```

```
best bid 99.98 for 300 shares
best ask 100.02 for 400 shares
```

The highest price a waiting buyer offers is the best bid. The lowest price a waiting seller accepts is the best ask. Every other waiting price is worse for you, so the best two are the ones that matter now.

```inkling
title "The waiting prices, highest at the top"
layout stack
- Sell 600 at 100.05
- Sell 100 at 100.03
- Sell 400 at 100.02
- Buy 300 at 99.98
- Buy 500 at 99.97
- Buy 200 at 99.95
brace sell-600-at-100-05..sell-400-at-100-02 "sellers wait here"
brace buy-300-at-99-98..buy-200-at-99-95 "buyers wait here"
highlight sell-400-at-100-02
highlight buy-300-at-99-98
step 1: sell-600-at-100-05, sell-100-at-100-03, sell-400-at-100-02 "Sellers wait above, cheapest at the bottom"
step 2: buy-300-at-99-98, buy-500-at-99-97, buy-200-at-99-95 "Buyers wait below, keenest at the top"
```

Notice that the best bid is below the best ask. That is always true for the prices still waiting. Suppose a buyer offered 100.02 or more. That buyer would match the seller at 100.02 at once. A trade would happen, and neither price would be waiting any more. So the prices left waiting always have a buyer side below a seller side.

## Naming it

A quote is the pair of best prices for one share at one moment: the best bid and the best ask. It often includes how many shares are available at each. The best bid is the most you can get by selling right now. The best ask is the least you can pay to buy right now. A quote changes every time a waiting buyer or seller arrives, leaves or trades.

> **Key idea:** A quote gives the best bid, the highest price a buyer is waiting to pay, and the best ask, the lowest price a seller is waiting to accept.

## What you have now

A share trades on an exchange, and its quote tells you what you can get right now in each direction. In the example, prices are in pounds. You buy at 100.02 but sell at 99.98. That gap of 0.04 pounds per share looks too small to matter. What does it cost you if you buy a share and then change your mind?
