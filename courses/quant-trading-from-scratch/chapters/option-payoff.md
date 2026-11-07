# Option payoffs: the right but not the duty to trade

A futures contract pays you when the price rises and costs you when it falls. Many buyers want only the first half. Say a stock trades at $100, and you want to gain if it rises over the next year. You do not want to lose if it falls. Can a contract give you a choice instead of a duty?

## A choice you pay for up front

Think of a refundable deposit on a house you might buy. The deposit is the up-front fee, and the agreed house price is the fixed price you may pay later. If house prices rise, you buy at the agreed price. If they fall, you walk away and lose only the fee. The picture stops holding on the fee: an option's fee is never refunded, and it is a market price that changes every day.

An option is a contract that gives its buyer a right, not a duty, to trade at a fixed price by a fixed date. Four words describe it:

- A **call** is the right to buy the stock.
- A **put** is the right to sell the stock.
- The **strike** is the fixed price of that trade.
- The **premium** is the price the buyer pays the seller for the option, today.

In this course every option is European. A European option can be used only at its expiry, not before. Using the right is called exercising the option.

## The payoff at expiry

At expiry, the call holder compares the stock price with the strike:

1. If the stock is above the strike, you exercise. You buy at the strike and can sell at the market price.
2. If the stock is at or below the strike, you let the call expire. It pays nothing.

So the call pays max(stock − strike, 0). The put works the other way round. It pays max(strike − stock, 0), because you sell at the strike only when the stock is below it.

```inkling
title "What a call pays at expiry"
layout down
start: round "Expiry day"
check: diamond "Stock above\nstrike?"
yes: box "Exercise: buy at strike" green
no: box "Let it expire" gray
pay: box "Payoff: stock - strike"
zero: box "Payoff: 0"
start -> check
check -> yes : "yes"
check -> no : "no"
yes -> pay
no -> zero
highlight zero
step 1: start, check "At expiry, compare the stock with the strike"
step 2: yes, pay "Above the strike, the call pays the difference"
step 3: no, zero "At or below the strike, it pays nothing"
```

Take a stock at $100 and options that expire in one year, both with a strike of $100. Say the call's premium is $10.45 and the put's premium is $5.57. Take these premiums as given for now. Profit is the payoff minus the premium:

```python
import numpy as np
import pandas as pd

strike, call_premium, put_premium = 100, 10.45, 5.57
price_at_expiry = np.array([80, 90, 100, 110, 120, 130])
call_payoff = np.maximum(price_at_expiry - strike, 0)
put_payoff = np.maximum(strike - price_at_expiry, 0)
print(pd.DataFrame({
    "stock": price_at_expiry,
    "call payoff": call_payoff,
    "call profit": call_payoff - call_premium,
    "put payoff": put_payoff,
    "put profit": put_payoff - put_premium,
}).round(2).to_string(index=False))
```

```
 stock  call payoff  call profit  put payoff  put profit
    80            0       -10.45          20       14.43
    90            0       -10.45          10        4.43
   100            0       -10.45           0       -5.57
   110           10        -0.45           0       -5.57
   120           20         9.55           0       -5.57
   130           30        19.55           0       -5.57
```

Read the call columns. The worst the buyer can do is lose the $10.45 premium. The buyer makes a profit only above 100 + 10.45 = 110.45. Above that, each extra dollar of stock price is a dollar of profit. This table ignores the interest the premium could earn in the year.

The seller of the call has the opposite position. The seller keeps the $10.45 when the stock ends at or below $100. The seller's loss grows without a limit as the stock rises. Because of this, an exchange asks option sellers for margin, as it does for futures.

> **Key idea:** A call pays max(stock − strike, 0) at expiry and a put pays max(strike − stock, 0), and the buyer pays the premium today for that one-sided payoff.

## What you have now

You have a contract whose payoff bends at the strike, unlike the straight line of a futures contract. The call and put above have the same stock, strike and expiry. Their premiums, $10.45 and $5.57, look unrelated. Is there a fixed link between the price of a call and the price of a put?
