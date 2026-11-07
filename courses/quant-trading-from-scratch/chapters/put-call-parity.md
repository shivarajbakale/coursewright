# Put-call parity: the fixed link between call and put prices

You saw a call at $10.45 and a put at $5.57. Both were on a $100 stock, with a strike of $100 and one year to expiry. Can these two premiums move freely, or does one fix the other?

## Two baskets that always pay the same

Think of two fruit baskets at a market stall. Basket A holds an apple and a pear. Basket B holds the same apple and the same pear, packed in a different box. Nobody would pay more for one basket, because you get the same fruit. The picture stops holding in one way. With options, the two baskets hold different contracts, and they pay the same only at expiry.

Build two baskets of contracts and compare what they pay in one year:

1. Basket A: one call with strike $100, plus enough cash today to grow to $100 by expiry.
2. Basket B: one put with strike $100, plus one share.

At expiry, check two cases:

1. The stock ends at $120. In A, the call pays $20 and the cash is $100, so A is worth $120. In B, the put pays nothing and the share is worth $120.
2. The stock ends at $80. In A, the call pays nothing, so A holds $100 of cash. In B, the put pays $20 and the share is worth $80, so B is worth $100.

Both baskets are worth the larger of the stock price and $100, in every case. So they must cost the same today.

## The cash part: present value

How much cash today grows to $100 in one year? This amount is the **present value** of $100. As you saw with a futures contract, cash grows by the factor e^(r × T) with continuous interest. So the present value of an amount K is K × e^(−r × T). At the risk-free rate of 5%, e^(−0.05) = 0.9512, so the present value of $100 is $95.12.

Now set the two costs equal:

call + K × e^(−r × T) = put + stock

Move the put to the left side. Call minus put must equal the stock minus the present value of the strike. This link is put-call parity. Check it with our premiums: 10.45 − 5.57 = 4.88, and 100 − 95.12 = 4.88. Both baskets cost 10.45 + 95.12 = 105.57 today.

```inkling
title "Two baskets, one payoff"
layout compare
columns "Call + $95.12 cash", "Put + 1 share"
row "Cost today": "$105.57", "$105.57"
row "Stock ends at $80": "$100", "$100"
row "Stock ends at $120": "$120", "$120"
step 1: cost-today "Both baskets cost the same today"
step 2: stock-ends-at-80 "Below the strike, both are worth $100"
step 3: stock-ends-at-120 "Above the strike, both are worth the share"
```

```python
import numpy as np

S, K, r, T = 100, 100, 0.05, 1
call, put = 10.45, 5.57
pv_strike = K * np.exp(-r * T)               # cash today that grows to K
print("pv of strike:", round(pv_strike, 2))
print("call - put:  ", round(call - put, 2))
print("S - pv:      ", round(S - pv_strike, 2))

stock_at_expiry = np.array([80, 100, 120])
a = np.maximum(stock_at_expiry - K, 0) + K   # call plus the cash, grown to K
b = np.maximum(K - stock_at_expiry, 0) + stock_at_expiry  # put plus one share
print(a, b)
```

```
pv of strike: 95.12
call - put:   4.88
S - pv:       4.88
[100 100 120] [100 100 120]
```

## What happens if the link breaks

Say a dealer offers the put at $4.57, $1.00 too cheap. You can then do four trades today:

1. Sell the call and receive $10.45.
2. Buy the put and pay $4.57.
3. Buy one share and pay $100.
4. Borrow $95.12 at 5%, to repay $100 at expiry.

Your cash today is 10.45 − 4.57 − 100 + 95.12 = 1.00. At expiry, the share, the put and the sold call are together worth exactly $100 in every case. That $100 repays the loan. So you keep $1.00 with no risk.

A trade that locks in a profit with no risk and no money of your own is an **arbitrage**. Traders look for such gaps all the time. Their buying and selling pushes the prices back until the gap is smaller than the trading costs.

> **Key idea:** Put-call parity says call − put = stock − present value of the strike, for European options with the same strike and expiry, or an arbitrage exists.

## What you have now

Put-call parity fixes the gap between a call and a put. It says nothing about the level of either premium. To price one option, you need a model of where the stock may end up. Stock moves come from a great many small effects. What shape do their totals take?
