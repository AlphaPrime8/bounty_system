# Basic Bounty System

This solana program uses the Anchor framework to implement a system for creating and awarding bounties.
Those Pubkeys authorized to create and award bounties are designated "acceptors", while those
that complete and are paid the bounties are called "hunters". The authorized acceptors are configured
once upon initialization of the program, and cannot be changed subsequently. Acceptors distribute
bounty tokens from a treasury wallet called "pool_tbo". This treasury can be initialized to any 
spl-token by passing in the desired Mint account upon initialization. It cannot be changed thereafter.

