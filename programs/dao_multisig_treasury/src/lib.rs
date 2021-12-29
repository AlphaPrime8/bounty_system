use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("8tk9cckc1aVcDS9JYEg5EQxHPmDzrLnNFRAYFRJYLi5T");

// config
const AUTH_PDA_SEED: &[u8] = b"auth_pda_seeds";
const WSOL_POOL_SEED: &[u8] = b"pool_wrapped_sol_seeds";
const MAX_OWNERS: usize = 20;

#[program]
pub mod bounty_system {
    use super::*;

    pub fn init_pdas(
        ctx: Context<InitPdas>,
        owners: Vec<Pubkey>,
        is_officer: Vec<bool>,
        total_threshold: u64,
        officer_threshold: u64,
    ) -> ProgramResult {
        if owners.len() != is_officer.len() {
            return Err(ErrorCode::InvalidVectorLengths.into());
        }
        if owners.len() > MAX_OWNERS {
            return Err(ErrorCode::TooManyOwners.into());
        }
        let auth_pda = &mut ctx.accounts.auth_pda;

        // permanent state parameters
        auth_pda.owners = owners;
        auth_pda.is_officer = is_officer;
        auth_pda.total_threshold = total_threshold;
        auth_pda.officer_threshold = officer_threshold;

        // proposal status variables
        let mut signers = Vec::new();
        signers.resize(auth_pda.owners.len(), false);
        auth_pda.signers = signers;
        auth_pda.proposal_is_active = false;

        Ok(())
    }

    pub fn propose_withdraw(
        ctx: Context<ProposeWithdraw>,
        proposed_receiver: Pubkey,
        proposed_amount: u64,
    ) -> ProgramResult {

        // check if signer is owner
        let auth_pda = &ctx.accounts.auth_pda;
        let owner_index = auth_pda
            .owners
            .iter()
            .position(|a| a == ctx.accounts.signer.key)
            .ok_or(ErrorCode::InvalidOwner)?;

        // check if amount of proposed amount is available in treasury
        if proposed_amount > ctx.accounts.pool_wrapped_sol.amount {
            return Err(ErrorCode::InsufficientBalance.into());
        }

        // reset state
        let auth_pda = &mut ctx.accounts.auth_pda;
        for i in 0..auth_pda.owners.len(){
            if i == owner_index {
                auth_pda.signers[i] = true;
            } else {
                auth_pda.signers[i] = false;
            }
        }
        auth_pda.proposal_is_active = true;

        // set params
        auth_pda.proposed_receiver = proposed_receiver;
        auth_pda.proposed_amount = proposed_amount;

        Ok(())
    }

    pub fn approve_withdraw(
        ctx: Context<ApproveWithdraw>,
        proposed_receiver: Pubkey,
        proposed_amount: u64,
    ) -> ProgramResult {

        // check if signer is owner
        let auth_pda = &ctx.accounts.auth_pda;
        let owner_index = auth_pda
            .owners
            .iter()
            .position(|a| a == ctx.accounts.signer.key)
            .ok_or(ErrorCode::InvalidOwner)?;

        // check if proposal params match expected
        if (proposed_amount != auth_pda.proposed_amount) || (proposed_receiver != auth_pda.proposed_receiver) {
            return Err(ErrorCode::ProposalMismatch.into());
        }

        // set signer vec to true
        ctx.accounts.auth_pda.signers[owner_index] = true;

        Ok(())
    }

    pub fn execute_withdraw(
        ctx: Context<ExecuteWithdraw>,
    ) -> ProgramResult {

        // check proposal is active
        let auth_pda = &ctx.accounts.auth_pda;
        if !auth_pda.proposal_is_active {
            return Err(ErrorCode::ProposalInactive.into());
        }

        // calculate total signers and officer signers
        let mut num_total = 0;
        let mut num_officers = 0;
        for i in 0..auth_pda.owners.len() {
            if auth_pda.signers[i] {
                num_total += 1;
                if auth_pda.is_officer[i] {
                    num_officers += 1;
                }
            }
        }
        if num_total < auth_pda.total_threshold {
            return Err(ErrorCode::NotEnoughTotalSigners.into());
        }
        if num_officers < auth_pda.officer_threshold {
            return Err(ErrorCode::NotEnoughOfficerSigners.into());
        }

        // get seeds to sign for auth_pda
        let (pda, bump_seed) = Pubkey::find_program_address(&[AUTH_PDA_SEED], ctx.program_id);
        let seeds = &[&AUTH_PDA_SEED[..], &[bump_seed]];
        let signer = &[&seeds[..]];

        // check pda addy correct
        if pda != ctx.accounts.auth_pda.key() {
            return Err(ErrorCode::InvalidAuthPda.into());
        }

        let cpi_accounts = Transfer {
            from: ctx.accounts.pool_wrapped_sol.to_account_info(),
            to: ctx.accounts.proposed_receiver.clone(),
            authority: ctx.accounts.auth_pda.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, auth_pda.proposed_amount)?;

        // set inactive
        ctx.accounts.auth_pda.proposal_is_active = false;

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
        space = 750)] // lazy
    pub auth_pda: Box<Account<'info, MultisigAccount>>,
    #[account(
        init,
        token::mint = wsol_mint,
        token::authority = auth_pda,
        seeds = [WSOL_POOL_SEED],
        bump,
        payer = signer)]
    pub pool_wrapped_sol: Box<Account<'info, TokenAccount>>,
    pub wsol_mint: Box<Account<'info, Mint>>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(proposed_receiver: Pubkey, proposed_amount: u64)]
pub struct ProposeWithdraw<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(
        mut,
        seeds = [AUTH_PDA_SEED],
        bump)]
    pub auth_pda: Account<'info, MultisigAccount>,
    #[account(
        constraint = pool_wrapped_sol.owner == auth_pda.key(),
        seeds = [WSOL_POOL_SEED],
        bump)]
    pub pool_wrapped_sol: Box<Account<'info, TokenAccount>>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(proposed_receiver: Pubkey, proposed_amount: u64)]
pub struct ApproveWithdraw<'info> {
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
pub struct ExecuteWithdraw<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(
        mut,
        seeds = [AUTH_PDA_SEED],
        bump)]
    pub auth_pda: Account<'info, MultisigAccount>,
    #[account(
        mut,
        constraint = pool_wrapped_sol.owner == auth_pda.key(),
        seeds = [WSOL_POOL_SEED],
        bump)]
    pub pool_wrapped_sol: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = proposed_receiver.key() == auth_pda.proposed_receiver,
        )]
    pub proposed_receiver: AccountInfo<'info>,
    pub wsol_mint: Box<Account<'info, Mint>>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[account]
#[derive(Default)]
pub struct MultisigAccount { //TODO calculate size
// set inactive
pub owners: Vec<Pubkey>,
    pub is_officer: Vec<bool>,
    pub total_threshold: u64,
    pub officer_threshold: u64,
    pub proposed_receiver: Pubkey,
    pub proposed_amount: u64,
    pub signers: Vec<bool>,
    pub proposal_is_active: bool,
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
}

