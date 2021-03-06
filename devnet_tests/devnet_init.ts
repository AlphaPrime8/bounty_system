// run with: npx ts-node devnet_tests/devnet_init.ts
import {Keypair, clusterApiUrl, SystemProgram, PublicKey} from "@solana/web3.js";
import {Provider, Wallet, web3} from "@project-serum/anchor";
// const prompt = require('prompt-sync')();
import * as anchor from "@project-serum/anchor";
import {NATIVE_MINT, TOKEN_PROGRAM_ID, Token, ASSOCIATED_TOKEN_PROGRAM_ID} from "@solana/spl-token";
import {token} from "@project-serum/common";
import {assert} from "chai";
let idl = JSON.parse(require('fs').readFileSync('./target/idl/bounty_system.json', 'utf8'));
const metaplex = require("@metaplex/js");

// setup
let program_id = 'X2223zZ7kqnLzJSot89bn8Z3DhPgVgZxvWBoPRx2yF8'; // can also load from file as done with localKeypair below
const programId = new anchor.web3.PublicKey(program_id);
const localKeypair = Keypair.fromSecretKey(Buffer.from(JSON.parse(require("fs").readFileSync("/home/myware/.config/solana/devnet.json", {encoding: "utf-8",}))));
let wallet = new Wallet(localKeypair);
let opts = Provider.defaultOptions();
// const network = clusterApiUrl('devnet');
const network = clusterApiUrl('mainnet-beta');
let connection = new web3.Connection(network, opts.preflightCommitment);
let provider = new Provider(connection, wallet, opts);
const program = new anchor.Program(idl, programId, provider);

const AUTH_PDA_SEED = "auth_pda_seeds";
const WSOL_POOL_SEED = "pool_wrapped_sol_seeds";

const BELA_PUPKEY = "GrGUgPNUHKPQ8obxmmbKKJUEru1D6uWu9fYnUuWjbXyi";
const ALPHA_PUPKEY = "5aWNmcpfP9rUjEFkXFpFaxu6gnpWvBXeHLcxkseP4r8W";
const ROHDEL_PUBKEY = "D4K5yZR1kcvaX7ZDTUWpGoZM8gHVjC1pxB1m1vSmC5NZ";
const TBO_MINT = "3iH4LXRDMicfqb4TPR99QYzz1d6zyDvuuCWsQZxMH2bi";

console.log('loaded local wallet: %s', localKeypair.publicKey.toString());
console.log("ProgramID: %s == program.program_id: %s", programId.toString(), program.programId.toString());

function to_lamports(num_sol) {
    return Math.round(num_sol * 1e9);
}


// async function wrap_and_send_to_treasury() {
//
//     const [poolWrappedSol] = await PublicKey.findProgramAddress(
//         [Buffer.from(anchor.utils.bytes.utf8.encode(WSOL_POOL_SEED))],
//         program.programId
//     );
//
//     const amount_sol = 8.694;
//
//     const wrappedSolAta = await Token.createWrappedNativeAccount(provider.connection, TOKEN_PROGRAM_ID, localKeypair.publicKey, localKeypair, to_lamports(amount_sol));
//     // lookup ATA for PDA
//     const instructions: anchor.web3.TransactionInstruction[] = [];
//
//     // send wrapped sol
//     instructions.push(
//         Token.createTransferInstruction(
//             TOKEN_PROGRAM_ID,
//             wrappedSolAta,
//             poolWrappedSol,
//             localKeypair.publicKey,
//             [],
//             to_lamports(amount_sol),
//         )
//     );
//
//     const transaction = new anchor.web3.Transaction().add(...instructions);
//     transaction.feePayer = localKeypair.publicKey;
//     transaction.recentBlockhash = (await provider.connection.getRecentBlockhash()).blockhash;
//
//     await anchor.web3.sendAndConfirmTransaction(
//         provider.connection,
//         transaction,
//         [localKeypair]
//     );
//
// }

async function get_ata(){

    const TBO_MINT = "2KRvcgPeyq3sWZMFGNteie1r4mhn1JjSGAqTnDpJbWvm";
    let mint_addy = new PublicKey(TBO_MINT);
    let hunter_pk = new PublicKey(BELA_PUPKEY);
    let tboMint = new Token(provider.connection, mint_addy, TOKEN_PROGRAM_ID, localKeypair);
    let receiverAta = await tboMint.getOrCreateAssociatedAccountInfo(hunter_pk);
    console.log("got ata ", receiverAta.address.toString());
}

async function load_pda_info(){
    // lookup pdas
    const [authPda] = await PublicKey.findProgramAddress(
        [Buffer.from(anchor.utils.bytes.utf8.encode(AUTH_PDA_SEED))],
        program.programId
    );

    let authPdaInfo = await program.account.multisigAccount.fetch(authPda);
    console.log(authPdaInfo);

    for (const a in authPdaInfo.acceptors){
        console.log(authPdaInfo.acceptors[a].toString());
    }

    // pool balance



}

async function run_init_pdas() {


    // lookup pdas
    const [authPda] = await PublicKey.findProgramAddress(
        [Buffer.from(anchor.utils.bytes.utf8.encode(AUTH_PDA_SEED))],
        program.programId
    );

    const [poolTbo] = await PublicKey.findProgramAddress(
        [Buffer.from(anchor.utils.bytes.utf8.encode(WSOL_POOL_SEED))],
        program.programId
    );

    console.log("using poolTBO: ", poolTbo.toString());

    let owner1 = new PublicKey(BELA_PUPKEY);
    let owner2 = new PublicKey(ALPHA_PUPKEY);
    let owner3 = new PublicKey(ROHDEL_PUBKEY);

    let acceptors = [owner1, owner2, owner3];

    let mint_addy = new PublicKey(TBO_MINT);
    let tboMint = new Token(provider.connection, mint_addy, TOKEN_PROGRAM_ID, localKeypair);

    // let tboMint = await Token.createMint(
    //     provider.connection,
    //     localKeypair,
    //     localKeypair.publicKey,
    //     null,
    //     0,
    //     TOKEN_PROGRAM_ID,
    // );

    console.log("tboMint is ", tboMint.publicKey.toString());

    await program.rpc.initPdas(
        acceptors,
        {
            accounts: {
                signer: localKeypair.publicKey,
                authPda: authPda,
                poolTbo: poolTbo,
                tboMint: tboMint.publicKey,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            },
            signers: [localKeypair],
        }
    );

    // // fund poolTbo from mint
    // await tboMint.mintTo(
    //     poolTbo,
    //     localKeypair.publicKey,
    //     [localKeypair],
    //     1000000,
    // );
    //
    // let _poolTbo = await tboMint.getAccountInfo(
    //     poolTbo
    // );
    //
    // console.log("in tbo pool is: ", _poolTbo.amount.toNumber());

}

load_pda_info()
    .then(value => {
        console.log("success with value: {}", value);
    })
    .catch(err => {
        console.error("got err: {}", err);
    });

// let response = prompt('Ok we got transaction...continue? ');
// console.log(`Ok... ${response}`);





