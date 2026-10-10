use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::MagicIntentBundleBuilder;

declare_id!("F3zG6GJkibp3HB7tFrt32UGaiJaSEarAJ3QWnmgiRqs6");

// Casual game: the server is the disclosed scoring oracle. ERs enforce round
// ordering, write authority, single locked submissions and the durable result.
// This does not provide trustless scoring or financial settlement.
#[ephemeral]
#[program]
pub mod postmark_game {
    use super::*;
    pub fn initialize(ctx: Context<Initialize>, room: [u8; 6]) -> Result<()> {
        let game = &mut ctx.accounts.game;
        game.authority = ctx.accounts.payer.key();
        game.room = room;
        game.round = 0;
        game.locked = 0;
        game.scores = [0; 2];
        game.commitments = [[0; 32]; 2];
        game.finished = false;
        Ok(())
    }
    pub fn lock_guess(
        ctx: Context<Play>,
        round: u8,
        player: u8,
        commitment: [u8; 32],
    ) -> Result<()> {
        let game = &mut ctx.accounts.game;
        require!(!game.finished && game.round == round, GameError::WrongRound);
        require!(player < 2, GameError::InvalidPlayer);
        let bit = 1u8 << player;
        require!(game.locked & bit == 0, GameError::AlreadyLocked);
        require!(commitment != [0; 32], GameError::EmptyCommitment);
        game.commitments[player as usize] = commitment;
        game.locked |= bit;
        Ok(())
    }
    pub fn settle_round(ctx: Context<Play>, round: u8, scores: [u16; 2]) -> Result<()> {
        let game = &mut ctx.accounts.game;
        require!(!game.finished && game.round == round, GameError::WrongRound);
        require!(game.locked == 3, GameError::NotReady);
        require!(
            scores[0] <= 5000 && scores[1] <= 5000,
            GameError::InvalidScore
        );
        for i in 0..2 {
            game.scores[i] = game.scores[i]
                .checked_add(scores[i] as u32)
                .ok_or(GameError::InvalidScore)?;
        }
        game.round += 1;
        game.finished = game.round == 3;
        game.locked = 0;
        game.commitments = [[0; 32]; 2];
        Ok(())
    }
    pub fn delegate(ctx: Context<DelegateInput>, room: [u8; 6]) -> Result<()> {
        require_keys_eq!(*ctx.accounts.pda.owner, crate::ID, GameError::Unauthorized);
        let game = Game::try_deserialize(&mut &ctx.accounts.pda.try_borrow_data()?[..])?;
        require_keys_eq!(
            game.authority,
            ctx.accounts.payer.key(),
            GameError::Unauthorized
        );
        require!(game.room == room && !game.finished, GameError::WrongRound);
        ctx.accounts.delegate_pda(
            &ctx.accounts.payer,
            &[b"postmark", ctx.accounts.payer.key().as_ref(), &room],
            DelegateConfig {
                validator: ctx.remaining_accounts.first().map(|a| a.key()),
                ..Default::default()
            },
        )?;
        Ok(())
    }
    pub fn finish(ctx: Context<Finish>) -> Result<()> {
        require!(ctx.accounts.game.finished, GameError::NotReady);
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[ctx.accounts.game.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }
}
#[derive(Accounts)]
#[instruction(room:[u8;6])]
pub struct Initialize<'info> {
    #[account(init,payer=payer,space=8+32+6+1+1+8+64+1,seeds=[b"postmark",payer.key().as_ref(),&room],bump)]
    pub game: Account<'info, Game>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct Play<'info> {
    #[account(mut,has_one=authority,seeds=[b"postmark",authority.key().as_ref(),&game.room],bump)]
    pub game: Account<'info, Game>,
    pub authority: Signer<'info>,
}
#[delegate]
#[derive(Accounts)]
pub struct DelegateInput<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: owner, PDA seeds and stored authority are verified before delegation.
    #[account(mut, del)]
    pub pda: UncheckedAccount<'info>,
}
#[commit]
#[derive(Accounts)]
pub struct Finish<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut,constraint=game.authority==payer.key() @ GameError::Unauthorized,seeds=[b"postmark",payer.key().as_ref(),&game.room],bump)]
    pub game: Account<'info, Game>,
}
#[account]
pub struct Game {
    pub authority: Pubkey,
    pub room: [u8; 6],
    pub round: u8,
    pub locked: u8,
    pub scores: [u32; 2],
    pub commitments: [[u8; 32]; 2],
    pub finished: bool,
}
#[error_code]
pub enum GameError {
    #[msg("Wrong round or match finished")]
    WrongRound,
    #[msg("Only two players are allowed")]
    InvalidPlayer,
    #[msg("Guess already locked")]
    AlreadyLocked,
    #[msg("Commitment cannot be empty")]
    EmptyCommitment,
    #[msg("Both guesses must be locked")]
    NotReady,
    #[msg("Score must be between zero and five thousand")]
    InvalidScore,
    #[msg("Wrong game authority")]
    Unauthorized,
}
