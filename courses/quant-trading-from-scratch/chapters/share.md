# A share: a small piece of owning a company

A market can trade anything people want to buy and sell, from concert tickets to apples. This course starts with something you cannot hold in your hand: small pieces of companies. What is one of those pieces, and why would a stranger pay money for it?

## Owning a slice

Picture four friends who buy a holiday house together. Each pays a quarter of the price, so each owns a quarter of the house. If the house is rented out, each friend gets a quarter of the rent. If one friend wants out, they sell their quarter to someone new.

A company can be owned the same way. Its ownership is cut into a fixed number of equal slices, and each slice is called a share. If you own a share, you own that fraction of the company.

The picture stops holding in three places:

1. The house has 4 slices. A large company has millions or billions of shares.
2. A friend who sells needs the others to agree on the buyer. A shareholder can sell to any buyer, without asking the company.
3. A friend can sleep in the house. A shareholder cannot use the company's buildings or money. They own a claim on the company, not its furniture.

## What one share is worth to you

Say a company has 2,000,000 shares, and you buy 500 of them. The most recent trade was at 15.00 pounds per share.

1. Your fraction of the company is 500 / 2,000,000 = 0.00025, which is 0.025%.
2. Your shares are worth 500 × 15 = 7,500 pounds at that price.
3. At the same price, all the shares together are worth 2,000,000 × 15 = 30,000,000 pounds.

```python
shares_issued = 2_000_000   # all the shares the company has
you_own = 500
price = 15.00               # last trade price per share, in pounds

print(f"you own {you_own / shares_issued:.4%} of the company")
print(f"your shares are worth {you_own * price:,.2f}")
print(f"the whole company is valued at {shares_issued * price:,.0f}")
```

```
you own 0.0250% of the company
your shares are worth 7,500.00
the whole company is valued at 30,000,000
```

That 30,000,000 is not money the company keeps in a bank. It is the price of the last trade multiplied by the number of shares. If the next trade happens at 14.00 pounds, the same company is valued at 28,000,000 pounds. Nothing inside the company changed, only the price people agreed on.

Why pay for a share at all? An owner has a claim on what the company earns. A company can pay part of its profit to its owners in cash, in proportion to the shares each one holds. An owner can also sell the share later, perhaps at a higher price. Buyers pay more when they expect the company to earn more. Because of this, the price moves when news changes what people expect.

```inkling
title "What one share gives you"
layout mindmap
- One share
  - A fraction of ownership
  - A claim on profits
  - A vote at owners' meetings
  - The right to sell it
step 1: one-share "A share is one equal slice of a company"
step 2: a-fraction-of-ownership "You own that fraction of the company"
step 3: a-claim-on-profits, a-vote-at-owners-meetings "You share in its profits and its decisions"
step 4: the-right-to-sell-it "You can sell the slice to anyone who will buy it"
highlight a-fraction-of-ownership
```

## Where shares trade

Shares trade on an exchange. An exchange is a market run by a company. It lists which shares may trade there, and it matches buyers with sellers under fixed rules. The New York Stock Exchange and the London Stock Exchange are two exchanges. Each share on an exchange has a ticker: a short code that names it. For example, Apple's shares trade on the Nasdaq exchange under the ticker AAPL. Code and data files use tickers, not company names.

> **Key idea:** A share is one equal slice of a company's ownership, and its price is set by trades between buyers and sellers on an exchange.

## What you have now

As you saw with a market, every trade sets a price. A share is the item traded, and an exchange is the market where it trades. On an exchange, thousands of buyers and sellers wait at once, each with their own price. So what is "the price" of a share at one moment, if nobody has traded for a few seconds?
