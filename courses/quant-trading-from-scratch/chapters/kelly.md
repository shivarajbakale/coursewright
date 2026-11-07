# The Kelly criterion: the bet size that grows money fastest

Position sizing turns a signal into a quantity, for example a fixed fraction of the account. But which fraction? If the fraction is too small, a real edge earns almost nothing. If it is too large, a short run of losses wipes you out. Is there a best fraction, and can you compute it?

## A bent coin that favours you

Picture a friend with a bent coin. It lands heads 60% of the time. Each round you choose a stake as a fraction of the money you have now. Heads, you win your stake. Tails, you lose it.

The coin stands for a trade with a known edge. Heads is a winning trade, tails a losing one, and the stake is the share of the account you put on it. The picture stops holding in two places. A real trade wins or loses different amounts each time, not exactly the stake. And nobody tells you the real chance of winning.

Each round looks good on its own. The expected value of a bet is its average result over many repeats, with each outcome weighted by its chance. For each 1 you stake, it is 0.6 × 1 + 0.4 × (−1) = 0.2. A positive expected value tempts you to stake everything. But then the first tail leaves you with 0, and you can never play again.

The expected value misleads because your money compounds. A stake of 20% multiplies your money by 1.2 on heads and by 0.8 on tails. As you saw with log returns, multiplying growth factors is the same as adding their logarithms. So the number to make as large as possible is the average log growth per round, not the average gain.

## Working it out for a stake of 20%

1. Heads multiplies your money by 1.2. Its log growth is ln(1.2) = 0.18232.
2. Tails multiplies it by 0.8. Its log growth is ln(0.8) = −0.22314, a loss.
3. Weight each by its chance: 0.6 × 0.18232 + 0.4 × (−0.22314) = 0.10939 − 0.08926 = 0.02014 per round.
4. Over 100 rounds the logs add: 100 × 0.02014 = 2.014. That is a growth factor of 7.49, so 1,000 becomes about 7,490.

Now try four stakes in code:

```python
import numpy as np

p = 0.6                                   # chance of heads
for f in [0.1, 0.2, 0.3, 0.4]:            # stake as a fraction of what you have
    g = p * np.log(1 + f) + (1 - p) * np.log(1 - f)
    print(f"stake {f:.0%}: log growth per round {g:+.5f}, "
          f"growth factor after 100 rounds {np.exp(100 * g):.2f}")
```

```
stake 10%: log growth per round +0.01504, growth factor after 100 rounds 4.50
stake 20%: log growth per round +0.02014, growth factor after 100 rounds 7.49
stake 30%: log growth per round +0.01475, growth factor after 100 rounds 4.37
stake 40%: log growth per round -0.00245, growth factor after 100 rounds 0.78
```

Look at the stake of 40%. Every single bet still has a positive expected value: 0.2 × 0.4 = 0.08 per round. Yet after 100 rounds you keep only 0.78 of your money, a loss of 22%. One loss at 0.6 undoes more than one win at 1.4 gives back.

```inkling
title "Bigger stakes, slower growth"
layout compare
columns "Stake 10%", "Stake 20%", "Stake 40%"
row "Average gain per round": "+2%", "+4%", "+8%"
row "Log growth per round": "+0.01504", "+0.02014"!, "-0.00245"
row "Growth factor after 100": "4.50", "7.49"!, "0.78"
step 1: average-gain-per-round "A bigger stake always has a bigger average gain"
step 2: log-growth-per-round "But compounding rewards the middle stake"
step 3: growth-factor-after-100 "At 40% you lose money on a winning coin"
```

## The formula

The best stake has a short formula. Let p be the chance of winning, q = 1 − p the chance of losing, and b what you win for each 1 you stake. The best fraction is f = p − q / b. For the coin, b is 1, so f = 0.6 − 0.4 = 0.2. A bet that pays 2 for each 1 staked and wins 40% of the time gives 0.4 − 0.6 / 2 = 0.1.

This is the Kelly criterion. It was published by John Kelly in 1956 for a problem about sending signals over a noisy line.

> **Key idea:** The Kelly criterion picks the stake that makes the average log growth per bet as large as possible; for known odds it is f = p − q / b.

## What you have now

You now have a rule that turns an edge into a stake, built on compounding and log returns. Staking more than Kelly grows money more slowly, and at about twice Kelly it stops growing. But the formula needs p exactly, and a backtest only gives you an estimate of it. What should you stake when your p might be wrong?
