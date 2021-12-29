import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, Token, NATIVE_MINT } from "@solana/spl-token";
import { BountySystem } from '../target/types/bounty_system';
import {assert} from "chai";

const TEST_COUNTER_EXAMPLE = false;
const AUTH_PDA_SEED = "auth_pda_seeds";
const WSOL_POOL_SEED = "pool_wrapped_sol_seeds";

function to_lamports(num_sol) {
    return Math.round(num_sol * 1e9);
}

describe("bounty_system", () => {

    // load connection params
    const provider = anchor.Provider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.BountySystem as Program<BountySystem>;

    // account variables
    let authPda: PublicKey = null;
    let poolTbo: PublicKey = null; // lookup as pda or ata?
    const owner1 = Keypair.generate();
    const owner2 = Keypair.generate();
    const owner3 = Keypair.generate();
    const mintAuthority = Keypair.generate();

    let tboMint: Token = null;

    it("Create test accounts, wrap sol, lookup PDAs.", async () => {


        // Airdropping tokens to a payer.
        await provider.connection.confirmTransaction(
            await provider.connection.requestAirdrop(owner1.publicKey, to_lamports(10)),
            "confirmed"
        );

        await provider.connection.confirmTransaction(
            await provider.connection.requestAirdrop(owner2.publicKey, to_lamports(1)),
            "confirmed"
        );

        await provider.connection.confirmTransaction(
            await provider.connection.requestAirdrop(owner3.publicKey, to_lamports(1)),
            "confirmed"
        );

        // create mint
        tboMint = await Token.createMint(
            provider.connection,
            owner1,
            mintAuthority.publicKey,
            null,
            0,
            TOKEN_PROGRAM_ID,
        );

        // lookup pdas
        [authPda] = await PublicKey.findProgramAddress(
            [Buffer.from(anchor.utils.bytes.utf8.encode(AUTH_PDA_SEED))],
            program.programId
        );

        [poolTbo] = await PublicKey.findProgramAddress(
            [Buffer.from(anchor.utils.bytes.utf8.encode(WSOL_POOL_SEED))],
            program.programId
        );

    });

    it("Init PDAs", async () => {


        let acceptors = [owner1.publicKey, owner2.publicKey, owner3.publicKey];

        await program.rpc.initPdas(
            acceptors,
            {
                accounts: {
                    signer: owner1.publicKey,
                    authPda: authPda,
                    poolTbo: poolTbo,
                    tboMint: tboMint.publicKey,
                    systemProgram: SystemProgram.programId,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                },
                signers: [owner1],
            }
        );

        // fund poolTbo from mint
        await tboMint.mintTo(
            poolTbo,
            mintAuthority.publicKey,
            [mintAuthority],
            1000000,
        );

        let _poolTbo = await tboMint.getAccountInfo(
            poolTbo
        );

        assert.ok(_poolTbo.amount.toNumber() == 1000000);
    });

    // it("Transfer wrapped sol to PDA for wrapped sol", async () => {
    //
    //     // check balance
    //     let nativeMint = new Token(provider.connection, NATIVE_MINT, TOKEN_PROGRAM_ID, owner1);
    //     let acctInfo = await nativeMint.getAccountInfo(poolWrappedSol);
    //     console.log("got amount before: ", acctInfo.amount.toNumber());
    //
    //
    //     // lookup ATA for PDA
    //     const instructions: anchor.web3.TransactionInstruction[] = [];
    //
    //     // send wrapped sol
    //     instructions.push(
    //         Token.createTransferInstruction(
    //             TOKEN_PROGRAM_ID,
    //             wrappedSolAta,
    //             poolWrappedSol,
    //             owner1.publicKey,
    //             [],
    //             to_lamports(8),
    //         )
    //     );
    //
    //     const transaction = new anchor.web3.Transaction().add(...instructions);
    //     transaction.feePayer = owner1.publicKey;
    //     transaction.recentBlockhash = (await provider.connection.getRecentBlockhash()).blockhash;
    //
    //     await anchor.web3.sendAndConfirmTransaction(
    //         provider.connection,
    //         transaction,
    //         [owner1]
    //     );
    //
    //     acctInfo = await nativeMint.getAccountInfo(poolWrappedSol);
    //     console.log("got amount after: ", acctInfo.amount.toNumber());
    //
    // });
    //
    it("Create Bounty", async () => {

        // lookup amount in pool pda
        let criteria = "This is another test criteria";
        let amount = 2;

        await program.rpc.createBounty(
            criteria,
            owner3.publicKey,
            new anchor.BN(amount),
            {
                accounts: {
                    signer: owner1.publicKey,
                    authPda: authPda,
                    poolTbo: poolTbo,
                    systemProgram: SystemProgram.programId,
                    tokenProgram: TOKEN_PROGRAM_ID,
                },
                signers: [owner1],
            }
        );

        // load PDA state
        let authPdaInfo = await program.account.multisigAccount.fetch(authPda);
        console.log("got auth pda info: ", authPdaInfo);
    });
    //
    // if (TEST_COUNTER_EXAMPLE) {
    //
    //     it("Test withdraw without approval", async () => {
    //
    //         try {
    //             await program.rpc.executeWithdraw(
    //                 {
    //                     accounts: {
    //                         signer: owner1.publicKey,
    //                         authPda: authPda,
    //                         poolWrappedSol: poolWrappedSol,
    //                         proposedReceiver: wrappedSolAta,
    //                         wsolMint: NATIVE_MINT,
    //                         systemProgram: SystemProgram.programId,
    //                         tokenProgram: TOKEN_PROGRAM_ID,
    //                     },
    //                     signers: [owner1],
    //                 }
    //             );
    //
    //             throw "withdraw should have failed";
    //         } catch (err) {
    //             console.log("Properly failed with error : ", err.msg);
    //         }
    //
    //     });
    // }
    //
    // it("Approve withdraw", async () => {
    //
    //     // lookup amount in pool pda
    //
    //     let proposed_amount = 5;
    //
    //     await program.rpc.approveWithdraw(
    //         wrappedSolAta,
    //         new anchor.BN(to_lamports(proposed_amount)),
    //         {
    //             accounts: {
    //                 signer: owner1.publicKey,
    //                 authPda: authPda,
    //                 systemProgram: SystemProgram.programId,
    //             },
    //             signers: [owner1],
    //         }
    //     );
    //
    //     await program.rpc.approveWithdraw(
    //         wrappedSolAta,
    //         new anchor.BN(to_lamports(proposed_amount)),
    //         {
    //             accounts: {
    //                 signer: owner2.publicKey,
    //                 authPda: authPda,
    //                 systemProgram: SystemProgram.programId,
    //             },
    //             signers: [owner2],
    //         }
    //     );
    //
    //     await program.rpc.approveWithdraw(
    //         wrappedSolAta,
    //         new anchor.BN(to_lamports(proposed_amount)),
    //         {
    //             accounts: {
    //                 signer: owner3.publicKey,
    //                 authPda: authPda,
    //                 systemProgram: SystemProgram.programId,
    //             },
    //             signers: [owner3],
    //         }
    //     );
    //
    // });
    //
    it("Award Bounty", async () => {

        // check balance
        const receiverAta = await tboMint.getOrCreateAssociatedAccountInfo(owner3.publicKey);
        console.log("got amount before: ", receiverAta.amount.toNumber());

        // get or create token account for give pubkey owner3

        await program.rpc.awardBounty(
            new anchor.BN(1),
            {
                accounts: {
                    signer: owner1.publicKey,
                    authPda: authPda,
                    poolTbo: poolTbo,
                    proposedReceiver: receiverAta.address,
                    tboMint: tboMint.publicKey,
                    systemProgram: SystemProgram.programId,
                    tokenProgram: TOKEN_PROGRAM_ID,
                },
                signers: [owner1],
            }
        );

        let acctInfo = await tboMint.getAccountInfo(receiverAta.address);
        console.log("got amount after: ", acctInfo.amount.toNumber());

    });

    it("Cancel Bounty", async () => {

        // get or create token account for give pubkey owner3

        await program.rpc.cancelBounty(
            new anchor.BN(0),
            {
                accounts: {
                    signer: owner2.publicKey,
                    authPda: authPda,
                    systemProgram: SystemProgram.programId,
                },
                signers: [owner2],
            }
        );

    });

});
