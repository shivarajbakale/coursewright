# Rolling futures: replacing an expiring contract with the next

A futures contract ends at its expiry. Say you want to profit from oil prices for a whole year. The oil contracts that trade the most expire every month. What do you do as your contract nears its end, and does that step cost anything?

## Selling the old contract and buying the next

Think of a parking permit that lasts one month. Before it runs out, you buy next month's permit. The permit stands for one contract, and the month it covers stands for the time to expiry. The picture stops holding on price. Next month's permit costs the same, but the next contract can cost more or less than the one you hold.

Rolling is a loop of three steps, done a few days before each expiry:

1. Sell the contract that is about to expire.
2. Buy the contract with the next expiry, for the same amount of oil.
3. Hold it until a few days before its own expiry, then go back to step 1.

At any moment the exchange lists contracts for 12 or more expiries. Their prices, in order of expiry, form the **futures curve**. When later expiries cost more, the curve rises, and this shape is called **contango**. When later expiries cost less, the curve falls, and this shape is called **backwardation**.

Two forces set the shape for oil. Storing oil costs money, so the price for later delivery includes that cost. This pushes the curve up. A shortage of oil today raises the price for delivery now above later prices. This pushes the curve down. For a stock, as you saw with a futures contract, interest makes the curve rise.

```inkling
title "Two shapes of the futures curve"
layout compare
columns "Contango", "Backwardation"
row "Next contract": "$81, above spot", "$79, below spot"
row "Each roll": "loses 1.23%", "gains 1.27%"!
row "After 12 rolls": "$1,000 to $861.51", "$1,000 to $1,162.93"!
step 1: next-contract "Later contracts cost more or less than the spot price"
step 2: each-roll "Each contract drifts to the spot price at expiry"
step 3: after-12-rolls "The drift adds up over a year of rolls"
```

## A year of rolls with a flat oil price

The price for delivery now is called the spot price. At expiry a futures price equals the spot price, because both are then for delivery now. Take an illustrative case: the spot price of oil stays at $80 all year. Each month you buy the next contract and hold it to its expiry.

In contango, the next contract costs $81:

1. You buy at $81. At expiry the contract is worth the spot price, $80.
2. Your money changes by the growth factor 80 / 81 = 0.98765, a loss of 1.23%.
3. Twelve such months give 0.98765^12 = 0.8615, a loss of 13.85%.

In backwardation, the next contract costs $79. Each month's growth factor is 80 / 79 = 1.0127, a gain of 1.27%. Here is the year for $1,000:

```python
spot = 80.0          # the price for delivery now stays at 80 all year
for name, next_price in [("contango", 81.0), ("backwardation", 79.0)]:
    value = 1000.0   # money held in futures
    for month in range(12):
        # buy next month's contract; at its expiry it is worth the spot price
        value *= spot / next_price
    print(f"{name}: {value:.2f}")
```

```
contango: 861.51
backwardation: 1162.93
```

The oil price never moved, yet one holder lost $138.49 and the other gained $162.93. This part of the return comes from the shape of the curve, not from the price of oil. It is called the roll return.

The roll return is the carry in futures, as you saw with strategy families. A carry strategy in futures buys contracts in backwardation and sells contracts in contango. It earns the roll return if the curve keeps its shape.

> **Key idea:** Rolling futures means selling each contract before expiry and buying the next, and the shape of the futures curve adds return in backwardation and subtracts it in contango.

## What you have now

A futures contract makes you gain or lose on every price move, up or down. Rolling lets you hold that exposure for as long as you like. But what if you want to gain when the price rises without losing when it falls? Is there a contract that gives you that choice?
