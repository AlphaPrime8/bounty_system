use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("8tk9cckc1aVcDS9JYEg5EQxHPmDzrLnNFRAYFRJYLi5T");

// config
const AUTH_PDA_SEED: &[u8] = b"auth_pda_seeds";
const WSOL_POOL_SEED: &[u8] = b"pool_wrapped_sol_seeds";
const MAX_BOUNTIES: usize = 300;

#[program]
pub mod bounty_system {
    use super::*;

    pub fn init_pdas(
        ctx: Context<InitPdas>,
        acceptors: Vec<Pubkey>,
    ) -> ProgramResult {
        let auth_pda = &mut ctx.accounts.auth_pda;


        // proposal status variables
        let mut bounties = Vec::new();
        let sample_bounty = Bounty {
            criteria: String::from("this is a sample bounty criteria"),
            hunter: acceptors[0].clone(),
            acceptor: acceptors[1].clone(),
            amount: 1,
        };
        bounties.push(sample_bounty);
        auth_pda.bounties = bounties;
        auth_pda.acceptors = acceptors;

        Ok(())
    }

    pub fn create_bounty(
        ctx: Context<CreateBounty>,
        criteria: String,
        hunter: Pubkey,
        amount: u64,
    ) -> ProgramResult {

        // check if signer is owner
        let auth_pda = &ctx.accounts.auth_pda;
        let _owner_index = auth_pda
            .acceptors
            .iter()
            .position(|a| a == ctx.accounts.signer.key)
            .ok_or(ErrorCode::InvalidOwner)?;

        // check below limit
        if auth_pda.bounties.len() >= MAX_BOUNTIES {
            return Err(ErrorCode::TooManyBounties.into());
        }

        // check if amount of proposed amount is available in treasury
        // if proposed_amount > ctx.accounts.pool_wrapped_sol.amount {
        //     return Err(ErrorCode::InsufficientBalance.into());
        // }

        let new_bounty = Bounty {
            criteria,
            hunter,
            acceptor: ctx.accounts.signer.key.clone(),
            amount
        };
        ctx.accounts.auth_pda.bounties.push(new_bounty);

        Ok(())
    }

    pub fn cancel_bounty(
        ctx: Context<CancelBounty>,
        index: u64,
    ) -> ProgramResult {

        // check if signer is owner
        let auth_pda = &ctx.accounts.auth_pda;
        let _owner_index = auth_pda
            .acceptors
            .iter()
            .position(|a| a == ctx.accounts.signer.key)
            .ok_or(ErrorCode::InvalidOwner)?;

        // check signer is acceptor of bounty
        if *ctx.accounts.signer.key != ctx.accounts.auth_pda.bounties[index as usize].acceptor{
            return Err(ErrorCode::InvalidOwner.into());
        }

        // delete bounty
        ctx.accounts.auth_pda.bounties.remove(index as usize);

        Ok(())
    }

    pub fn award_bounty(
        ctx: Context<AwardBounty>,
        index: u64,
    ) -> ProgramResult {

        // check if signer is owner
        let auth_pda = &ctx.accounts.auth_pda;
        let _owner_index = auth_pda
            .acceptors
            .iter()
            .position(|a| a == ctx.accounts.signer.key)
            .ok_or(ErrorCode::InvalidOwner)?;

        // check signer is acceptor of bounty
        if *ctx.accounts.signer.key != ctx.accounts.auth_pda.bounties[index as usize].acceptor{
            return Err(ErrorCode::InvalidOwner.into());
        }

        // get seeds to sign for auth_pda
        let (pda, bump_seed) = Pubkey::find_program_address(&[AUTH_PDA_SEED], ctx.program_id);
        let seeds = &[&AUTH_PDA_SEED[..], &[bump_seed]];
        let signer = &[&seeds[..]];

        // check pda addy correct
        if pda != ctx.accounts.auth_pda.key() {
            return Err(ErrorCode::InvalidAuthPda.into());
        }

        // TODO confirm owner of proposed_receiver == hunter
        // if auth_pda.bounties[index].hunter != ctx.accounts.proposed_receiver.key {
        //
        // }
        let amount = auth_pda.bounties[index as usize].amount;

        let cpi_accounts = Transfer {
            from: ctx.accounts.pool_tbo.to_account_info(),
            to: ctx.accounts.proposed_receiver.clone(),
            authority: ctx.accounts.auth_pda.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, amount)?;

        // delete bounty
        ctx.accounts.auth_pda.bounties.remove(index as usize);

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitPdas<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(
        init,
        seeds = [AUTH_PDA_SEED],
        bump,
        payer = signer,
        space = 10000)] // TODO allocate not as inner instruction... lazy - 30 bounties, (how did i do this with NFTS?...)
    pub auth_pda: Account<'info, MultisigAccount>,
    #[account(
        init,
        token::mint = tbo_mint,
        token::authority = auth_pda,
        seeds = [WSOL_POOL_SEED],
        bump,
        payer = signer)]
    pub pool_tbo: Box<Account<'info, TokenAccount>>,
    pub tbo_mint: Box<Account<'info, Mint>>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(criteria: String, hunter: Pubkey, amount: u64)]
pub struct CreateBounty<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(
        mut,
        seeds = [AUTH_PDA_SEED],
        bump)]
    pub auth_pda: Account<'info, MultisigAccount>,
    #[account(
        constraint = pool_tbo.owner == auth_pda.key(),
        seeds = [WSOL_POOL_SEED],
        bump)]
    pub pool_tbo: Box<Account<'info, TokenAccount>>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CancelBounty<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(
        mut,
        seeds = [AUTH_PDA_SEED],
        bump)]
    pub auth_pda: Account<'info, MultisigAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AwardBounty<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(
        mut,
        seeds = [AUTH_PDA_SEED],
        bump)]
    pub auth_pda: Account<'info, MultisigAccount>,
    #[account(
        mut,
        constraint = pool_tbo.owner == auth_pda.key(),
        seeds = [WSOL_POOL_SEED],
        bump)]
    pub pool_tbo: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub proposed_receiver: AccountInfo<'info>,
    pub tbo_mint: Box<Account<'info, Mint>>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[account]
#[derive(Default)]
pub struct MultisigAccount {
    pub acceptors: Vec<Pubkey>,
    pub bounties: Vec<Bounty>, //note add total value check
}

#[derive(AnchorSerialize, AnchorDeserialize, Default, Clone)]
pub struct Bounty {
    pub criteria: String,
    pub hunter: Pubkey,
    pub acceptor: Pubkey,
    pub amount: u64,
}

#[error]
pub enum ErrorCode {
    #[msg("Num owners exceeds max")]
    TooManyOwners,
    #[msg("Not enough officer signers")]
    NotEnoughOfficerSigners,
    #[msg("Not enough total signers")]
    NotEnoughTotalSigners,
    #[msg("Proposal is not active")]
    ProposalInactive,
    #[msg("Proposal parameters do not match expected")]
    ProposalMismatch,
    #[msg("Insufficient balance")]
    InsufficientBalance,
    #[msg("Invalid auth pda")]
    InvalidAuthPda,
    #[msg("The given owner is not part of this multisig")]
    InvalidOwner,
    #[msg("Owners vec and is_officer vec must be same length")]
    InvalidVectorLengths,
    #[msg("Too many bounties")]
    TooManyBounties,
}

